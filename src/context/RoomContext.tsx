import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { globalGameCoreEngine, CommandGateway, LegacyRoomAdapter } from '../game';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    deleteField,
    runTransaction
} from 'firebase/firestore';
import {
    get as getRealtimeValue,
    onDisconnect as onRealtimeDisconnect,
    remove as removeRealtime,
    onValue as onRealtimeValue,
    push as pushRealtime,
    ref as realtimeRef,
    serverTimestamp as realtimeServerTimestamp,
    set as setRealtime,
    type DataSnapshot,
    type DatabaseReference,
} from 'firebase/database';
import { db, realtimeDb } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { Asset, BoardCardLogEntry, BoardCardResult, BoardDeckState, BoardEventLog, BoardQueuedEvent, BoardState, CoachExpenseCategory, DicePresentationEvent, FamilyMilestoneJoinPrompt, FamilyMilestoneJoinResponse, FinancialAccelerationMultiplier, FinancialAccelerationState, FinancialSubsidyState, GameState, PresenceState, PublicPlayerState, SharedCardPrompt, SharedCardPromptResponse, Transaction, TransactionData } from '../types';
import { cleanObject, safeAsync } from '../utils/utils';
import { createInitialMarketPrices, STOCK_SYMBOLS } from '../constants';
import { flowLog } from '../utils/flowLog';
import { trackGameEvent } from '../utils/telemetry';
import { BOARD_SQUARES, createInitialDeckState, getSquareByIndex } from '../constants/board';
import {
    buildHappinessCardMetaFromSchema,
    buildNewsCardMetaFromSchema,
    buildOpportunityCardMetaFromSchema,
    HAPPINESS_CARD_MAP,
    HAPPINESS_CARDS,
    NEWS_CARD_MAP,
    NEWS_CARDS,
    OPPORTUNITY_CARDS
} from '../constants/cards';
import { applyFamilyMilestoneStage, getFamilyMilestoneStageByCardId, getFamilyMilestoneStageByProgressId, getFamilyMilestoneStatus, isFamilyMilestoneComplete } from '../utils/familyMilestones';
import { getSharedOpportunityKind, resolveBoardCardAction, hasIncompleteSharedPrompts, isBoardPromptForCurrentEvent } from '../utils/boardCardActions';
import { buildMovementEffects, describeMovementEffects } from '../game/board/movementEffects';
import { appendDicePresentation, DICE_PRESENTATION_DURATION_MS, getFamilyDicePresentationReadyAt } from '../game/board/dicePresentation';
import { isRetryableBoardTransactionError, runBoardTransactionWithRetry, runRoomBoardMutation as runRoomBoardMutationOnServer, type BoardRoomSnapshot, type RunRoomBoardMutationParams } from '../game/board/runBoardMutation';
import { applyBoardCommand } from '../game/board/boardRevision';
import {
    applyBoardTransaction, applyHappinessAdd, applyHappinessRemove, applyHappinessToggle,
    applyHouseConversion, applyPaydayCollection, createSequentialIdGenerator
} from '../game/finance/applyBoardTransaction';
import { toPublicPlayerState } from '../utils/playerState';
import { extractAssetSymbol, getBusinessAssetLabel, getRealEstateAssetLabel, getStockAssetLabel } from '../utils/assetLabels';
import { canSkipDisconnectedPlayer, mapRealtimePresenceValue } from '../utils/presence';
import { buildNextBoardTurnState, clearBoardFlowState, getNextBoardTurn } from '../utils/experienceState';
import { applyPlayerExpenseAdjustment, applyPlayerLiabilityAdjustment } from '../utils/coachAdjustments';
import { getLiabilityMonthlyPayment, getRemainingCreditCapacity } from '../utils/financialRules';
import { buildMedicalBoardCardState } from '../utils/boardMedical';
import { buildRoomPlayerSlotUpdate, ROOM_PLAYER_SLOT_COUNT, getRoomPlayerSlots } from '../utils/roomPlayerSlots';

interface RoomMember {
    uid: string;
    name: string;
    photoURL?: string;
    email?: string;
    title?: string;
    experience?: number;
    role: 'coach' | 'player' | 'gm';
    joinedAt: any;
    isLeft?: boolean;
    photoPosition?: string;
    photoScale?: string;
    isReady?: boolean;
}

export const getSharedCardTargetPlayerUids = (
    members: ReadonlyArray<Pick<RoomMember, 'uid' | 'isLeft'>>,
    hostId: string,
    sourcePlayerUid: string
) => Array.from(new Set([
    ...members.filter(member => member.uid !== hostId && !member.isLeft).map(member => member.uid),
    ...(sourcePlayerUid !== hostId ? [sourcePlayerUid] : [])
]));

export const buildSharedPromptResponseFallback = (
    room: Room,
    promptId: string,
    uid: string,
    response: SharedCardPromptResponse,
    commandId: string,
    now = Date.now()
): { status: 'applied' | 'duplicate' | 'stale'; boardState?: BoardState } => {
    const board = room.boardState;
    const prompt = board?.sharedCardPrompt;
    if (!board || !prompt || prompt.id !== promptId || !prompt.targetPlayerUids.includes(uid)) {
        return { status: 'stale' };
    }
    if (prompt.responses?.[uid]) return { status: 'duplicate', boardState: board };

    const command = applyBoardCommand(board, commandId);
    if (command.duplicate) return { status: 'stale' };
    return {
        status: 'applied',
        boardState: {
            ...command.boardState,
            sharedCardPrompt: {
                ...prompt,
                responses: { ...(prompt.responses || {}), [uid]: response }
            },
            updatedAt: now
        }
    };
};

// Presence is ephemeral connection data; Firestore is reserved for game state.
const USE_REALTIME_PRESENCE = true;

const getTabClientId = (): string => {
    const key = 'happiness_flow_tab_client_id';
    try {
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const created = typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(key, created);
        return created;
    } catch {
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
};

const CONTROLLER_CLAIM_TTL_MS = 30_000;
const CONTROLLER_CLAIM_HEARTBEAT_MS = 5_000;

export interface RoomControllerClaim {
    clientId?: string;
    claimedAt?: number;
    lastSeenAt?: number;
}

export const selectActiveControllerClaim = (
    claims: RoomControllerClaim[],
    now = Date.now()
): RoomControllerClaim | null => claims
    .map(claim => ({
        ...claim,
        lastSeenAt: Number.isFinite(Number(claim.lastSeenAt)) ? Number(claim.lastSeenAt) : Number(claim.claimedAt)
    }))
    .filter(claim => (
        !!claim.clientId &&
        Number.isFinite(Number(claim.lastSeenAt)) &&
        now - Number(claim.lastSeenAt) <= CONTROLLER_CLAIM_TTL_MS
    ))
    .sort((left, right) => Number(right.lastSeenAt) - Number(left.lastSeenAt))[0] || null;

export const shouldClearRoomAfterSnapshotError = (code?: string): boolean => code === 'not-found';

export interface PendingRequest {
    id: string;
    uid: string;
    playerName: string;
    type: 'payday' | 'insurance' | 'happiness' | 'promotion' | 'lifelong' | 'board_share' | 'family_milestone';
    amount: number;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    insuranceType?: 'medical' | 'aircraft';
    happinessLabel?: string;
    promotionType?: string;
    boardCardId?: string;
    shareLabel?: string;
    boardEventId?: string;
    familyStageProgressId?: string;
    sessionId?: string;
}

const PENDING_REQUEST_DOCUMENT_PREFIX = 'request_';

const sanitizePendingRequestIdPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const buildPendingRequestId = (
    request: Pick<PendingRequest, 'uid' | 'type' | 'boardEventId' | 'boardCardId'>,
    sessionId?: string
) => [
    PENDING_REQUEST_DOCUMENT_PREFIX,
    sessionId || 'room',
    request.type,
    request.uid,
    request.boardEventId || 'no-event',
    request.boardCardId || 'no-card'
].map(sanitizePendingRequestIdPart).join('_');

export const isPendingRequestDocumentId = (requestId: string) => requestId.startsWith(PENDING_REQUEST_DOCUMENT_PREFIX);

export type BoardFinancialMutationResult = {
    status: 'applied' | 'duplicate' | 'requires_funding' | 'failed';
    shortfall?: number;
    message?: string;
};

export type BoardDiceRollResult = {
    roll: number;
    dice: number[];
    total: number;
    target?: number;
    success?: boolean;
    bonus?: number;
    newTitle?: string;
    presentationDurationMs?: number;
};

export type BoardCardRevealResult = {
    familyPrompt: 'opened' | 'no_target' | 'not_required';
    sharedPrompt: 'opened' | 'no_target' | 'not_required';
};

export const getPendingRequestExecutionKey = (request: Pick<PendingRequest, 'id' | 'uid' | 'type' | 'timestamp' | 'boardEventId' | 'boardCardId'>) =>
    [request.type, request.uid, request.boardEventId || 'no-event', request.boardCardId || 'no-card', request.timestamp || request.id].join(':');

export const applyApprovedHappinessStory = (
    state: GameState,
    request: Pick<PendingRequest, 'uid' | 'boardEventId' | 'boardCardId' | 'happinessLabel'>,
    points: number,
    timestamp = Date.now()
): { state: GameState; duplicate: boolean } => {
    const operationId = `happiness-share:${request.boardEventId}:${request.uid}`;
    if ((state.appliedBoardFinancialEventIds || []).includes(operationId)) {
        return { state, duplicate: true };
    }
    const happiness = [...(state.happiness || []), {
        id: operationId,
        label: request.happinessLabel || '幸福回憶',
        points,
        checked: true,
        isCustom: true
    }];
    const nextState: GameState = {
        ...state,
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        completedHappinessEvents: Array.from(new Set([
            ...(state.completedHappinessEvents || []),
            ...(request.boardCardId ? [request.boardCardId] : [])
        ])),
        appliedBoardFinancialEventIds: [...(state.appliedBoardFinancialEventIds || []), operationId],
        history: [...(state.history || []), {
            id: operationId,
            timestamp,
            name: `幸福卡：${request.happinessLabel || '幸福回憶'}`,
            amount: points,
            sourceLabel: '幸福卡',
            usageLabel: '幸福事件',
            cashChange: 0,
            balance: state.cash,
            boardEventId: operationId,
            details: JSON.stringify({ usage: 'happiness_event', boardEventId: operationId, sourceCardId: request.boardCardId }),
            flowType: '生活'
        }]
    };
    return { state: nextState, duplicate: false };
};

export interface Room {
    id: string; // 房間碼 (6位數)
    name?: string; // 房間標題
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    members: RoomMember[];
    memberUids?: string[];
    createdAt: any;
    maxPlayers: number;
    closedPlayerSlots?: number[];
    duration?: number; // 遊戲時長 (分鐘)
    gameTimeLeft?: number; // 剩餘秒數
    isTimerPaused?: boolean; // 計時器是否暫停
    timerEndsAtMs?: number | null; // 執行師控制的計時基準，避免依賴瀏覽器 tick
    // Legacy only: new rooms store full states in rooms/{roomId}/players/{uid}.
    // RoomContext hydrates this field locally with only the states the caller may read.
    playerStates?: Record<string, GameState>;
    publicPlayerStates?: Record<string, PublicPlayerState>;
    startedAt?: number; // 遊戲開始時間戳
    sessionId?: string; // 穩定的遊戲場次 ID
    syncSchemaVersion?: number;
    isBoardGame?: boolean; // 棋盤遊戲模式
    isPractice?: boolean; // 練習模式（不計分）
    marketPrices?: Record<string, number>; // 股市價格
    previousMarketPrices?: Record<string, number>; // 前一次股市價格
    marketUpdates?: {
        updates: Record<string, number>;
        code: string;
        isBubble: boolean;
        timestamp: number;
    };
    pendingRequests?: Record<string, PendingRequest>;
    boardState?: BoardState | null;
    presenceStates?: Record<string, PresenceState>;
    financialAcceleration?: FinancialAccelerationState;
    financialSubsidy?: FinancialSubsidyState;
}

export const getCarPurchaseGateError = (
    room: Pick<Room, 'status' | 'members' | 'memberUids' | 'playerStates'>,
    uid: string
): string | null => {
    const isRoomMember = room.memberUids?.includes(uid)
        || room.members.some(member => member.uid === uid && !member.isLeft)
        || !!room.playerStates?.[uid];
    if (!isRoomMember) return '目前帳號尚未同步為房間玩家，請重新加入房間後再購買';

    if (room.status !== 'playing') return '目前遊戲尚未開始或已結束，無法購買汽車';
    return null;
};

export const shouldAcceptBoardSnapshot = (
    previous: Pick<Room, 'id' | 'sessionId' | 'boardState'> | null | undefined,
    next: Pick<Room, 'id' | 'sessionId' | 'boardState'>
): boolean => {
    if (!previous || previous.id !== next.id || !previous.boardState || !next.boardState) return true;
    if (previous.sessionId !== next.sessionId) return true;

    const previousRevision = Number(previous.boardState.revision);
    const nextRevision = Number(next.boardState.revision);
    if (Number.isFinite(previousRevision) && Number.isFinite(nextRevision)) {
        if (nextRevision < previousRevision) return false;
        if (nextRevision > previousRevision) return true;
    }

    const previousUpdatedAt = Number(previous.boardState.updatedAt);
    const nextUpdatedAt = Number(next.boardState.updatedAt);
    return !Number.isFinite(previousUpdatedAt) ||
        !Number.isFinite(nextUpdatedAt) ||
        nextUpdatedAt >= previousUpdatedAt;
};

export const mergeRoomSnapshotWithPrivateStates = (snapshotRoom: Room, currentRoom: Room | null): Room => {
    const isSameRoomSession = currentRoom?.id === snapshotRoom.id &&
        currentRoom.sessionId === snapshotRoom.sessionId;
    const snapshotPrompt = snapshotRoom.boardState?.sharedCardPrompt;
    const currentPrompt = currentRoom?.boardState?.sharedCardPrompt;
    const snapshotFamilyPrompt = snapshotRoom.boardState?.familyMilestoneJoinPrompt;
    const currentFamilyPrompt = currentRoom?.boardState?.familyMilestoneJoinPrompt;
    const preserveSubcollectionResponses = isSameRoomSession &&
        snapshotPrompt?.id === currentPrompt?.id &&
        snapshotPrompt?.responseStorage === 'subcollection';
    const preserveFamilySubcollectionResponses = isSameRoomSession &&
        snapshotFamilyPrompt?.id === currentFamilyPrompt?.id &&
        snapshotFamilyPrompt?.responseStorage === 'subcollection';
    const boardState = snapshotRoom.boardState && (preserveSubcollectionResponses || preserveFamilySubcollectionResponses)
        ? {
            ...snapshotRoom.boardState,
            ...(preserveSubcollectionResponses && snapshotPrompt && currentPrompt ? {
                sharedCardPrompt: {
                    ...snapshotPrompt,
                    responses: {
                        ...(snapshotPrompt.responses || {}),
                        ...(currentPrompt.responses || {})
                    }
                }
            } : {}),
            ...(preserveFamilySubcollectionResponses && snapshotFamilyPrompt && currentFamilyPrompt ? {
                familyMilestoneJoinPrompt: {
                    ...snapshotFamilyPrompt,
                    responses: {
                        ...(snapshotFamilyPrompt.responses || {}),
                        ...(currentFamilyPrompt.responses || {})
                    }
                }
            } : {})
        }
        : snapshotRoom.boardState;

    return {
        ...snapshotRoom,
        ...(boardState ? { boardState } : {}),
        ...(isSameRoomSession && currentRoom?.playerStates
            ? { playerStates: currentRoom.playerStates }
            : {})
    };
};

const getRoomSessionScope = (room: Pick<Room, 'id' | 'sessionId'>): string =>
    `${room.id}:${room.sessionId || 'no-session'}`;

const buildHappinessCardMeta = (cardId: string, playerState?: GameState | null) => {
    return buildHappinessCardMetaFromSchema(cardId, playerState);
};

const buildOpportunityCardMeta = (cardId: string) => {
    return buildOpportunityCardMetaFromSchema(cardId);
};

const buildNewsCardMeta = (cardId: string) => {
    return buildNewsCardMetaFromSchema(cardId);
};

export const buildBoardCardResultById = (cardId: string, playerState?: GameState | null): BoardCardResult | null => {
    const meta = cardId.startsWith('H')
        ? buildHappinessCardMeta(cardId, playerState)
        : cardId.startsWith('C')
            ? buildOpportunityCardMeta(cardId)
            : cardId.startsWith('N')
                ? buildNewsCardMeta(cardId)
                : null;
    if (!meta) return null;

    return {
        deck: meta.deck,
        cardId,
        title: meta.title,
        description: meta.description,
        subtitle: meta.subtitle,
        effectLines: meta.effectLines
    };
};

// 保留既有測試與舊呼叫端使用的純 helper；線上寫入流程改用欄位更新，
// 不再把 helper 產生的整份 state 直接覆蓋回 Firestore。
export const withPendingStartupUpgradeAction = (
    playerState: GameState,
    payload: { cardId: string; symbol: string }
) => cleanObject({
    ...playerState,
    pendingStartupUpgradeAction: payload
}) as GameState;

export const withoutPendingStartupUpgradeAction = (playerState: GameState) => cleanObject({
    ...playerState,
    pendingStartupUpgradeAction: undefined
}) as GameState;

export const isCurrentPlayerBankEvent = (boardState: BoardState, playerUid: string): boolean => (
    boardState.currentTurnUid === playerUid &&
    boardState.currentEvent?.type === 'bank' &&
    boardState.currentEvent.playerUid === playerUid
);

const toUsedKey = (deck: keyof Pick<BoardDeckState, 'happiness' | 'opportunity' | 'news'>) => {
    if (deck === 'happiness') return 'usedHappiness';
    if (deck === 'opportunity') return 'usedOpportunity';
    return 'usedNews';
};

export const stockSymbolFromAssetName = (name: string) => {
    const match = name.match(/[A-Z]\d+/);
    return match?.[0] || '';
};

export const hasEligibleCashDividend = (playerState: GameState | undefined, dividendPerShare: Record<string, number>) => {
    if (!playerState) return false;
    return playerState.assets
        .filter(asset => asset.type === '股票' && asset.quantity)
        .some(asset => {
            const symbol = stockSymbolFromAssetName(asset.name);
            return symbol && (dividendPerShare[symbol] || 0) > 0 && (asset.quantity || 0) > 0;
        });
};

export const hasEligibleStockDividend = (playerState: GameState | undefined, dividendRate: Record<string, number>) => {
    if (!playerState) return false;
    return playerState.assets
        .filter(asset => asset.type === '股票' && asset.quantity)
        .some(asset => {
            const symbol = stockSymbolFromAssetName(asset.name);
            const rate = symbol ? (dividendRate[symbol] || 0) : 0;
            return rate > 0 && Math.ceil((asset.quantity || 0) * rate) > 0;
        });
};

const drawBoardCard = (
    deckState: BoardDeckState,
    deck: keyof Pick<BoardDeckState, 'happiness' | 'opportunity' | 'news'>,
    playerState?: GameState | null
) => {
    let activeDeck = [...deckState[deck]];
    let usedDeck = [...deckState[toUsedKey(deck)]];

    if (activeDeck.length === 0) {
        activeDeck = [...usedDeck].sort(() => Math.random() - 0.5);
        usedDeck = [];
    }

    const cardId = activeDeck.shift();
    if (!cardId) return null;

    const card = buildBoardCardResultById(cardId, playerState);
    if (!card) return null;

    usedDeck.push(cardId);

    return {
        card,
        deckState: {
            ...deckState,
            [deck]: activeDeck,
            [toUsedKey(deck)]: usedDeck
        } as BoardDeckState
    };
};

const hasCarAsset = (state?: GameState | null) => {
    return !!state?.assets?.some(asset => asset.type === '汽車' || asset.type === '飛行器');
};

export const resolveBoardDiceCount = (hasCar: boolean, requestedDiceCount?: 1 | 2): 1 | 2 => (
    hasCar && requestedDiceCount !== 1 ? 2 : 1
);

const normalizeMarketPrices = (
    updates: Record<string, number>,
    currentPrices: Record<string, number> = {}
) => Object.fromEntries(
    STOCK_SYMBOLS.map(symbol => [symbol, updates[symbol] ?? currentPrices[symbol] ?? 0])
) as Record<string, number>;
const rollBoardDie = () => Math.floor(Math.random() * 6) + 1;

const BOARD_MOVE_INTRO_DELAY_MS = 600;
const BOARD_MOVE_STEP_DURATION_MS = 380;
const BOARD_MOVE_LANDING_DELAY_MS = 600;
const BOARD_MOVE_STALE_BUFFER_MS = 2000;
// 分段移動（大富翁式）：在「經過事件」停靠後，繼續走剩下步數前的短暫停頓，
// 不需要再等第一次擲骰的骰子動畫時間。
const BOARD_MOVE_CONTINUE_DELAY_MS = 500;
const BOARD_CARD_LOG_LIMIT = 40;
const ROOM_CREATE_TIMEOUT_MS = 10000;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRoomCreateTimeout = <T,>(promise: Promise<T>, message: string): Promise<T> =>
    new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => reject(new Error(message)), ROOM_CREATE_TIMEOUT_MS);
        promise.then(
            value => {
                window.clearTimeout(timeoutId);
                resolve(value);
            },
            error => {
                window.clearTimeout(timeoutId);
                reject(error);
            }
        );
    });

// 注意：第一段移動的 introDelayMs 已內含大螢幕骰子呈現時間。
// （600+3500=4100ms），本身就超過骰子動畫時間，不需要再額外套用下限；
// 分段移動的「繼續走」不需要等骰子動畫，直接照這段實際步數計算即可，
// 不能沿用骰子動畫下限，否則每次接續都會被迫多等 3.5 秒。
const getBoardMovementSettleMs = (movement: {
    path: unknown[];
    stepDurationMs: number;
    introDelayMs: number;
    landingDelayMs: number;
}) => movement.introDelayMs + movement.path.length * movement.stepDurationMs + movement.landingDelayMs;

export const createInitialBoardState = (members: RoomMember[], hostId: string, playerStates?: Record<string, GameState>): BoardState => {
    // 棋盤上該顯示誰，判斷依據是「是不是這個房間的主持人」，而不是帳號的
    // 全域角色（role）。執行師帳號也可能以參與者身分加入別人開的房間，
    // 這種情況下他就是玩家，理應出現在棋盤上；只有真正主持這場遊戲的人
    // （room.hostId）才不需要棋偶。
    const playerMembers = members.filter(member => member.uid !== hostId);
    const turnOrder = playerMembers.map(member => member.uid);
    const positions = Object.fromEntries(turnOrder.map(uid => [uid, 0]));
    const skipTurns = Object.fromEntries(turnOrder.map(uid => [uid, playerStates?.[uid]?.skipTurns || 0]));

    return {
        currentTurnUid: turnOrder[0] || null,
        turnOrder,
        playerPositions: positions,
        skipTurns,
        hasRolledThisTurn: false,
        revision: 0,
        processedCommandIds: [],
        lastRoll: null,
        currentCard: null,
        currentCardReveal: null,
        currentEvent: null,
        pendingEvents: [],
        movement: null,
        familyMilestoneJoinPrompt: null,
        sharedCardPrompt: null,
        deckState: createInitialDeckState(),
        realEstateMarket: [],
        cardLog: [],
        updatedAt: Date.now()
    };
};

// 找出已在 room.members 裡、但因為加入時序競態而漏掉沒被寫進
// boardState.turnOrder 的玩家 uid（例如玩家剛加入、房主端監聽還沒同步到，
// 就被按下開始遊戲）。回傳缺漏的 uid 清單，供補寫使用。
const getMissingTurnOrderPlayerUids = (room: Room): string[] => {
    const boardState = room.boardState;
    if (!boardState || room.status !== 'playing') return [];
    const turnOrderSet = new Set(boardState.turnOrder);
    return room.members
        .filter(member => member.uid !== room.hostId && !turnOrderSet.has(member.uid))
        .map(member => member.uid);
};

const activateBoardQueueEntry = (entry?: BoardQueuedEvent | null) => ({
    currentEvent: entry?.event || null,
    currentCard: entry?.card || null,
    currentCardReveal: entry?.card ? {
        eventId: entry.event.id,
        cardId: entry.card.cardId,
        isRevealed: false
    } : null
});

export const buildBoardCardRevealState = (
    latestRoom: Room,
    eventId: string,
    cardId: string,
    revealedBy: string,
    revealedByName: string,
    now = Date.now()
): { boardState: BoardState; result: BoardCardRevealResult } => {
    const latestBoard = latestRoom.boardState;
    if (!latestBoard) throw new Error('棋盤房間尚未準備完成');

    const familyCard = HAPPINESS_CARD_MAP[cardId];
    const opportunityCard = OPPORTUNITY_CARDS.find(card => card.id === cardId);
    const newsCard = NEWS_CARDS.find(card => card.id === cardId);
    const familyRequired = familyCard?.category === '家庭重要歷程' && !!familyCard.otherPlayersCanJoin;
    let sharedKind: SharedCardPrompt['kind'] | null = null;
    if (opportunityCard) sharedKind = getSharedOpportunityKind(cardId);
    else if (newsCard?.type === 'cash_dividend') sharedKind = 'cash_dividend';
    else if (newsCard?.type === 'stock_dividend') sharedKind = 'stock_dividend';
    else if (newsCard?.type === 'large_enterprise') sharedKind = 'investment';
    else if (newsCard?.type === 'small_business') sharedKind = 'startup_loan';

    let nextBoard: BoardState = {
        ...latestBoard,
        currentCardReveal: { eventId, cardId, isRevealed: true, revealedAt: now, revealedBy },
        cardLog: appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent),
        updatedAt: now
    };
    let familyPrompt: BoardCardRevealResult['familyPrompt'] = familyRequired ? 'no_target' : 'not_required';
    let sharedPrompt: BoardCardRevealResult['sharedPrompt'] = sharedKind ? 'no_target' : 'not_required';

    if (familyRequired) {
        const latestSourceState = latestRoom.playerStates?.[revealedBy];
        const sourceHasCompletedFamily = isFamilyMilestoneComplete(latestSourceState);
        const targetPlayerUids = (latestRoom.members || [])
            .filter(member => member.uid !== latestRoom.hostId && member.uid !== revealedBy && !member.isLeft)
            .filter(member => !isFamilyMilestoneComplete(latestRoom.playerStates?.[member.uid]))
            .map(member => member.uid);
        if (!sourceHasCompletedFamily && targetPlayerUids.length > 0) {
            const latestFamilyStatus = latestSourceState ? getFamilyMilestoneStatus(latestSourceState) : null;
            const currentStage = latestFamilyStatus && latestFamilyStatus.currentStageIndex >= 0
                ? latestFamilyStatus.stages[latestFamilyStatus.currentStageIndex]
                : undefined;
            nextBoard = {
                ...nextBoard,
                familyMilestoneJoinPrompt: {
                    id: `${eventId}_${cardId}_family_join`,
                    sourceEventId: eventId,
                    sourceCardId: cardId,
                    sourcePlayerUid: revealedBy,
                    sourcePlayerName: latestBoard.currentEvent?.playerName || revealedByName || '玩家',
                    sourceStageProgressId: currentStage?.progressId,
                    sourceActionCompleted: false,
                    requiredRoll: familyCard.joinDiceMin || 4,
                    targetPlayerUids,
                    responses: {},
                    responseStorage: latestRoom.syncSchemaVersion === 2 ? 'subcollection' : 'room',
                    createdAt: now
                }
            };
            familyPrompt = 'opened';
        }
    }

    if (sharedKind) {
        const targetPlayerUids = getSharedCardTargetPlayerUids(latestRoom.members || [], latestRoom.hostId || '', revealedBy);
        if (targetPlayerUids.length > 0) {
            nextBoard = {
                ...nextBoard,
                sharedCardPrompt: {
                    id: `${eventId}_${cardId}_shared`,
                    kind: sharedKind,
                    sourceEventId: eventId,
                    sourceCardId: cardId,
                    sourcePlayerUid: revealedBy,
                    sourcePlayerName: latestBoard.currentEvent?.playerName || revealedByName || '玩家',
                    targetPlayerUids,
                    responses: {},
                    responseStorage: latestRoom.syncSchemaVersion === 2 ? 'subcollection' : 'room',
                    createdAt: now
                }
            };
            sharedPrompt = 'opened';
        }
    }

    return { boardState: nextBoard, result: { familyPrompt, sharedPrompt } };
};

export const buildBoardEventAdvanceState = (roomData: Room) => {
    const boardState = roomData.boardState;
    if (!boardState) return null;

    if (hasIncompleteSharedPrompts(boardState)) return null;

    const queue = [...(boardState.pendingEvents || [])];
    const nextEntry = queue.shift() || null;

    if (nextEntry) {
        return cleanObject({
            boardState: {
                ...boardState,
                ...activateBoardQueueEntry(nextEntry),
                familyMilestoneJoinPrompt: undefined,
                sharedCardPrompt: undefined,
                sharedExpenseEffect: null,
                pendingEvents: queue,
                updatedAt: Date.now()
            }
        });
    }

    // 事件佇列清空後，檢查這位玩家是不是還有上一段「經過事件」停靠後
    // 剩下的步數要繼續走（大富翁式的分段移動）；有的話直接接續下一段動畫，
    // 沒有的話回合改由玩家自己按「結束回合」才真正切換，currentTurnUid 維持不變。
    const pendingMovement = boardState.movement;
    if (pendingMovement && !pendingMovement.isActive && pendingMovement.path.length > 0) {
        const { legPath, remainingPath } = splitMovementLeg(pendingMovement.path, pendingMovement.effects);

        return cleanObject({
            boardState: {
                ...boardState,
                ...activateBoardQueueEntry(null),
                familyMilestoneJoinPrompt: undefined,
                sharedCardPrompt: undefined,
                sharedExpenseEffect: null,
                pendingEvents: [],
                movement: {
                    ...pendingMovement,
                    startPosition: boardState.playerPositions?.[pendingMovement.playerUid] ?? pendingMovement.startPosition,
                    path: legPath,
                    remainingPath: remainingPath.length > 0 ? remainingPath : undefined,
                    startedAt: Date.now(),
                    introDelayMs: BOARD_MOVE_CONTINUE_DELAY_MS,
                    isActive: true
                },
                updatedAt: Date.now()
            }
        });
    }

    return cleanObject({
        boardState: {
            ...boardState,
            ...activateBoardQueueEntry(null),
            familyMilestoneJoinPrompt: undefined,
            sharedCardPrompt: undefined,
            sharedExpenseEffect: null,
            pendingEvents: [],
            movement: null,
            updatedAt: Date.now()
        }
    });
};

const buildCompletedFamilyTransition = (
    latestRoom: Room,
    latestBoard: BoardState,
    prompt: FamilyMilestoneJoinPrompt
) => {
    const completedPromptBoard = { ...latestBoard, familyMilestoneJoinPrompt: prompt };
    if (hasIncompleteSharedPrompts(completedPromptBoard)) return null;
    const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
    const nextState = buildBoardEventAdvanceState({
        ...latestRoom,
        boardState: { ...completedPromptBoard, familyMilestoneJoinPrompt: undefined, cardLog: currentCardLog }
    } as Room);
    if (!nextState) return null;

    const { boardState: nextBoardState, playerStates, ...roomPatch } = nextState as any;
    const nextBoard = nextBoardState || latestBoard;
    return {
        boardState: {
            ...nextBoard,
            cardLog: nextBoard.currentCard
                ? appendBoardCardLog({ ...latestBoard, cardLog: currentCardLog }, nextBoard.currentCard, nextBoard.currentEvent)
                : currentCardLog,
            updatedAt: Date.now()
        },
        roomPatch: {
            ...roomPatch,
            ...(playerStates ? { playerStates } : {})
        }
    };
};

export const buildLifelongLearningSuccessState = (
    currentState: GameState,
    learningType: 'enhance_profession' | 'stock_ability' | 'real_estate_ability',
    commandId: string,
    now = Date.now()
): GameState => {
    const currentAssets = Array.isArray(currentState.assets) ? currentState.assets : [];
    const currentAbilities = {
        stockAbilityCount: 0,
        realEstateAbilityCount: 0,
        professionAbilityCount: 0,
        ...(currentState.abilities || {})
    };
    const nextState: GameState = {
        ...currentState,
        abilities: currentAbilities,
        assets: [...currentAssets],
        profession: currentState.profession ? { ...currentState.profession } : currentState.profession
    };
    if (learningType === 'enhance_profession') {
        nextState.abilities.professionAbilityCount = (nextState.abilities.professionAbilityCount || 0) + 1;
        const currentPromo = currentState.profession?.promotions?.[(currentState.currentRankLevel || 1) - 1];
        if (currentPromo && nextState.profession) {
            nextState.currentRankLevel = (currentState.currentRankLevel || 1) + 1;
            nextState.currentRankTitle = currentPromo.rankTitle;
            nextState.profession.salary += currentPromo.bonus;
        }
    } else if (learningType === 'stock_ability') {
        nextState.abilities.stockAbilityCount = (nextState.abilities.stockAbilityCount || 0) + 1;
        nextState.assets = nextState.assets.map(asset => {
            if (asset.type !== '股票' || !asset.quantity) return asset;
            const quantity = asset.quantity * 2;
            return { ...asset, quantity, cost: quantity * (asset.lastPurchasePrice || 0) };
        });
    } else {
        nextState.abilities.realEstateAbilityCount = (nextState.abilities.realEstateAbilityCount || 0) + 1;
    }

    const typeNames = {
        enhance_profession: '增強職業能力',
        stock_ability: '投資股票的能力',
        real_estate_ability: '投資不動產的能力'
    };
    const entry: Transaction = {
        id: commandId,
        timestamp: now,
        name: `終身學習成功：${typeNames[learningType]}`,
        amount: 0,
        sourceLabel: '事件',
        usageLabel: '能力獲得',
        cashChange: 0,
        balance: nextState.cash,
        details: JSON.stringify({
            type: 'lifelong_success',
            learningType,
            oldAbilities: currentAbilities,
            newAbilities: nextState.abilities,
            oldTitle: currentState.currentRankTitle,
            oldRankLevel: currentState.currentRankLevel,
            newRankLevel: nextState.currentRankLevel,
            oldSalary: currentState.profession?.salary || 0,
            newSalary: nextState.profession?.salary || 0,
            oldAssets: currentAssets
        }),
        flowType: '其它'
    };
    return cleanObject({ ...nextState, history: [entry, ...(currentState.history || [])] }) as GameState;
};

const hasSchoolPromotionFee = (state: GameState, eventId: string) =>
    (state.history || []).some(transaction => {
        if (transaction.name !== '升等考試報名費') return false;
        if (transaction.id === `school-fee:${eventId}` || transaction.boardEventId === eventId) return true;
        try {
            const details = transaction.details ? JSON.parse(transaction.details) : null;
            return details?.boardEventId === eventId;
        } catch {
            return false;
        }
    });

export const buildSchoolPromotionState = (
    currentState: GameState,
    success: boolean,
    commandId: string,
    now = Date.now()
): { state: GameState; bonus: number; newTitle: string } => {
    if (!currentState.profession) throw new Error('玩家職業資料尚未同步完成，請重新整理後再試');

    const level = Math.max(1, currentState.currentRankLevel || 1);
    const currentPromo = currentState.profession.promotions?.[level - 1];
    if (!currentPromo) throw new Error('已達最高職業等級，無法再升等');

    const bonus = success ? currentPromo.bonus : 0;
    const nextProfession = success
        ? { ...currentState.profession, salary: currentState.profession.salary + bonus }
        : currentState.profession;
    const nextRankLevel = success ? level + 1 : level;
    const nextTitle = success ? currentPromo.rankTitle : currentState.currentRankTitle;
    const entry: Transaction = {
        id: commandId,
        timestamp: now,
        name: success ? '晉升加薪' : '升等考試未通過',
        amount: bonus,
        sourceLabel: success ? '收入' : '事件',
        usageLabel: success ? '工作收入增加' : '考試結果',
        cashChange: 0,
        balance: currentState.cash,
        details: JSON.stringify({
            type: 'exam_promotion',
            success,
            bonus,
            oldTitle: currentState.currentRankTitle,
            newTitle: nextTitle,
            oldSalary: currentState.profession.salary,
            newSalary: nextProfession.salary,
            oldRankLevel: level,
            newRankLevel: nextRankLevel
        }),
        flowType: '其它'
    };

    return {
        state: cleanObject({
            ...currentState,
            profession: nextProfession,
            currentRankLevel: nextRankLevel,
            currentRankTitle: nextTitle,
            history: [entry, ...(currentState.history || [])]
        }) as GameState,
        bonus,
        newTitle: nextTitle
    };
};

export const appendBoardCardLog = (
    boardState: BoardState,
    card: BoardCardResult | null,
    event: BoardEventLog | null
) => {
    if (!card || !event) {
        return boardState.cardLog || [];
    }

    const nextEntry: BoardCardLogEntry = {
        ...card,
        id: `${event.id}_${card.cardId}`,
        eventId: event.id,
        playerUid: event.playerUid,
        playerName: event.playerName,
        summary: event.summary,
        drawnAt: event.timestamp
    };

    return [
        nextEntry,
        ...(boardState.cardLog || []).filter(entry => entry.id !== nextEntry.id)
    ].slice(0, BOARD_CARD_LOG_LIMIT);
};

export const buildDirectHappinessCardState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    const payload = txData.happinessEventPayload;
    if (!payload) throw new Error('幸福卡結果資料尚未準備完成');
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;

    const completedHappinessEvents = Array.from(new Set([
        ...(currentState.completedHappinessEvents || []),
        payload.id,
        ...(payload.progressId ? [payload.progressId] : []),
        ...(payload.sourceCardId ? [payload.sourceCardId] : [])
    ]));
    const happiness = [...(currentState.happiness || [])];
    const happinessItemId = payload.happinessItemId;
    const existingItemIndex = happinessItemId
        ? happiness.findIndex(item => item.id === happinessItemId)
        : -1;

    if (existingItemIndex >= 0) {
        happiness[existingItemIndex] = { ...happiness[existingItemIndex], checked: true };
    } else {
        happiness.push({
            id: `${commandId}:happiness`,
            label: payload.name,
            points: payload.points,
            checked: true,
            isCustom: true
        });
    }

    const category = payload.expenseCategory === 'basicLiving' || payload.expenseCategory === 'transportEdu' || payload.expenseCategory === 'otherMedicalChild'
        ? payload.expenseCategory
        : null;
    const nextCash = currentState.cash + (Number(txData.cashChange) || 0);
    const nextExpenses = category && payload.monthlyExpenseChange
        ? { ...currentState.expenses, [category]: (currentState.expenses[category] || 0) + payload.monthlyExpenseChange }
        : currentState.expenses;

    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name,
        amount: Number(txData.amount) || 0,
        sourceLabel: '幸福卡',
        usageLabel: '幸福事件',
        cashChange: Number(txData.cashChange) || 0,
        balance: nextCash,
        boardEventId: commandId,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '生活'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        expenses: nextExpenses,
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        completedHappinessEvents,
        appliedBoardFinancialEventIds: [
            ...(currentState.appliedBoardFinancialEventIds || []),
            commandId
        ],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildInsurancePurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    if (txData.usage !== 'insurance' || !txData.insuranceType || !txData.insurancePayload) {
        throw new Error('保險交易資料尚未準備完成');
    }

    let assets = [...(currentState.assets || [])];
    let medicalInsuranceCount = currentState.medicalInsuranceCount || 0;

    if (txData.insuranceType === 'medical') {
        const quantity = txData.insurancePayload.medicalQty || 0;
        if (quantity < 1 || medicalInsuranceCount >= 1) throw new Error('已持有醫療保險');
        medicalInsuranceCount += quantity;
    } else if (txData.insuranceType === 'house') {
        const targetAssetIds = txData.insurancePayload.targetAssetIds || [];
        if (targetAssetIds.length === 0) throw new Error('未選擇投保房屋');
        const targets = assets.filter(asset => targetAssetIds.includes(asset.id) && asset.type === '不動產');
        if (targets.length !== targetAssetIds.length || targets.some(asset => asset.isInsured)) {
            throw new Error('房屋保險狀態已更新，請重新選擇');
        }
        assets = assets.map(asset => targetAssetIds.includes(asset.id) ? { ...asset, isInsured: true } : asset);
    } else if (txData.insuranceType === 'aircraft') {
        const vehicles = assets.filter(asset => asset.type === '汽車' || asset.type === '飛行器');
        if (vehicles.length === 0 || vehicles.every(asset => asset.isInsured)) throw new Error('目前沒有可投保的汽車');
        assets = assets.map(asset => (asset.type === '汽車' || asset.type === '飛行器') ? { ...asset, isInsured: true } : asset);
    } else {
        throw new Error('不支援的保險類型');
    }

    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name,
        amount: Number(txData.amount) || 0,
        sourceLabel: '保險',
        usageLabel: '購買保險',
        cashChange: Number(txData.cashChange) || 0,
        balance: currentState.cash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '生活'
    };

    return cleanObject({
        ...currentState,
        assets,
        medicalInsuranceCount,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildDepositPurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const sourceAsset = txData.assetChange?.asset;
    const amount = Number(txData.amount || sourceAsset?.value || txData.assetDetails?.downPayment || 0);
    if (amount <= 0 || txData.cashChange >= 0) throw new Error('定存金額無效');
    if (currentState.cash + txData.cashChange < 0) throw new Error('現金不足，無法辦理定存');

    const deposit: Asset = {
        id: sourceAsset?.id || `${commandId}:asset`,
        name: '定存',
        cost: amount,
        downPayment: amount,
        cashflow: Math.floor(amount * 0.01),
        type: '定存'
    };
    const nextCash = currentState.cash + txData.cashChange;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || `定存 ${amount.toLocaleString()}`,
        amount,
        sourceLabel: '現金',
        usageLabel: '辦理定存',
        cashChange: txData.cashChange,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), deposit],
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildStockTradeState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    if (!txData.stockList?.length || (txData.usage !== 'asset' && txData.usage !== 'cash')) {
        throw new Error('股票交易資料尚未準備完成');
    }

    const isBuy = txData.usage === 'asset';
    const assets = [...(currentState.assets || [])];
    for (const trade of txData.stockList) {
        const index = assets.findIndex(asset => asset.type === '股票' && extractAssetSymbol(asset.name) === trade.symbol);
        const existing = index >= 0 ? assets[index] : null;
        const existingQuantity = existing?.quantity || existing?.shares || 0;
        if (isBuy) {
            const quantity = existingQuantity + trade.qty;
            const nextAsset: Asset = existing
                ? { ...existing, quantity, shares: quantity, lastPurchasePrice: trade.price, cost: quantity * trade.price }
                : {
                    id: `${commandId}:${trade.symbol}`,
                    name: getStockAssetLabel(trade.symbol),
                    cost: trade.price * trade.qty,
                    downPayment: trade.price * trade.qty,
                    cashflow: 0,
                    type: '股票',
                    quantity: trade.qty,
                    shares: trade.qty,
                    lastPurchasePrice: trade.price
                };
            if (existing) assets[index] = nextAsset;
            else assets.push(nextAsset);
        } else {
            if (!existing || existingQuantity < trade.qty) throw new Error(`${trade.symbol} 持有張數不足`);
            const remaining = existingQuantity - trade.qty;
            if (remaining === 0) assets.splice(index, 1);
            else assets[index] = { ...existing, quantity: remaining, shares: remaining, cost: remaining * trade.price, lastPurchasePrice: trade.price };
        }
    }

    const nextCash = currentState.cash + txData.cashChange;
    if (nextCash < 0) throw new Error('現金不足，無法買入股票');
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name,
        amount: Number(txData.amount) || 0,
        sourceLabel: isBuy ? '現金' : '投資回收',
        usageLabel: isBuy ? '買入股票' : '賣出股票',
        cashChange: txData.cashChange,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildLoanBorrowState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const amount = Number(txData.amount) || 0;
    if (txData.usage !== 'loan' || txData.source !== 'cash' || amount <= 0 || txData.cashChange !== amount) {
        throw new Error('信用貸款資料尚未準備完成');
    }

    const nextCash = currentState.cash + amount;
    const liability = {
        id: commandId,
        name: '信用貸款',
        totalOwed: amount,
        monthlyPayment: Math.floor(amount * 0.1),
        type: '信用貸款' as const
    };
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || '申請信用貸款',
        amount,
        sourceLabel: '借貸',
        usageLabel: '信用貸款',
        cashChange: amount,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '融資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        liabilities: [...(currentState.liabilities || []), liability],
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildLoanRepaymentState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const amount = Number(txData.amount) || 0;
    if (txData.usage !== 'liability' || txData.source !== 'cash' || amount <= 0 || txData.cashChange !== -amount) {
        throw new Error('還款資料尚未準備完成');
    }
    if (currentState.cash < amount) throw new Error('現金不足，無法完成還款');

    let liabilities = [...(currentState.liabilities || [])];
    let legacyLoans = currentState.loans || 0;
    if (txData.liabilityId === 'multiple_credit_loans') {
        let remaining = amount;
        liabilities = liabilities.map(liability => {
            if (liability.type !== '信用貸款' || remaining <= 0) return liability;
            const paid = Math.min(liability.totalOwed, remaining);
            remaining -= paid;
            const totalOwed = liability.totalOwed - paid;
            return { ...liability, totalOwed, monthlyPayment: Math.floor(totalOwed * 0.1) };
        }).filter(liability => liability.totalOwed > 0);
        if (remaining > 0) {
            const paid = Math.min(legacyLoans, remaining);
            legacyLoans -= paid;
            remaining -= paid;
        }
        if (remaining > 0) throw new Error('目前沒有足夠的信用貸款可償還');
    } else if (txData.liabilityId === 'bank_loan') {
        if (amount > legacyLoans) throw new Error('還款金額不可超過信用貸款總額');
        legacyLoans -= amount;
    } else {
        const index = liabilities.findIndex(liability => liability.id === txData.liabilityId);
        if (index < 0) throw new Error('找不到要償還的貸款資料');
        const target = liabilities[index];
        if (amount > target.totalOwed) throw new Error(`還款金額不可超過 ${target.name} 的剩餘金額`);
        const totalOwed = target.totalOwed - amount;
        if (totalOwed === 0) liabilities.splice(index, 1);
        else liabilities[index] = { ...target, totalOwed, monthlyPayment: getLiabilityMonthlyPayment(target.type, totalOwed) };
    }

    const nextCash = currentState.cash - amount;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || '償還貸款',
        amount,
        sourceLabel: '現金',
        usageLabel: '償還貸款',
        cashChange: -amount,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '融資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        liabilities,
        loans: legacyLoans,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildDepositWithdrawalState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const amount = Number(txData.amount) || 0;
    if (txData.usage !== 'cash' || txData.source !== 'income' || !txData.relatedAssetId || amount <= 0) {
        throw new Error('定存解約資料尚未準備完成');
    }
    const target = currentState.assets.find(asset => asset.id === txData.relatedAssetId && asset.type === '定存');
    const balance = target?.cost || target?.value || 0;
    if (!target || amount > balance) throw new Error('解約金額不可超過定存餘額');

    const remaining = balance - amount;
    const assets = currentState.assets.reduce<Asset[]>((result, asset) => {
        if (asset.id !== txData.relatedAssetId) {
            result.push(asset);
        } else if (remaining > 0) {
            result.push({ ...asset, cost: remaining, downPayment: remaining, cashflow: Math.floor(remaining * 0.01) });
        }
        return result;
    }, []);
    const nextCash = currentState.cash + amount;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || `解約定存 ${amount.toLocaleString()}`,
        amount,
        sourceLabel: '投資回收',
        usageLabel: '解約定存',
        cashChange: amount,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildCarPurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const details = txData.assetDetails;
    const price = Number(txData.amount) || 0;
    if (txData.usage !== 'asset' || details?.type !== '汽車' || price <= 0) throw new Error('汽車交易資料尚未準備完成');
    if (currentState.assets.some(asset => asset.type === '汽車' || asset.type === '飛行器')) throw new Error('目前已經擁有汽車');
    if (currentState.cash + txData.cashChange < 0) throw new Error('現金不足，無法購買汽車');

    const assetId = `${commandId}:asset`;
    const car: Asset = {
        id: assetId,
        name: '汽車',
        cost: price,
        downPayment: details.downPayment || 0,
        cashflow: details.cashflow || 0,
        type: '汽車',
        isInsured: false
    };
    const loanAmount = details.loanAmount || 0;
    const liabilities = loanAmount > 0
        ? [...(currentState.liabilities || []), {
            id: `${commandId}:loan`,
            name: '汽車貸款',
            totalOwed: loanAmount,
            monthlyPayment: details.loanInterest || 0,
            type: '汽車貸款' as const,
            linkedAssetId: assetId
        }]
        : currentState.liabilities;
    const nextCash = currentState.cash + txData.cashChange;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || '買入汽車',
        amount: price,
        sourceLabel: loanAmount > 0 ? '貸款' : '現金',
        usageLabel: '購買汽車',
        cashChange: txData.cashChange,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), car],
        liabilities,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const addRealEstateCardToMarket = (market: string[], cardId: string) =>
    Array.from(new Set([...market, cardId]));

export const isCurrentRealEstatePurchase = (cardId: string, txData: TransactionData) => {
    const card = NEWS_CARD_MAP[cardId];
    const details = txData.assetDetails;
    if (!card || card.type !== 'real_estate' || !details || details.type !== '不動產') return false;

    const isSelfUse = details.isSelfUse === true;
    return txData.source === 'loan' &&
        txData.usage === 'asset' &&
        txData.amount === card.totalPrice &&
        txData.cashChange === -card.downPayment &&
        details.symbol === card.id &&
        details.houseType === card.houseType &&
        details.downPayment === card.downPayment &&
        details.loanAmount === card.loanAmount &&
        details.loanInterest === card.monthlyPayment &&
        details.cashflow === (isSelfUse ? 0 : card.rent) &&
        details.happyPoints === (isSelfUse ? card.happinessBonus : 0) &&
        (card.canSelfUse || !isSelfUse);
};

export const buildRealEstatePurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = Date.now()
): GameState => {
    const details = txData.assetDetails;
    if (!details || details.type !== '不動產') throw new Error('不動產購買資料尚未準備完成');
    if ((Number(currentState.cash) || 0) + txData.cashChange < 0) throw new Error('現金不足，無法購買此房屋');

    const assetId = `${commandId}:asset`;
    const asset = {
        id: assetId,
        name: getRealEstateAssetLabel(details.symbol, details.houseType),
        cost: txData.amount,
        downPayment: details.downPayment || 0,
        cashflow: details.cashflow || 0,
        type: '不動產' as const,
        isSelfUse: details.isSelfUse,
        houseType: details.houseType,
        isInsured: false
    };
    const liability = details.loanAmount && details.loanAmount > 0 ? {
        id: `${assetId}:loan`,
        name: `不動產貸款 (${details.symbol || ''})`.trim(),
        totalOwed: details.loanAmount,
        monthlyPayment: details.loanInterest || 0,
        type: '不動產貸款' as const,
        linkedAssetId: assetId
    } : null;
    let happiness = currentState.happiness || [];
    if (details.isSelfUse && details.happyPoints && details.happyPoints > 0) {
        const happinessId = details.houseType === '1room' ? 'h_house_1'
            : details.houseType === '2room' ? 'h_house_2'
                : details.houseType === '3room' ? 'h_house_3'
                    : details.houseType === '5room' ? 'h_house_5' : null;
        if (happinessId) happiness = happiness.map(item => item.id === happinessId ? { ...item, checked: true } : item);
    }
    const nextCash = (Number(currentState.cash) || 0) + txData.cashChange;
    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), asset],
        liabilities: liability ? [...(currentState.liabilities || []), liability] : (currentState.liabilities || []),
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [...(currentState.history || []), {
            id: commandId,
            timestamp: now,
            name: txData.name,
            amount: txData.amount,
            sourceLabel: '貸款',
            usageLabel: '不動產',
            cashChange: txData.cashChange,
            balance: nextCash,
            details: JSON.stringify({ ...txData, boardEventId: commandId, createdAssetId: assetId }),
            flowType: '投資'
        } satisfies Transaction]
}) as GameState;
};

export const buildStartupLoanState = (
    currentState: GameState,
    cardId: string,
    commandId: string,
    now = Date.now()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;

    const card = NEWS_CARD_MAP[cardId];
    if (!card || card.type !== 'small_business') throw new Error('創業貸款卡片資料不存在');

    const assetId = `${commandId}:asset`;
    const nextCash = (Number(currentState.cash) || 0) + card.loanAmount - card.investmentPerMonth;
    const asset = {
        id: assetId,
        name: getBusinessAssetLabel(card.id, '兼職工作室'),
        cost: card.investmentPerMonth,
        downPayment: card.investmentPerMonth,
        cashflow: 0,
        type: '企業' as const,
        isInsured: false
    };
    const liability = {
        id: `${assetId}:loan`,
        name: `企業貸款 (${card.id})`,
        totalOwed: card.loanAmount,
        monthlyPayment: card.interestPerMonth,
        type: '企業貸款' as const,
        linkedAssetId: assetId
    };
    const pendingUpgradeQueue = [
        ...(currentState.pendingStartupUpgradeActions || (currentState.pendingStartupUpgradeAction ? [currentState.pendingStartupUpgradeAction] : [])),
        { cardId: card.id, symbol: card.id, assetId }
    ];

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), asset],
        liabilities: [...(currentState.liabilities || []), liability],
        pendingStartupUpgradeAction: pendingUpgradeQueue[0],
        pendingStartupUpgradeActions: pendingUpgradeQueue,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [...(currentState.history || []), {
            id: commandId,
            timestamp: now,
            name: `新聞卡：${card.title}`,
            amount: card.investmentPerMonth,
            sourceLabel: '借貸',
            usageLabel: '買入資產',
            cashChange: card.loanAmount - card.investmentPerMonth,
            balance: nextCash,
            details: JSON.stringify({
                boardEventId: commandId,
                sourceCardId: card.id,
                loanAmount: card.loanAmount,
                investmentPerMonth: card.investmentPerMonth,
                interestPerMonth: card.interestPerMonth,
                createdAssetId: assetId
            }),
            flowType: '投資'
        } satisfies Transaction]
    }) as GameState;
};

export const getPendingStartupUpgradeActions = (currentState: GameState) => {
    const eligibleAssets = currentState.assets.filter(asset => asset.type === '企業' && !asset.isUpgraded);
    const hasLoan = (assetId: string, cardId: string) => currentState.liabilities.some(liability =>
        liability.type === '企業貸款' &&
        (liability.linkedAssetId === assetId || liability.name.includes(cardId))
    );
    const stored = currentState.pendingStartupUpgradeActions?.length
        ? currentState.pendingStartupUpgradeActions
        : currentState.pendingStartupUpgradeAction
            ? [currentState.pendingStartupUpgradeAction]
            : [];
    const claimed = new Set<string>();
    const queue = stored.flatMap(action => {
        const asset = eligibleAssets.find(item =>
            !claimed.has(item.id) &&
            ((action.assetId && item.id === action.assetId) || item.name.includes(action.symbol || action.cardId))
        );
        if (!asset) return [];
        claimed.add(asset.id);
        return [{ ...action, assetId: asset.id }];
    });

    eligibleAssets.forEach(asset => {
        if (claimed.has(asset.id)) return;
        const cardId = asset.name.match(/N05[6-8]/)?.[0];
        if (!cardId || !hasLoan(asset.id, cardId)) return;
        claimed.add(asset.id);
        queue.push({ cardId, symbol: cardId, assetId: asset.id });
    });

    return queue;
};

export const resolveStartupUpgradeTarget = (
    currentState: GameState,
    payload: { assetId: string; cardId: string }
) => {
    const storedQueue = currentState.pendingStartupUpgradeActions?.length
        ? currentState.pendingStartupUpgradeActions
        : currentState.pendingStartupUpgradeAction
            ? [currentState.pendingStartupUpgradeAction]
            : [];
    const pendingQueue = getPendingStartupUpgradeActions(currentState);
    const pendingIndex = pendingQueue.findIndex(action => action.assetId === payload.assetId);
    const fallbackIndex = pendingIndex >= 0
        ? pendingIndex
        : pendingQueue.findIndex(action => action.cardId === payload.cardId);
    const storedPending = pendingQueue[fallbackIndex];
    if (storedPending && storedPending.cardId !== payload.cardId) return null;

    const card = NEWS_CARD_MAP[payload.cardId];
    const pending = storedPending || (card?.type === 'small_business'
        ? { cardId: card.id, symbol: card.id }
        : null);
    if (!pending) return null;

    const matches = (asset: GameState['assets'][number]) => asset.type === '企業' &&
        !asset.isUpgraded &&
        (!pending.symbol || asset.name.includes(pending.symbol));
    const authoritativeAssetId = storedPending?.assetId || payload.assetId;
    const preferredAssetIndex = currentState.assets.findIndex(asset => asset.id === authoritativeAssetId && matches(asset));
    // 舊版本或跨裝置恢復可能保留已失效的 assetId；卡片代號仍是可驗證的
    // 權威線索，允許在同一筆未升級工作室中恢復，避免銀行流程永久卡住。
    const assetIndex = preferredAssetIndex >= 0
        ? preferredAssetIndex
        : currentState.assets.findIndex(matches);
    if (assetIndex < 0) return null;

    const asset = currentState.assets[assetIndex];
    if (!storedPending && !currentState.liabilities.some(liability =>
        liability.type === '企業貸款' &&
        (liability.linkedAssetId === asset.id || liability.name.includes(payload.cardId))
    )) return null;

    const resolvedPending = { ...pending, assetId: ('assetId' in pending && pending.assetId) || asset.id };
    const wasStored = storedQueue.some(action => action.assetId === resolvedPending.assetId);
    return { pending: resolvedPending, asset, assetIndex, pendingIndex: Math.max(0, fallbackIndex), recovered: !wasStored };
};

export const buildStartupUpgradeState = (
    currentState: GameState,
    payload: { assetId: string; cardId: string; diceRoll: number },
    commandId: string,
    now = Date.now()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;

    const target = resolveStartupUpgradeTarget(currentState, payload);
    if (!target) throw new Error('企業升級等待狀態已更新');
    const { pending, assetIndex, pendingIndex } = target;
    if (!Number.isInteger(payload.diceRoll) || payload.diceRoll < 1 || payload.diceRoll > 6) {
        throw new Error('企業升級骰點無效');
    }

    const asset = currentState.assets[assetIndex];

    const symbol = asset.name.match(/[A-Z]\d+/)?.[0] || payload.cardId;
    const addedIncome = payload.diceRoll * 10000;
    const upgradedAsset = {
        ...asset,
        name: `小型企業 (${symbol})`,
        cashflow: (asset.cashflow || 0) + addedIncome,
        isUpgraded: true
    };
    const linkedLiability = currentState.liabilities.find(liability =>
        liability.linkedAssetId === asset.id || liability.name === `企業貸款 (${symbol})`
    );
    const nextAssets = [...currentState.assets];
    nextAssets[assetIndex] = upgradedAsset;

    const pendingUpgradeQueue = getPendingStartupUpgradeActions(currentState)
        .filter((_, index) => index !== pendingIndex);

    return cleanObject({
        ...currentState,
        assets: nextAssets,
        liabilities: currentState.liabilities.filter(liability => liability !== linkedLiability),
        pendingStartupUpgradeAction: pendingUpgradeQueue[0],
        pendingStartupUpgradeActions: pendingUpgradeQueue.length > 0 ? pendingUpgradeQueue : undefined,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [{
            id: commandId,
            timestamp: now,
            name: `📈 企業升級：${symbol}`,
            amount: 0,
            sourceLabel: '企業事件',
            usageLabel: '資產升級',
            cashChange: 0,
            balance: currentState.cash,
            details: JSON.stringify({
                type: 'biz_upgrade',
                assetId: asset.id,
                cardId: payload.cardId,
                symbol,
                diceRoll: payload.diceRoll,
                addedIncome,
                oldCashflow: asset.cashflow,
                removedLiability: linkedLiability || null
            }),
            flowType: '投資'
        } satisfies Transaction, ...(currentState.history || [])]
}) as GameState;
};

export const buildTargetEnterprisePurchaseState = (
    currentState: GameState,
    data: TransactionData,
    commandId: string,
    now = Date.now()
): { status: BoardFinancialMutationResult['status']; state?: GameState; shortfall?: number; message?: string } => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return { status: 'duplicate', state: currentState };
    const enterprise = currentState.selectedEnterprise;
    if (!enterprise || data.usage !== 'asset' || data.assetDetails?.type !== '企業' || data.amount !== enterprise.cost || data.cashChange !== -enterprise.cost) {
        return { status: 'failed', message: '目標企業資料已更新，請重新開啟購買視窗' };
    }
    if (currentState.happiness.some(item => item.id === 'h_career' && item.checked)) {
        return { status: 'duplicate', state: currentState };
    }

    const forcedDebtAmount = Number(data.forcedDebtAmount || 0);
    const fundingLoanAmount = Number(data.fundingLoanAmount || 0);
    if (!Number.isInteger(forcedDebtAmount) || forcedDebtAmount < 0 || !Number.isInteger(fundingLoanAmount) || fundingLoanAmount < 0 || (forcedDebtAmount > 0 && fundingLoanAmount > 0)) {
        return { status: 'failed', message: '周轉金額無效，請重新操作' };
    }
    if (fundingLoanAmount > getRemainingCreditCapacity(currentState.profession?.salary || 0, currentState.liabilities, currentState.loans)) {
        return { status: 'failed', message: '信貸額度不足，請改用其他周轉方式' };
    }
    const nextCash = currentState.cash - enterprise.cost + forcedDebtAmount + fundingLoanAmount;
    if (nextCash < 0) return { status: 'requires_funding', shortfall: Math.abs(nextCash) };

    const assetId = `${commandId}:asset`;
    const bonusPercent = currentState.profession?.id === enterprise.relatedProfessionId
        ? currentState.currentRankLevel * 10
        : 0;
    const cashflow = enterprise.income + Math.floor(enterprise.income * bonusPercent / 100);
    const fundingId = `${commandId}:funding`;
    const liabilities = [...currentState.liabilities];
    const history = [...currentState.history];
    if (forcedDebtAmount > 0 || fundingLoanAmount > 0) {
        const amount = forcedDebtAmount || fundingLoanAmount;
        const isCredit = fundingLoanAmount > 0;
        liabilities.push({
            id: fundingId,
            name: isCredit ? '信用貸款' : '強制負債',
            totalOwed: amount,
            monthlyPayment: isCredit ? Math.floor(amount * 0.1) : 0,
            type: isCredit ? '信用貸款' : '強制負債'
        });
        history.push({
            id: fundingId,
            timestamp: now,
            name: `${isCredit ? '借用信用貸款' : '強制計入負債'}：${data.name}`,
            amount,
            sourceLabel: '借貸',
            usageLabel: isCredit ? '信用貸款' : '強制負債',
            cashChange: amount,
            balance: currentState.cash + amount,
            details: JSON.stringify({ boardEventId: commandId }),
            flowType: '融資'
        });
    }
    history.push({
        id: commandId,
        timestamp: now,
        name: data.name,
        amount: enterprise.cost,
        sourceLabel: '資產交易',
        usageLabel: '買入資產',
        cashChange: -enterprise.cost,
        balance: nextCash,
        details: JSON.stringify({ ...data, createdAssetId: assetId }),
        flowType: '投資'
    });
    const happiness = currentState.happiness.map(item => item.id === 'h_career' ? { ...item, checked: true } : item);
    const { [enterprise.name]: _legacyDuplicateIncome, ...income } = currentState.income;

    return {
        status: 'applied',
        state: cleanObject({
            ...currentState,
            cash: nextCash,
            assets: [...currentState.assets, {
                id: assetId,
                name: getBusinessAssetLabel(enterprise.name, enterprise.name),
                cost: enterprise.cost,
                downPayment: enterprise.cost,
                cashflow,
                type: '企業',
                isInsured: false
            }],
            liabilities,
            income,
            happiness,
            happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
            history,
            appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId]
        }) as GameState
    };
};

export const buildSharedInvestmentState = (
    currentState: GameState,
    cardId: string,
    amount: number,
    commandId: string,
    funding: Pick<TransactionData, 'forcedDebtAmount' | 'fundingLoanAmount'> = {},
    now = Date.now()
): BoardFinancialMutationResult & { state?: GameState } => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return { status: 'duplicate', state: currentState };
    const card = NEWS_CARD_MAP[cardId];
    if (!card || card.type !== 'large_enterprise' || !Number.isInteger(amount) || amount < 1000000 ||
        amount % 1000000 !== 0 || amount > card.maxInvestment) {
        return { status: 'failed', message: '共享投資金額或卡片已更新，請重新選擇' };
    }
    const forcedDebtAmount = Number(funding.forcedDebtAmount || 0);
    const fundingLoanAmount = Number(funding.fundingLoanAmount || 0);
    if (!Number.isInteger(forcedDebtAmount) || forcedDebtAmount < 0 || !Number.isInteger(fundingLoanAmount) || fundingLoanAmount < 0 ||
        (forcedDebtAmount > 0 && fundingLoanAmount > 0)) {
        return { status: 'failed', message: '周轉金額無效，請重新操作' };
    }
    if (fundingLoanAmount > getRemainingCreditCapacity(currentState.profession?.salary || 0, currentState.liabilities, currentState.loans)) {
        return { status: 'failed', message: '信貸額度不足，請改用其他周轉方式' };
    }
    const fundingAmount = forcedDebtAmount || fundingLoanAmount;
    const nextCash = (Number(currentState.cash) || 0) + fundingAmount - amount;
    if (nextCash < 0) return { status: 'requires_funding', shortfall: -nextCash };

    const assetId = `${commandId}:asset`;
    const fundingId = `${commandId}:funding`;
    const history = [...(currentState.history || [])];
    const liabilities = [...(currentState.liabilities || [])];
    if (fundingAmount > 0) {
        const isCredit = fundingLoanAmount > 0;
        liabilities.push({
            id: fundingId,
            name: isCredit ? '信用貸款' : '強制負債',
            totalOwed: fundingAmount,
            monthlyPayment: isCredit ? Math.floor(fundingAmount * 0.1) : 0,
            type: isCredit ? '信用貸款' : '強制負債'
        });
        history.push({
            id: fundingId, timestamp: now,
            name: `${isCredit ? '借用信用貸款' : '強制計入負債'}：新聞卡：${card.title}`,
            amount: fundingAmount, sourceLabel: '借貸', usageLabel: isCredit ? '信用貸款' : '強制負債',
            cashChange: fundingAmount, balance: (Number(currentState.cash) || 0) + fundingAmount,
            details: JSON.stringify({ boardEventId: commandId }), flowType: '融資'
        });
    }
    history.push({
        id: commandId, timestamp: now, name: `新聞卡：${card.title}`,
        amount, sourceLabel: '資產交易', usageLabel: '買入資產', cashChange: -amount, balance: nextCash,
        details: JSON.stringify({ boardEventId: commandId, sourceCardId: card.id, createdAssetId: assetId }), flowType: '投資'
    });
    return {
        status: 'applied',
        state: cleanObject({
            ...currentState,
            cash: nextCash,
            assets: [...(currentState.assets || []), {
                id: assetId, name: getBusinessAssetLabel(card.id, card.businessName),
                cost: amount, downPayment: amount, cashflow: (amount / 1000000) * card.monthlyReturnPerMillion,
                type: '企業', isInsured: false
            }],
            liabilities, history,
            appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId]
        }) as GameState
    };
};

export const buildVehicleLossState = (
    currentState: GameState,
    payload: { assetId?: string; claimAmount?: number },
    commandId: string,
    now = Date.now()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;

    const vehicleIndex = currentState.assets.findIndex(asset =>
        (asset.type === '汽車' || asset.type === '飛行器') &&
        (!payload.assetId || asset.id === payload.assetId)
    );
    if (vehicleIndex < 0) throw new Error('目前沒有可移除的汽車');

    const vehicle = currentState.assets[vehicleIndex];
    const claimAmount = Math.max(0, payload.claimAmount || 0);
    const nextCash = (Number(currentState.cash) || 0) + claimAmount;
    const happiness = (currentState.happiness || []).map(item =>
        item.id === 'h_plane' ? { ...item, checked: false } : item
    );

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: currentState.assets.filter((_, index) => index !== vehicleIndex),
        // 原汽車貸款刻意保留，符合 C038 規則。
        liabilities: currentState.liabilities,
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [{
            id: commandId,
            timestamp: now,
            name: '機運卡：天有不測風雲',
            amount: claimAmount,
            sourceLabel: claimAmount > 0 ? '保險理賠' : '機運事件',
            usageLabel: '汽車損失',
            cashChange: claimAmount,
            balance: nextCash,
            details: JSON.stringify({
                boardEventId: commandId,
                removedAssetId: vehicle.id,
                removedAssetName: vehicle.name,
                claimAmount,
                liabilitiesPreserved: true
            }),
            flowType: '其它'
        } satisfies Transaction, ...(currentState.history || [])]
    }) as GameState;
};

export const buildStartupLoanPromptMutation = (
    latestRoom: Room,
    latestBoard: BoardState,
    promptId: string,
    playerUid: string,
    playerName: string,
    commandId: string
) => {
    const prompt = latestBoard.sharedCardPrompt;
    if (
        !prompt ||
        prompt.id !== promptId ||
        prompt.kind !== 'startup_loan' ||
        !prompt.targetPlayerUids.includes(playerUid) ||
        prompt.responses?.[playerUid]?.status === 'declined'
    ) {
        return { boardState: latestBoard, commit: false, result: false };
    }

    const currentState = latestRoom.playerStates?.[playerUid];
    if (!currentState) throw new Error('玩家資料尚未同步完成');

    const card = NEWS_CARD_MAP[prompt.sourceCardId];
    if (!card || card.type !== 'small_business') throw new Error('創業貸款事件資料已更新');

    const nextPlayerState = buildStartupLoanState(currentState, card.id, commandId);
    const response: SharedCardPromptResponse = {
        playerUid,
        playerName,
        status: 'completed',
        amount: card.investmentPerMonth,
        note: '創業貸款已建立',
        respondedAt: Date.now()
    };
    const nextPrompt: SharedCardPrompt = {
        ...prompt,
        responses: {
            ...(prompt.responses || {}),
            [playerUid]: response
        }
    };
    const playerStates = {
        ...(latestRoom.playerStates || {}),
        [playerUid]: nextPlayerState
    };

    if (hasIncompleteSharedPrompts({ ...latestBoard, sharedCardPrompt: nextPrompt })) {
        return {
            boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: Date.now() },
            roomPatch: { playerStates: { [playerUid]: nextPlayerState } },
            sharedResponse: { uid: playerUid, response },
            result: true
        };
    }

    const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
    const nextState = buildBoardEventAdvanceState({
        ...latestRoom,
        playerStates,
        boardState: { ...latestBoard, sharedCardPrompt: undefined, cardLog: currentCardLog }
    });
    if (!nextState?.boardState) throw new Error('創業貸款事件無法結案');

    const { boardState: nextBoardState, playerStates: advancedPlayerStates, ...roomPatch } = nextState;
    return {
        boardState: {
            ...nextBoardState,
            cardLog: nextBoardState.currentCard
                ? appendBoardCardLog({ ...latestBoard, cardLog: currentCardLog }, nextBoardState.currentCard, nextBoardState.currentEvent)
                : currentCardLog,
            updatedAt: Date.now()
        },
        roomPatch: {
            ...roomPatch,
            playerStates: advancedPlayerStates || { [playerUid]: nextPlayerState }
        },
        sharedResponse: { uid: playerUid, response },
        result: true
    };
};

export const buildSharedAssetSalePromptMutation = (
    latestRoom: Room,
    latestBoard: BoardState,
    promptId: string,
    playerUid: string,
    playerName: string,
    selectedAssetIds: string[],
    commandId: string,
    now = Date.now()
) => {
    const prompt = latestBoard.sharedCardPrompt;
    if (
        !prompt ||
        prompt.id !== promptId ||
        prompt.kind !== 'asset_sale' ||
        !prompt.targetPlayerUids.includes(playerUid)
    ) {
        return {
            boardState: latestBoard,
            commit: false,
            result: { status: 'failed' as const, message: '共享出售事件已更新，請重新開啟卡片' }
        };
    }

    if (prompt.responses?.[playerUid]) {
        return { boardState: latestBoard, commit: false, result: { status: 'duplicate' as const } };
    }

    const currentState = latestRoom.playerStates?.[playerUid];
    if (!currentState) throw new Error('玩家資料尚未同步完成');

    const action = resolveBoardCardAction(prompt.sourceCardId, currentState);
    if (action.kind !== 'asset_sale') throw new Error('共享出售卡片資料已更新');

    const uniqueSelectedAssetIds = Array.from(new Set(selectedAssetIds));
    const selectedItems = action.items.filter(item => uniqueSelectedAssetIds.includes(item.id));
    if (
        uniqueSelectedAssetIds.length === 0 ||
        selectedItems.length !== uniqueSelectedAssetIds.length ||
        selectedItems.some(item => !item.selectable)
    ) {
        return {
            boardState: latestBoard,
            commit: false,
            result: { status: 'failed' as const, message: '出售資產已變更，請重新選擇後再試' }
        };
    }

    const totalSellPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);
    const totalLoanBalance = selectedItems.reduce((sum, item) => sum + item.loanBalance, 0);
    const totalCashChange = selectedItems.reduce((sum, item) => sum + item.netCash, 0);
    const selectedLiabilityIds = new Set(
        selectedItems.map(item => item.liability?.id).filter((id): id is string => !!id)
    );
    const nextCash = (Number(currentState.cash) || 0) + totalCashChange;
    const nextPlayerState = cleanObject({
        ...currentState,
        cash: nextCash,
        assets: (currentState.assets || []).filter(asset => !uniqueSelectedAssetIds.includes(asset.id)),
        liabilities: (currentState.liabilities || []).filter(liability => !selectedLiabilityIds.has(liability.id)),
        appliedBoardFinancialEventIds: Array.from(new Set([
            ...(currentState.appliedBoardFinancialEventIds || []),
            commandId
        ])),
        history: [
            ...(currentState.history || []),
            {
                id: commandId,
                timestamp: now,
                name: `卡片出售：${prompt.sourceCardId}`,
                amount: totalSellPrice,
                sourceLabel: '投資回收',
                usageLabel: '解約或出售資產',
                cashChange: totalCashChange,
                balance: nextCash,
                details: JSON.stringify({
                    boardEventId: commandId,
                    sourceCardId: prompt.sourceCardId,
                    totalSellPrice,
                    totalLoanBalance,
                    batchSellList: selectedItems.map(item => ({
                        asset: item.asset,
                        price: item.price,
                        liability: item.liability
                    }))
                }),
                flowType: '投資'
            } satisfies Transaction
        ]
    }) as GameState;

    const response: SharedCardPromptResponse = {
        playerUid,
        playerName,
        status: 'completed',
        amount: totalCashChange,
        selectedAssetIds: uniqueSelectedAssetIds,
        note: '資產出售已完成',
        respondedAt: now
    };
    const nextPrompt: SharedCardPrompt = {
        ...prompt,
        responses: {
            ...(prompt.responses || {}),
            [playerUid]: response
        }
    };

    if (hasIncompleteSharedPrompts({ ...latestBoard, sharedCardPrompt: nextPrompt })) {
        return {
            boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: now },
            roomPatch: { playerStates: { [playerUid]: nextPlayerState } },
            sharedResponse: { uid: playerUid, response },
            result: { status: 'applied' as const }
        };
    }

    const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
    const nextState = buildBoardEventAdvanceState({
        ...latestRoom,
        playerStates: { ...(latestRoom.playerStates || {}), [playerUid]: nextPlayerState },
        boardState: { ...latestBoard, sharedCardPrompt: undefined, cardLog: currentCardLog }
    });
    if (!nextState?.boardState) throw new Error('共享出售事件無法結案');

    const { boardState: nextBoardState, playerStates, ...roomPatch } = nextState as Room;
    return {
        boardState: {
            ...nextBoardState,
            cardLog: nextBoardState.currentCard
                ? appendBoardCardLog({ ...latestBoard, cardLog: currentCardLog }, nextBoardState.currentCard, nextBoardState.currentEvent)
                : currentCardLog,
            updatedAt: now
        },
        roomPatch: {
            ...roomPatch,
            playerStates: playerStates || { [playerUid]: nextPlayerState }
        },
        sharedResponse: { uid: playerUid, response },
        result: { status: 'applied' as const }
    };
};

// 依大富翁式的走法拆段：掃描這段還沒走的步數，找到第一個「經過事件」格
// （銀行/學校/維修廠）就在那裡切一段（legPath），該格之後剩下的步數留到
// 下一段再走（remainingPath）；如果整段都沒有經過事件格，代表這段直接
// 走到真正的終點（remainingPath 為空）。
const splitMovementLeg = (
    steps: number[],
    effects: ReadonlyArray<{ squareIndex: number }> = []
): { legPath: number[]; remainingPath: number[] } => {
    const repairSquares = new Set(effects.map(effect => effect.squareIndex));
    for (let i = 0; i < steps.length - 1; i += 1) {
        const square = getSquareByIndex(steps[i]);
        if (
            square.type === 'bank' ||
            square.type === 'school' ||
            (square.type === 'repair' && repairSquares.has(steps[i]))
        ) {
            return { legPath: steps.slice(0, i + 1), remainingPath: steps.slice(i + 1) };
        }
    }
    return { legPath: steps, remainingPath: [] };
};

const buildBoardMovementLegResolution = (roomData: Room, playerUid: string) => {
    const boardState = roomData.boardState;
    const movement = boardState?.movement;
    if (!boardState || !movement || movement.playerUid !== playerUid) return null;

    const playerState = roomData.playerStates?.[playerUid];
    const movementEffects = movement.effects || buildMovementEffects(
        movement.path,
        hasCarAsset(playerState)
    );
    const nextPosition = movement.path[movement.path.length - 1] ?? movement.startPosition;
    const playerName = roomData.members.find(member => member.uid === playerUid)?.name || '玩家';
    const eventTimestamp = Date.now();
    const nextPlayerStates = { ...(roomData.playerStates || {}) };

    // 這段路徑是否在「經過事件」格停下（而不是走到真正的終點）。
    const isIntermediateStop = !!(movement.remainingPath && movement.remainingPath.length > 0);

    if (isIntermediateStop) {
        const square = getSquareByIndex(nextPosition);
        let event: BoardEventLog;
        let extraFields: Partial<GameState> = {};

        if (square.type === 'bank') {
            event = {
                id: `${playerUid}_${eventTimestamp}_bank`,
                playerUid,
                playerName,
                type: 'bank',
                summary: `${playerName} 經過${square.label}`,
                detail: '先領取月結餘，再決定是否購買保險或定存',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            };
            extraFields = { bankServiceWindowActive: true, bankServiceGrantedAtEventId: event.id };
        } else if (square.type === 'school') {
            event = {
                id: `${playerUid}_${eventTimestamp}_school`,
                playerUid,
                playerName,
                type: 'school',
                summary: `${playerName} 經過${square.label}`,
                detail: '請完成升等考試',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            };
        } else {
            event = {
                id: `${playerUid}_${eventTimestamp}_repair`,
                playerUid,
                playerName,
                type: 'repair',
                summary: `${playerName} 經過維修廠`,
                detail: '經過維修廠，請擲骰決定汽車保養費',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                repairHasCar: true
            };
        }
        const updatedPlayerState = playerState ? cleanObject({
            ...playerState,
            boardPosition: nextPosition,
            lastBoardEvent: event.summary,
            pendingCardAction: event.detail,
            ...extraFields
        }) : undefined;
        if (updatedPlayerState) {
            nextPlayerStates[playerUid] = updatedPlayerState;
        }

        return cleanObject({
            boardState: {
                ...boardState,
                playerPositions: {
                    ...boardState.playerPositions,
                    [playerUid]: nextPosition
                },
                ...activateBoardQueueEntry({ event }),
                pendingEvents: [],
                // 先暫停在這格（isActive:false），記住剩下要走的步數；
                // 事件結案後由 advanceBoardEventQueue 觸發下一段動畫。
                movement: {
                    ...movement,
                    path: movement.remainingPath || [],
                    remainingPath: undefined,
                    isActive: false
                },
                updatedAt: eventTimestamp
            },
            ...(Object.keys(nextPlayerStates).length > 0 ? { playerStates: nextPlayerStates } : {})
        });
    }

    // 這是最後一段：真正走到終點，比照原本落點事件邏輯處理
    // （抽卡／醫院／維修廠停留／學校停留／銀行停留）。
    const nextSkipTurns = { ...boardState.skipTurns };
    let passedBankThisTurn = false;
    const detailMessages: string[] = [];
    const landedSquare = getSquareByIndex(nextPosition);
    let deckState = boardState.deckState;
    const queuedEvents: BoardQueuedEvent[] = [];

    if (landedSquare.type === 'happiness' || landedSquare.type === 'opportunity' || landedSquare.type === 'news') {
        const drawResult = drawBoardCard(deckState, landedSquare.type, playerState);
        if (drawResult) {
            deckState = drawResult.deckState;
            detailMessages.push(`抽到${landedSquare.label}卡：${drawResult.card.title}`);
            queuedEvents.push({
                event: {
                    id: `${playerUid}_${eventTimestamp}_${landedSquare.type}`,
                    playerUid,
                    playerName,
                    type: 'card',
                    summary: `${playerName} 停在${landedSquare.label}`,
                    detail: `抽到${landedSquare.label}卡：${drawResult.card.title}`,
                    squareIndex: nextPosition,
                    timestamp: eventTimestamp,
                    rollTotal: movement.rollTotal
                },
                card: drawResult.card
            });
        }
    } else if (landedSquare.type === 'hospital') {
        const hospitalFeeCoveredByInsurance = (playerState?.medicalInsuranceCount || 0) > 0;
        detailMessages.push(hospitalFeeCoveredByInsurance
            ? '抵達醫院，醫療保險已抵免醫藥費，並暫停一回合'
            : '抵達醫院，請再擲一次骰子決定醫藥費，並暫停一回合');
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_hospital`,
                playerUid,
                playerName,
                type: 'hospital',
                summary: `${playerName} 抵達醫院`,
                detail: hospitalFeeCoveredByInsurance
                    ? '醫療保險已抵免本次醫藥費，仍暫停一回合'
                    : '棋子到達後再擲一次骰子，醫藥費 = 點數 x 1000',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                hospitalSkipTurns: landedSquare.pauseTurns || 1,
                hospitalFeeCoveredByInsurance
            }
        });
    } else if (landedSquare.type === 'repair') {
        const hasCar = hasCarAsset(playerState);
        if (hasCarAsset(playerState)) {
            detailMessages.push('踩到維修廠，請擲骰決定保養費，並暫停一回合');
        } else {
            detailMessages.push('踩到維修廠，但目前沒有汽車');
        }
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_repair`,
                playerUid,
                playerName,
                type: 'repair',
                summary: `${playerName} 停留在維修廠`,
                detail: hasCar
                    ? `棋子到達後保養費 = 點數 x 2000，並停回合 1 次`
                    : '目前沒有汽車，本次維修廠無效果',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                repairHasCar: hasCar,
                repairSkipTurns: hasCar ? (landedSquare.pauseTurns || 1) : undefined
            }
        });
    } else if (landedSquare.type === 'school') {
        detailMessages.push('可選擇報名升等考試');
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_school_land`,
                playerUid,
                playerName,
                type: 'school',
                summary: `${playerName} 停留在學校`,
                detail: '請完成升等考試',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            }
        });
    } else if (landedSquare.type === 'bank') {
        passedBankThisTurn = true;
        detailMessages.push('請確認本回合月結餘');
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_bank_land`,
                playerUid,
                playerName,
                type: 'bank',
                summary: `${playerName} 停留在銀行`,
                detail: '先領取月結餘，再決定是否購買保險或定存',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            }
        });
    }

    const event: BoardEventLog = {
        id: `${playerUid}_${eventTimestamp}`,
        playerUid,
        playerName,
        summary: `${playerName} 擲出 ${movement.rollTotal} 點，停在 ${landedSquare.label}`,
        detail: detailMessages.join('｜'),
        squareIndex: nextPosition,
        timestamp: eventTimestamp,
        rollTotal: movement.rollTotal
    };
    const [currentQueueEntry, ...remainingQueue] = queuedEvents;

    const updatedPlayerState = playerState ? cleanObject({
        ...playerState,
        boardPosition: nextPosition,
        skipTurns: nextSkipTurns[playerUid] || 0,
        lastBoardEvent: event.summary,
        pendingCardAction: detailMessages.join('\n'),
        bankServiceWindowActive: passedBankThisTurn ? true : playerState.bankServiceWindowActive,
        bankServiceGrantedAtEventId: passedBankThisTurn ? `${playerUid}_${eventTimestamp}_bank` : playerState.bankServiceGrantedAtEventId
    }) : undefined;

    if (updatedPlayerState) {
        nextPlayerStates[playerUid] = updatedPlayerState;
    }

    // 回合不再於移動/事件結算後自動換人：玩家自己按「結束回合」才會真正切換到
    // 下一位，這裡無論有沒有排隊事件，currentTurnUid 都維持在移動的玩家身上。
    return cleanObject({
        boardState: {
            ...boardState,
            playerPositions: {
                ...boardState.playerPositions,
                [playerUid]: nextPosition
            },
            skipTurns: nextSkipTurns,
            currentTurnUid: playerUid,
            lastRoll: boardState.lastRoll,
            ...activateBoardQueueEntry(currentQueueEntry),
            pendingEvents: remainingQueue,
            movement: null,
            deckState,
            cardLog: appendBoardCardLog(boardState, currentQueueEntry?.card || null, currentQueueEntry?.event || null),
            updatedAt: eventTimestamp
        },
        ...(Object.keys(nextPlayerStates).length > 0 ? { playerStates: nextPlayerStates } : {})
    });
};

interface RoomContextValue {
    room: Room | null;
    isLoadingRoom: boolean;
    error: string | null;
    playerStates: Record<string, GameState>;
    playerStatesHydrated: boolean;
    roomSyncState: 'idle' | 'cached' | 'synced' | 'offline' | 'error';
    connectionState: 'connecting' | 'online' | 'reconnecting' | 'offline';
    isController: boolean;
    presenceStates: Record<string, PresenceState>;
    pendingRequests: Record<string, PendingRequest>;
    createRoom: (settings?: { name: string; maxPlayers: number; duration: number; isPractice?: boolean; isBoardGame?: boolean }) => Promise<string>;
    setRoomPlayerSlotOpen: (slotIndex: number, isOpen: boolean) => Promise<void>;
    joinRoom: (roomCode: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    leaveToLobby: () => Promise<void>;
    startRoomGame: () => Promise<void>;
    finishRoomGame: () => Promise<void>;
    closeRoom: () => Promise<void>;
    updateMarket: (updates: Record<string, number>, code: string, isBubble?: boolean) => Promise<void>;
    adjustPlayerCash: (playerUid: string, amount: number) => Promise<void>;
    adjustPlayerInvestmentIncome: (playerUid: string, amount: number) => Promise<void>;
    adjustPlayerLiability: (playerUid: string, liabilityId: string, adjustments: { totalOwedDelta: number; monthlyPaymentDelta: number; reason: string }) => Promise<void>;
    adjustPlayerExpense: (playerUid: string, category: CoachExpenseCategory, amountDelta: number, reason: string) => Promise<void>;
    updateFinancialAcceleration: (multiplier: FinancialAccelerationMultiplier) => Promise<void>;
    grantFinancialSubsidyToAllPlayers: (amount: number) => Promise<void>;
    updateRoomTimer: (timeLeft: number, isPaused: boolean, timerEndsAtMs?: number | null) => Promise<void>;
    submitRequest: (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>) => Promise<boolean>;
    approveRequest: (requestId: string) => Promise<boolean>;
    rejectRequest: (requestId: string) => Promise<boolean>;
    clearRequest: (requestId: string) => Promise<boolean>;
    rollBoardDice: (diceCount?: 1 | 2) => Promise<{ position: number; detail: string; skipTurns: number; total: number; dice: number[] }>;
    rollRepairFee: (eventId: string) => Promise<{ roll: number; fee: number }>;
    rollHospitalFee: (eventId: string) => Promise<{ roll: number; fee: number }>;
    rollSkillDice: (payload: { kind: 'normal' | 'enhance_profession' | 'stock_ability' | 'real_estate_ability'; sourceEventId?: string }) => Promise<BoardDiceRollResult>;
    rollFamilyMilestoneJoin: (promptId: string, cardId: string) => Promise<{ roll: number; status: 'passed' | 'failed'; presentationReadyAt: number }>;
    rollStartupUpgradeDice: (payload: { assetId: string; cardId: string; stage: 1 | 2; sourceEventId?: string }) => Promise<{ roll: number; eligible?: boolean; presentationDurationMs?: number }>;
    revealBoardCard: (eventId: string, cardId: string) => Promise<BoardCardRevealResult>;
    dismissBoardCard: (eventId: string, cardId: string, addToRealEstateMarket?: boolean) => Promise<boolean>;
    advanceBoardEventQueue: (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup') => Promise<boolean | undefined>;
    endTurn: () => Promise<void>;
    drawPostExamHappinessCard: (success: boolean) => Promise<void>;
    drawBoardFollowupCard: (deck: 'happiness' | 'news', summary: string, detail?: string) => Promise<void>;
    openFamilyMilestoneJoinPrompt: (eventId: string, cardId: string, sourceStageProgressId?: string) => Promise<void>;
    openSharedCardPrompt: (eventId: string, cardId: string) => Promise<'opened' | 'no_target' | false>;
    submitFamilyMilestoneJoinResponse: (payload: {
        promptId: string;
        status: 'passed' | 'failed' | 'declined';
        roll?: number;
        cardId: string;
    }) => Promise<boolean | FamilyMilestoneJoinResponse>;
    clearPendingFamilyMilestoneJoinAction: (promptId: string) => Promise<boolean>;
    markFamilyMilestoneSourceActionCompleted: (promptId: string) => Promise<boolean>;
    completeFamilyMilestoneAction: (payload: { promptId: string; accepted: boolean; forcedDebtAmount?: number; fundingLoanAmount?: number }) => Promise<{
        status: 'applied' | 'duplicate' | 'requires_funding' | 'failed';
        shortfall?: number;
        message?: string;
    }>;
    submitSharedCardPromptResponse: (payload: {
        promptId: string;
        status: 'completed' | 'declined' | 'no_effect';
        amount?: number;
        selectedAssetIds?: string[];
        note?: string;
    }) => Promise<boolean>;
    completeSharedInvestmentAction: (promptId: string, txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeSharedAssetSaleAction: (promptId: string, selectedAssetIds: string[]) => Promise<BoardFinancialMutationResult>;
    completeStartupLoanAction: (promptId: string) => Promise<boolean>;
    completeTargetEnterprisePurchase: (data: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeMedicalBoardCardAction: (eventId: string, cardId: string, txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeDirectHappinessCard: (eventId: string, cardId: string, txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeInsurancePurchase: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeDepositPurchase: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeStockTrade: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeLoanBorrow: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    /** 通用棋盤財務交易：以伺服器交易一次套用純函式 applyBoardTransaction。 */
    completeBoardTransaction: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    /** 棋盤「銀行」事件的每月結餘：金額由伺服器依玩家最新資料重新計算，不信任前端金額。 */
    completePaydayCollection: (boardEventId: string) => Promise<BoardFinancialMutationResult>;
    /** 房屋自住／出租切換。 */
    completeHouseConversion: (assetId: string, toSelfUse: boolean) => Promise<BoardFinancialMutationResult>;
    /** 勾選／取消幸福清單項目。 */
    completeHappinessToggle: (id: string, checked?: boolean) => Promise<BoardFinancialMutationResult>;
    /** 新增自訂幸福項目。 */
    completeHappinessAdd: (label: string, points: number) => Promise<BoardFinancialMutationResult>;
    /** 移除幸福項目。 */
    completeHappinessRemove: (id: string) => Promise<BoardFinancialMutationResult>;
    /** 只寫玩家私有文件（不動房間主文件）：共享／家庭歷程提示進行中，規則不允許一般房間交易時使用。 */
    completePlayerOnlyTransaction: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    /** 共享卡片的財務結算（股利、股息、全體支出）：財務資料與本人回覆在同一筆交易寫入。 */
    completeSharedTransactionAction: (
        promptId: string,
        txData: TransactionData,
        responseMeta: { status: 'completed' | 'no_effect'; amount?: number; note?: string }
    ) => Promise<BoardFinancialMutationResult>;
    completeLoanRepayment: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeDepositWithdrawal: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeCarPurchase: (txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    completeStartupUpgradeAction: (payload: {
        assetId: string;
        cardId: string;
        diceRoll: number;
    }) => Promise<BoardFinancialMutationResult>;
    clearSharedCardPrompt: (promptId: string) => Promise<void>;
    setPendingStartupUpgradeAction: (payload: { cardId: string; symbol: string }) => Promise<boolean>;
    clearPendingStartupUpgradeAction: () => Promise<boolean>;
    applyBoardExpenseToAllPlayers: (payload: {
        amount: number;
        category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
        isIncrease: boolean;
        summary: string;
        detail?: string;
    }) => Promise<void>;
    moveCurrentPlayerToSquare: (payload: {
        squareType: 'school' | 'hospital' | 'bank' | 'repair';
        skipTurns?: number;
        detail?: string;
    }) => Promise<number | null>;
    applyBoardMarketPrices: (updates: Record<string, number>, code: string, isBubble?: boolean) => Promise<void>;
    buyCurrentRealEstateCard: (eventId: string, cardId: string, txData: TransactionData) => Promise<boolean>;
    buyRealEstateFromMarket: (cardId: string, attemptId: string, txData: TransactionData) => Promise<BoardFinancialMutationResult>;
    applyVehicleLoss: (eventId: string, cardId: string, assetId?: string) => Promise<BoardFinancialMutationResult>;
    skipDisconnectedTurn: (playerUid: string) => Promise<void>;
    skipDisconnectedSharedPromptTarget: (playerUid: string) => Promise<void>;
    coachTriggerBoardCard: (playerUid: string, cardId: string) => Promise<void>;
    repeatCurrentBoardEvent: () => Promise<void>;
    setCoachNextTurn: (playerUid: string) => Promise<void>;
    clearCurrentBoardEvent: () => Promise<void>;
    forceEndBoardTurn: () => Promise<void>;
    resyncRoom: () => Promise<void>;
    retryStaleBoardMovement: () => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [room, setRoom] = useState<Room | null>(null);
    const [isLoadingRoom, setIsLoadingRoom] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerStates, setPlayerStates] = useState<Record<string, GameState>>({});
    const [playerStatesHydrated, setPlayerStatesHydrated] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<Record<string, PendingRequest>>({});
    const [roomSyncState, setRoomSyncState] = useState<RoomContextValue['roomSyncState']>('idle');
    const [connectionState, setConnectionState] = useState<RoomContextValue['connectionState']>('offline');
    const [isController, setIsController] = useState(true);
    const [presenceStates, setPresenceStates] = useState<Record<string, PresenceState>>({});
    const presenceSessionIdRef = useRef<string | null>(null);
    const presenceConnectionRef = useRef<DatabaseReference | null>(null);
    const realtimeClientIdRef = useRef<string>(getTabClientId());
    const presenceLastOnlineRef = useRef<Record<string, number>>({});
    const presenceConnectionsRef = useRef<unknown>({});
    const roomListenerTokenRef = useRef<string | null>(null);
    const lastRoomSnapshotHashRef = useRef<string | null>(null);
    const lastAcceptedBoardSnapshotRef = useRef<Pick<Room, 'id' | 'sessionId' | 'boardState'> | null>(null);
    const activeRoomScopeRef = useRef<string | null>(null);
    const lastMeasuredBoardSnapshotRef = useRef<string | null>(null);
    const lastObservedTurnUidRef = useRef<string | null>(null);
    const lastPrivateStatesHashRef = useRef<string | null>(null);
    const legacyPendingRequestIdsRef = useRef<Set<string>>(new Set());
    const subcollectionPendingRequestIdsRef = useRef<Set<string>>(new Set());
    const pendingRequestScopeRef = useRef<string | null>(null);
    const resumeSuppressedRoomRef = useRef<string | null>(null);
    const lastObservedRoomStatusRef = useRef<Room['status'] | null>(null);
    const isClosingRoomRef = useRef(false);
    const finalizingSubcollectionPromptRef = useRef<string | null>(null);

    // ─── Milestone 0.5: Adapter Wiring ───────────────────────────────────────
    // LegacyRoomAdapter 就位，但所有 Feature Flags 為 false，
    // 任何 dispatch 都回傳 null，不接管任何行為。
    // 未來 Milestone 1+ 開始啟用各 System Flag 時，此 adapter 才開始實際分流。
    const coreRoomAdapter = useMemo(
        () => new LegacyRoomAdapter(new CommandGateway(globalGameCoreEngine)),
        []
    );
    // DEV only：確認 Adapter 接線成功（所有 flags = false，不接管任何行為）
    useEffect(() => {
        if (import.meta.env.DEV) {
            console.debug('[RoomContext] coreRoomAdapter ready:', coreRoomAdapter.isReady());
        }
    }, [coreRoomAdapter]);
    // ─────────────────────────────────────────────────────────────────────────

    const isProcessingRef = useRef<boolean>(false);

    const runRoomBoardMutation = async <T, R extends BoardRoomSnapshot>(params: RunRoomBoardMutationParams<T, R>): Promise<T> => {
        if (room?.status === 'playing' && !isController) {
            throw new Error('此帳號已在其他分頁操作，這個分頁目前為唯讀');
        }
        return runRoomBoardMutationOnServer<T, R>(params);
    };

    const canMutateCurrentRoom = (): boolean => {
        if (room?.status === 'playing' && !isController) {
            setError('此帳號已在其他分頁操作，這個分頁目前為唯讀');
            return false;
        }
        return true;
    };

    useEffect(() => {
        if (!user?.uid || !room?.id || !USE_REALTIME_PRESENCE) {
            setConnectionState('offline');
            return;
        }

        const sessionId = `${user.uid}:${Date.now()}`;
        const connectionRef = pushRealtime(realtimeRef(realtimeDb, `roomConnections/${room.id}/${user.uid}`));
        const lastOnlineRef = realtimeRef(realtimeDb, `roomLastOnline/${room.id}/${user.uid}`);
        const connectedRef = realtimeRef(realtimeDb, '.info/connected');
        presenceSessionIdRef.current = sessionId;
        presenceConnectionRef.current = connectionRef;
        setConnectionState('connecting');

        const handleConnection = (snapshot: DataSnapshot) => {
            if (snapshot.val() !== true) {
                setConnectionState(current => current === 'online' ? 'reconnecting' : current);
                return;
            }
            setConnectionState('online');
            void Promise.all([
                onRealtimeDisconnect(connectionRef).remove(),
                onRealtimeDisconnect(lastOnlineRef).set(realtimeServerTimestamp()),
                setRealtime(connectionRef, {
                    uid: user.uid,
                    status: 'online',
                    sessionId,
                    lastSeenAt: realtimeServerTimestamp()
                })
            ]).catch(error => console.error('Realtime Database presence 初始化失敗:', error));
        };
        const unsubscribeConnection = onRealtimeValue(connectedRef, handleConnection);

        // 分頁關閉時移除 connection node；lastOnline 只保留最後離線時間，
        // 不再以 Firestore interval heartbeat 產生週期性讀寫。
        return () => {
            unsubscribeConnection();
            void Promise.all([
                removeRealtime(connectionRef),
                setRealtime(lastOnlineRef, realtimeServerTimestamp()),
            ]).catch(error => console.error('清理即時連線狀態失敗:', error));
            presenceConnectionRef.current = null;
            setConnectionState('offline');
        };
    }, [room?.id, user?.uid]);

    useEffect(() => {
        if (!user?.uid || !room?.id) {
            setPresenceStates({});
            presenceConnectionsRef.current = {};
            presenceLastOnlineRef.current = {};
            return;
        }
        presenceConnectionsRef.current = {};
        presenceLastOnlineRef.current = {};

        const updatePresence = () => {
            setPresenceStates(mapRealtimePresenceValue(presenceConnectionsRef.current, presenceLastOnlineRef.current));
        };
        const unsubscribeConnections = onRealtimeValue(
            realtimeRef(realtimeDb, `roomConnections/${room.id}`),
            snapshot => {
                presenceConnectionsRef.current = snapshot.val() || {};
                updatePresence();
            },
            error => console.error('監聽 Realtime Database 玩家連線狀態失敗:', error)
        );
        const unsubscribeLastOnline = Array.from(new Set(room.members.map(member => member.uid))).map(uid =>
            onRealtimeValue(
                realtimeRef(realtimeDb, `roomLastOnline/${room.id}/${uid}`),
                snapshot => {
                    const lastOnline = Number(snapshot.val());
                    if (Number.isFinite(lastOnline)) presenceLastOnlineRef.current[uid] = lastOnline;
                    else delete presenceLastOnlineRef.current[uid];
                    updatePresence();
                },
                error => console.error(`監聽玩家 ${uid} 最後離線時間失敗:`, error)
            )
        );
        return () => {
            unsubscribeConnections();
            unsubscribeLastOnline.forEach(unsubscribe => unsubscribe());
        };
        }, [room?.id, user?.uid, room?.members.map(member => member.uid).sort().join('|')]);

    // 同一帳號多分頁時，每個分頁使用獨立 claim；最新 claim 取得控制權。
    // claim 綁定 onDisconnect，異常關閉分頁後不會把舊控制權留在房間裡。
    useEffect(() => {
        if (!user?.uid || !room?.id) {
            setIsController(true);
            return;
        }
        setIsController(false);
        const controllerRootRef = realtimeRef(realtimeDb, `roomControllers/${room.id}/${user.uid}`);
        const clientId = realtimeClientIdRef.current;
        const controllerRef = realtimeRef(realtimeDb, `roomControllers/${room.id}/${user.uid}/${clientId}`);
        const claim = { clientId, claimedAt: Date.now(), lastSeenAt: Date.now() };
        void Promise.all([
            onRealtimeDisconnect(controllerRef).remove(),
            setRealtime(controllerRef, claim)
        ]).catch(error => console.error('取得分頁控制權失敗:', error));
        const unsubscribe = onRealtimeValue(controllerRootRef, snapshot => {
            const latestClaim = selectActiveControllerClaim(
                Object.values((snapshot.val() || {}) as Record<string, RoomControllerClaim>)
            );
            setIsController(latestClaim?.clientId === clientId);
        }, error => {
            console.error('監聽分頁控制權失敗:', error);
            setIsController(false);
        });
        const heartbeatId = window.setInterval(() => {
            void setRealtime(controllerRef, {
                ...claim,
                lastSeenAt: Date.now()
            }).catch(error => console.error('更新分頁控制權心跳失敗:', error));
        }, CONTROLLER_CLAIM_HEARTBEAT_MS);
        return () => {
            unsubscribe();
            window.clearInterval(heartbeatId);
            void removeRealtime(controllerRef).catch(error => console.error('清理分頁控制權失敗:', error));
        };
    }, [room?.id, user?.uid]);
    const executeWithLock = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
        if (room?.status === 'playing' && !isController) {
            setError('此帳號已在其他分頁操作，這個分頁目前為唯讀');
            return undefined;
        }
        if (isProcessingRef.current) return undefined;
        isProcessingRef.current = true;
        try {
            return await action();
        } finally {
            isProcessingRef.current = false;
        }
    };

    const finalizeSubcollectionSharedPrompt = useCallback(async (roomId: string, promptId: string) => {
        if (finalizingSubcollectionPromptRef.current === promptId) return;
        finalizingSubcollectionPromptRef.current = promptId;
        try {
            await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomRef = doc(db, 'rooms', roomId);
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) return;
                const latestRoom = roomSnapshot.data() as Room;
                const latestBoard = latestRoom.boardState;
                const prompt = latestBoard?.sharedCardPrompt;
                if (!latestBoard || !prompt || prompt.id !== promptId || prompt.responseStorage !== 'subcollection') return;

                const responseSnapshots = await Promise.all(
                    prompt.targetPlayerUids.map(uid =>
                        transaction.get(doc(db, 'rooms', roomId, 'events', promptId, 'responses', uid))
                    )
                );
                const responses = {
                    ...(prompt.responses || {}),
                    ...Object.fromEntries(
                        responseSnapshots
                            .filter(snapshot => snapshot.exists())
                            .map(snapshot => [snapshot.id, snapshot.data() as SharedCardPromptResponse])
                    )
                };
                if (prompt.targetPlayerUids.some(uid => !responses[uid])) return;

                const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
                const nextState = buildBoardEventAdvanceState({
                    ...latestRoom,
                    boardState: {
                        ...latestBoard,
                        sharedCardPrompt: { ...prompt, responses },
                        cardLog: currentCardLog
                    }
                } as Room);
                if (!nextState?.boardState) return;

                const nextBoard = nextState.boardState.currentCard
                    ? {
                        ...nextState.boardState,
                        cardLog: appendBoardCardLog(
                            { ...latestBoard, cardLog: currentCardLog },
                            nextState.boardState.currentCard,
                            nextState.boardState.currentEvent
                        )
                    }
                    : { ...nextState.boardState, cardLog: currentCardLog };
                transaction.update(roomRef, {
                    boardState: applyBoardCommand(nextBoard, `prompt:shared:finalize:${promptId}`).boardState
                });
            }));
        } catch (error) {
            console.error('共享卡片 response 結案失敗:', error);
        } finally {
            finalizingSubcollectionPromptRef.current = null;
        }
    }, []);

    const executeBoardRevealWithRetry = async <T,>(action: () => Promise<T>): Promise<T> => {
        const retryLimit = 20;
        for (let attempt = 0; attempt < retryLimit; attempt += 1) {
            if (isProcessingRef.current) {
                await new Promise(resolve => window.setTimeout(resolve, 50));
                continue;
            }

            const completed = await executeWithLock(action);
            if (completed !== undefined && completed !== false) return completed;
        }

        throw new Error('翻牌同步逾時，請再試一次');
    };

    // 補救措施：即使開始遊戲時已改用 transaction 讀最新 room.members，仍有極小
    // 機率因為加入房間的玩家端寫入還沒真正落地到 Firestore（樂觀本地更新先於
    // 真正 write 完成）而錯過。這裡由房主端持續監看，只要偵測到 room.members
    // 裡有玩家不在 boardState.turnOrder 內，就自動補寫，避免棋盤永久漏人。
    const isHealingTurnOrderRef = useRef<boolean>(false);
    const isHealingStalePromptRef = useRef<boolean>(false);
    const isMigratingLegacyStateRef = useRef<boolean>(false);
    const migrateLegacyPlayerStates = useCallback(async (snapshotRoom: Room) => {
        if (isMigratingLegacyStateRef.current) return;
        if (snapshotRoom.hostId !== user?.uid || !snapshotRoom.playerStates || Object.keys(snapshotRoom.playerStates).length === 0) return;

        isMigratingLegacyStateRef.current = true;
        try {
            await safeAsync(runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomRef = doc(db, 'rooms', snapshotRoom.id);
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;
                const currentRoom = roomDoc.data() as Room;
                if (!currentRoom.playerStates || Object.keys(currentRoom.playerStates).length === 0) return;

                const publicPlayerStates = Object.fromEntries(
                    Object.entries(currentRoom.playerStates).map(([uid, state]) => [uid, toPublicPlayerState(uid, state)])
                );
                Object.entries(currentRoom.playerStates).forEach(([uid, state]) => {
                    transaction.set(doc(db, 'rooms', snapshotRoom.id, 'players', uid), cleanObject(state));
                });
                transaction.update(roomRef, {
                    publicPlayerStates,
                    playerStates: deleteField()
                });
            })));
        } finally {
            isMigratingLegacyStateRef.current = false;
        }
    }, [user?.uid]);
    const healMissingTurnOrderPlayers = useCallback(async (snapshotRoom: Room) => {
        if (isHealingTurnOrderRef.current) return;
        if (snapshotRoom.hostId !== user?.uid) return;
        if (getMissingTurnOrderPlayerUids(snapshotRoom).length === 0) return;

        isHealingTurnOrderRef.current = true;
        try {
            await safeAsync(runBoardTransactionWithRetry(() => runTransaction(db, async (transaction) => {
                const roomRef = doc(db, 'rooms', snapshotRoom.id);
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;
                const currentRoom = roomDoc.data() as Room;
                const missingUids = getMissingTurnOrderPlayerUids(currentRoom);
                if (!missingUids.length || !currentRoom.boardState) return;

                console.warn('偵測到玩家不在棋盤 turnOrder 內，自動補齊:', missingUids);
                const boardState = currentRoom.boardState;
                const nextTurnOrder = [...boardState.turnOrder, ...missingUids];
                const nextPositions = { ...boardState.playerPositions };
                const nextSkipTurns = { ...boardState.skipTurns };
                missingUids.forEach(uid => {
                    nextPositions[uid] = nextPositions[uid] ?? 0;
                    nextSkipTurns[uid] = nextSkipTurns[uid] ?? (currentRoom.playerStates?.[uid]?.skipTurns || 0);
                });

                transaction.update(roomRef, {
                    'boardState.turnOrder': nextTurnOrder,
                    'boardState.playerPositions': nextPositions,
                    'boardState.skipTurns': nextSkipTurns,
                    'boardState.currentTurnUid': boardState.currentTurnUid ?? nextTurnOrder[0] ?? null
                });
            })));
        } finally {
            isHealingTurnOrderRef.current = false;
        }
    }, [user?.uid]);

    const healStaleBoardPrompts = useCallback(async (snapshotRoom: Room) => {
        if (isHealingStalePromptRef.current || snapshotRoom.hostId !== user?.uid || !snapshotRoom.boardState) return;

        const snapshotBoard = snapshotRoom.boardState;
        const staleFamilyPrompt = snapshotBoard.familyMilestoneJoinPrompt &&
            !isBoardPromptForCurrentEvent(snapshotBoard.familyMilestoneJoinPrompt, snapshotBoard)
            ? snapshotBoard.familyMilestoneJoinPrompt
            : null;
        const staleSharedPrompt = snapshotBoard.sharedCardPrompt &&
            !isBoardPromptForCurrentEvent(snapshotBoard.sharedCardPrompt, snapshotBoard)
            ? snapshotBoard.sharedCardPrompt
            : null;
        const completedFamilyPrompt = snapshotBoard.familyMilestoneJoinPrompt &&
            isBoardPromptForCurrentEvent(snapshotBoard.familyMilestoneJoinPrompt, snapshotBoard) &&
            !hasIncompleteSharedPrompts(snapshotBoard)
            ? snapshotBoard.familyMilestoneJoinPrompt
            : null;
        const hasLegacyFamilyRequests = Object.values(snapshotRoom.pendingRequests || {})
            .some(request => request.type === 'family_milestone');
        if (!staleFamilyPrompt && !staleSharedPrompt && !completedFamilyPrompt && !hasLegacyFamilyRequests) return;

        const stalePromptIds = new Set(
            [staleFamilyPrompt?.id, staleSharedPrompt?.id].filter((id): id is string => !!id)
        );
        const staleEventIds = new Set(
            [staleFamilyPrompt?.sourceEventId, staleSharedPrompt?.sourceEventId].filter((id): id is string => !!id)
        );
        const playerStateUids = Array.from(new Set([
            ...(staleFamilyPrompt?.targetPlayerUids || []),
            staleFamilyPrompt?.sourcePlayerUid,
            ...(staleSharedPrompt?.targetPlayerUids || []),
            staleSharedPrompt?.sourcePlayerUid,
            snapshotBoard.movement?.playerUid
        ].filter((uid): uid is string => !!uid)));

        isHealingStalePromptRef.current = true;
        try {
            await runRoomBoardMutation({
                db,
                roomId: snapshotRoom.id,
                commandId: `repair:board-prompt:${snapshotRoom.sessionId || ''}:${[
                    completedFamilyPrompt?.id || '',
                    ...Array.from(stalePromptIds),
                    ...Object.values(snapshotRoom.pendingRequests || {})
                        .filter(request => request.type === 'family_milestone')
                        .map(getPendingRequestExecutionKey)
                ].sort().join('|')}`,
                playerStateUids,
                onDuplicate: () => false,
                mutate: (latestRoom, latestBoard) => {
                    const latestFamilyPrompt = latestBoard.familyMilestoneJoinPrompt;
                    const latestSharedPrompt = latestBoard.sharedCardPrompt;
                    const shouldCompleteFamily = !!latestFamilyPrompt &&
                        isBoardPromptForCurrentEvent(latestFamilyPrompt, latestBoard) &&
                        !hasIncompleteSharedPrompts(latestBoard);
                    if (shouldCompleteFamily) {
                        const transition = buildCompletedFamilyTransition(latestRoom as Room, latestBoard, latestFamilyPrompt);
                        if (transition) {
                            return {
                                boardState: transition.boardState,
                                roomPatch: transition.roomPatch,
                                result: true
                            };
                        }
                    }
                    const shouldClearFamily = !!latestFamilyPrompt &&
                        !isBoardPromptForCurrentEvent(latestFamilyPrompt, latestBoard);
                    const shouldClearShared = !!latestSharedPrompt &&
                        !isBoardPromptForCurrentEvent(latestSharedPrompt, latestBoard);
                    const nextPendingRequests = Object.fromEntries(
                        Object.entries(latestRoom.pendingRequests || {}).filter(([, request]) =>
                            request.type !== 'family_milestone' &&
                            (!request.boardEventId || !staleEventIds.has(request.boardEventId))
                        )
                    );
                    if (!shouldClearFamily && !shouldClearShared) {
                        const changed = Object.keys(nextPendingRequests).length !== Object.keys(latestRoom.pendingRequests || {}).length;
                        return {
                            boardState: latestBoard,
                            roomPatch: changed ? { pendingRequests: nextPendingRequests } : {},
                            commit: changed,
                            result: changed
                        };
                    }

                    const nextPlayerStates = Object.fromEntries(
                        Object.entries(latestRoom.playerStates || {}).map(([uid, state]) => {
                            const pendingPromptId = state?.pendingFamilyMilestoneJoinAction?.promptId;
                            if (!pendingPromptId || !stalePromptIds.has(pendingPromptId)) return [uid, null];
                            const nextState = { ...state };
                            delete nextState.pendingFamilyMilestoneJoinAction;
                            return [uid, cleanObject(nextState)];
                        }).filter(([, state]) => state !== null)
                    );

                    return {
                        boardState: {
                            ...latestBoard,
                            ...(shouldClearFamily ? { familyMilestoneJoinPrompt: null } : {}),
                            ...(shouldClearShared ? { sharedCardPrompt: null } : {}),
                            updatedAt: Date.now()
                        },
                        roomPatch: {
                            ...(Object.keys(nextPlayerStates).length > 0 ? { playerStates: nextPlayerStates } : {}),
                            ...(Object.keys(nextPendingRequests).length !== Object.keys(latestRoom.pendingRequests || {}).length
                                ? { pendingRequests: nextPendingRequests }
                                : {})
                        },
                        result: true
                    };
                }
            });
        } finally {
            isHealingStalePromptRef.current = false;
        }
    }, [user?.uid]);

    // 重新整理後恢復進行中的房間。只有在房間仍存在、未結束、且自己仍是成員
    // （或房主）時才恢復，避免舊快取把玩家送回已結束或已離開的房間。
    const restoreAttemptedUidRef = useRef<string | null>(null);
    useEffect(() => {
        if (!user?.uid) {
            restoreAttemptedUidRef.current = null;
            return;
        }
        if (room?.id || restoreAttemptedUidRef.current === user.uid) return;
        const persistedRoomId = localStorage.getItem(`active_room_${user.uid}`);
        const resumableRoomId = resumeSuppressedRoomRef.current === user.activeGame?.roomId
            ? undefined
            : user.activeGame?.roomId;
        const candidateRoomId = persistedRoomId || resumableRoomId;
        if (!candidateRoomId) return;
        restoreAttemptedUidRef.current = user.uid;

        let cancelled = false;
        void (async () => {
            try {
                const snapshot = await getDoc(doc(db, 'rooms', candidateRoomId));
                if (cancelled) return;
                const clearStale = () => {
                    localStorage.removeItem(`active_room_${user.uid}`);
                    localStorage.removeItem('hf_practice_mode');
                };
                if (!snapshot.exists()) return clearStale();
                const data = snapshot.data() as Room;
                const member = data.members?.find(m => m.uid === user.uid);
                const canResume = data.status !== 'finished' &&
                    (data.hostId === user.uid || (!!member && !member.isLeft));
                if (!canResume) return clearStale();
                activeRoomScopeRef.current = getRoomSessionScope(data);
                setRoom(current => current ?? data);
            } catch (err) {
                // 讀取失敗（離線、權限）不清除快取，下次重新整理仍可再試。
                console.error('恢復進行中房間失敗:', err);
                restoreAttemptedUidRef.current = null;
            }
        })();
        return () => { cancelled = true; };
    }, [user?.uid, user?.activeGame?.roomId, room?.id]);

    // 監聽房間狀態
    useEffect(() => {
        if (!user) {
            activeRoomScopeRef.current = null;
            setRoomSyncState('idle');
            setRoom(null);
            setPlayerStates({});
            setPlayerStatesHydrated(false);
            return;
        }

        // 房間必須由玩家在目前登入工作階段主動建立或加入，不能因舊快取／帳號資料自動回到上一場。
        const targetRoomId = room?.id || null;

        if (!targetRoomId) {
            localStorage.removeItem(`active_room_${user.uid}`);
            roomListenerTokenRef.current = null;
            activeRoomScopeRef.current = null;
            lastMeasuredBoardSnapshotRef.current = null;
            lastAcceptedBoardSnapshotRef.current = null;
            lastObservedTurnUidRef.current = null;
            setRoomSyncState('idle');
            // 如果連 localStorage 都沒 ID，確保 room 狀態也是 null
            if (room) setRoom(null);
            return;
        }

        lastObservedRoomStatusRef.current = null;
        roomListenerTokenRef.current = targetRoomId;
        lastRoomSnapshotHashRef.current = null;
        lastAcceptedBoardSnapshotRef.current = null;
        lastMeasuredBoardSnapshotRef.current = null;
        lastObservedTurnUidRef.current = null;
        setRoomSyncState('cached');
        console.log('開始監聽房間:', targetRoomId);
        const unsubscribe = onSnapshot(doc(db, 'rooms', targetRoomId), { includeMetadataChanges: true }, (snapshot) => {
            if (roomListenerTokenRef.current !== targetRoomId) return;
            const serverConfirmed = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
            setRoomSyncState(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites ? 'cached' : 'synced');
            if (snapshot.exists()) {
                const data = snapshot.data() as Room;
                lastObservedRoomStatusRef.current = data.status;
                const snapshotHash = JSON.stringify(data);
                const isSameSnapshot = lastRoomSnapshotHashRef.current === snapshotHash;
                lastRoomSnapshotHashRef.current = snapshotHash;
                console.log('房間數據更新:', data.id, '狀態:', data.status, '成員數:', data.members?.length);

                const boardUpdatedAt = Number(data.boardState?.updatedAt);
                const boardSnapshotKey = `${data.boardState?.revision ?? 'none'}:${boardUpdatedAt || 'none'}`;
                const snapshotTraceId = `${targetRoomId}:${data.boardState?.revision || 0}:${boardUpdatedAt || 0}`;
                const turnHandoff = lastObservedTurnUidRef.current !== null
                    && data.boardState?.currentTurnUid !== lastObservedTurnUidRef.current;
                if (serverConfirmed && Number.isFinite(boardUpdatedAt) && boardUpdatedAt > 0 && lastMeasuredBoardSnapshotRef.current !== boardSnapshotKey) {
                    lastMeasuredBoardSnapshotRef.current = boardSnapshotKey;
                    void trackGameEvent('board_listener_sync', {
                        sync_lag_ms: Math.max(0, Date.now() - boardUpdatedAt),
                        turn_handoff: turnHandoff,
                        revision: data.boardState?.revision || 0,
                        movement_active: !!data.boardState?.movement?.isActive,
                        from_cache: snapshot.metadata.fromCache,
                        pending_writes: snapshot.metadata.hasPendingWrites,
                        room_bytes: new TextEncoder().encode(JSON.stringify(data)).length,
                        board_bytes: new TextEncoder().encode(JSON.stringify(data.boardState || null)).length,
                        trace_id: snapshotTraceId
                    }).catch(() => undefined);
                }
                if (serverConfirmed && data.boardState?.currentTurnUid) {
                    lastObservedTurnUidRef.current = data.boardState.currentTurnUid;
                }

                // Firestore metadata-only callbacks still arrive when a local
                // write changes from pending to acknowledged. Do not rebuild
                // the entire room object when the document data is unchanged.
                if (isSameSnapshot) return;

                // A reconnect or an old listener can deliver a snapshot that is
                // older than the one already rendered. Never let it resurrect a
                // cleared card/event or roll the turn back.
                if (!shouldAcceptBoardSnapshot(lastAcceptedBoardSnapshotRef.current, data)) {
                    void trackGameEvent('room_listener_stale_snapshot', {
                        room_id: targetRoomId,
                        accepted_revision: lastAcceptedBoardSnapshotRef.current?.boardState?.revision || 0,
                        received_revision: data.boardState?.revision || 0,
                        accepted_updated_at: lastAcceptedBoardSnapshotRef.current?.boardState?.updatedAt || 0,
                        received_updated_at: data.boardState?.updatedAt || 0
                    }).catch(() => undefined);
                    return;
                }
                lastAcceptedBoardSnapshotRef.current = {
                    id: data.id,
                    sessionId: data.sessionId,
                    boardState: data.boardState || null
                };
                activeRoomScopeRef.current = getRoomSessionScope(data);

                // 舊房間曾把完整財務資料放在 room.playerStates；由房主一次搬到
                // 私有子集合，避免玩家端繼續下載其他人的財務報表。
                if (data.hostId === user.uid && data.playerStates && Object.keys(data.playerStates).length > 0) {
                    migrateLegacyPlayerStates(data).catch(err => {
                        console.error('搬移舊玩家狀態失敗:', err);
                    });
                }

                const movement = data.boardState?.movement;
                if (serverConfirmed &&
                    movement?.isActive &&
                    data.hostId === user.uid
                ) {
                    const movementDeadline = movement.startedAt + getBoardMovementSettleMs(movement);

                    if (Date.now() > movementDeadline + BOARD_MOVE_STALE_BUFFER_MS) {
                        const settleCommandId = `movement:${movement.playerUid}:${movement.startedAt}:settle`;
                        console.warn('偵測到過期的棋盤移動狀態，自動補完收尾:', data.id, movement.playerUid);
                        runRoomBoardMutation({
                            db,
                            roomId: targetRoomId,
                            commandId: settleCommandId,
                            playerStateUids: [movement.playerUid],
                            forcePrivatePlayerStates: true,
                            onDuplicate: () => undefined,
                            mutate: (latestRoom, latestBoard) => {
                                const latestMovement = latestBoard.movement;
                                if (!latestMovement?.isActive || latestMovement.playerUid !== movement.playerUid || latestMovement.startedAt !== movement.startedAt) {
                                    throw new Error('棋盤移動已更新');
                                }
                                const resolution = buildBoardMovementLegResolution(latestRoom as Room, movement.playerUid);
                                if (!resolution?.boardState) throw new Error('棋盤移動無法結算');
                                return {
                                    boardState: resolution.boardState,
                                    roomPatch: resolution.playerStates ? { playerStates: resolution.playerStates } : undefined,
                                    result: undefined
                                };
                            }
                        }).catch(err => {
                            console.error('自動補完棋盤移動失敗:', err);
                        });
                    }
                }

                // 檢查自己是否還在成員名單中
                const isHost = data.hostId === user.uid;
                const stillMember = data.members?.some(m => m.uid === user.uid);

                if (serverConfirmed && !stillMember && !isHost) {
                    console.log('檢測到用戶已不在成員名單中，自動清除狀態');
                    activeRoomScopeRef.current = null;
                    setRoom(null);
                    localStorage.removeItem(`active_room_${user.uid}`);
                    localStorage.removeItem('hf_practice_mode');
                    return;
                }

                if (data.pendingRequests) {
                    console.log('偵測到待審核請求:', Object.keys(data.pendingRequests).length, '筆');
                }
                setPendingRequests(current => {
                    const next = { ...current };
                    legacyPendingRequestIdsRef.current.forEach(requestId => delete next[requestId]);
                    const legacyRequests = data.pendingRequests || {};
                    legacyPendingRequestIdsRef.current = new Set(Object.keys(legacyRequests));
                    Object.assign(next, legacyRequests);
                    const currentIds = Object.keys(current);
                    const nextIds = Object.keys(next);
                    if (currentIds.length === nextIds.length && nextIds.every(requestId => current[requestId] === next[requestId])) {
                        return current;
                    }
                    return next;
                });
                setRoom(prev => mergeRoomSnapshotWithPrivateStates(data, prev));
                if (serverConfirmed && typeof window !== 'undefined') {
                    const listenerReceivedAt = performance.now();
                    const emitUiReady = () => {
                        void trackGameEvent('board_ui_ready', {
                            trace_id: snapshotTraceId,
                            ui_ready_ms: Math.max(0, Math.round(performance.now() - listenerReceivedAt)),
                            revision: data.boardState?.revision || 0,
                            room_bytes: new TextEncoder().encode(JSON.stringify(data)).length
                        }).catch(() => undefined);
                    };
                    if (typeof window.requestAnimationFrame === 'function') {
                        window.requestAnimationFrame(emitUiReady);
                    } else {
                        window.setTimeout(emitUiReady, 0);
                    }
                }

                // 房主端自動修復：偵測到有玩家漏在 turnOrder 之外就補齊
                if (serverConfirmed && data.hostId === user.uid) {
                    healMissingTurnOrderPlayers(data).catch(err => {
                        console.error('自動補齊 turnOrder 失敗:', err);
                    });
                    healStaleBoardPrompts(data).catch(err => {
                        console.error('自動清理過期共享事件失敗:', err);
                    });
                }

                // 儲存目前房間 ID 到 localStorage
                localStorage.setItem(`active_room_${user.uid}`, data.id);
            } else if (serverConfirmed) {
                // 房主在結算後關閉（刪除）房間時，玩家仍停留在遊戲評分頁，
                // 由玩家自己按「離開遊戲」回大廳；下次登入時房間已不存在，會直接進大廳。
                if (lastObservedRoomStatusRef.current === 'finished' && !isClosingRoomRef.current) {
                    console.log('房間已被房主關閉，保留結算畫面直到玩家自行離開');
                    return;
                }
                console.log('房間不存在或已被關閉');
                activeRoomScopeRef.current = null;
                setRoom(null);
                localStorage.removeItem(`active_room_${user.uid}`);
                localStorage.removeItem('hf_practice_mode');
            }
        }, (err) => {
            if (roomListenerTokenRef.current !== targetRoomId) return;
            console.error('監聽房間失敗:', err);
            setRoomSyncState(err.code === 'unavailable' ? 'offline' : 'error');
            if (err.code === 'permission-denied') {
                setError('目前無法讀取房間資料（權限不足）；這不代表房間已關閉。請確認登入帳號與房間權限。');
            }
            // 權限錯誤不代表房間已被刪除；清空本機房間會讓執行師被錯誤送回大廳。
            if (shouldClearRoomAfterSnapshotError(err.code)) {
                activeRoomScopeRef.current = null;
                setRoom(null);
                localStorage.removeItem(`active_room_${user.uid}`);
                localStorage.removeItem('hf_practice_mode');
            }
        });

        return () => {
            console.log('停止監聽房間:', targetRoomId);
            unsubscribe();
            if (roomListenerTokenRef.current === targetRoomId) {
                roomListenerTokenRef.current = null;
            }
        };
    }, [user?.uid, room?.id, healMissingTurnOrderPlayers, healStaleBoardPrompts, migrateLegacyPlayerStates]); // 只監聽目前工作階段主動建立／加入的房間

    // 審核請求獨立監聽，避免故事分享寫入時觸發所有房間狀態重新下載。
    // 舊房間仍由上面的 Room snapshot 提供 legacy pendingRequests。
    useEffect(() => {
        const scopeKey = user && room?.id ? `${room.id}:${room.sessionId || 'no-session'}` : null;
        if (pendingRequestScopeRef.current !== scopeKey) {
            pendingRequestScopeRef.current = scopeKey;
            legacyPendingRequestIdsRef.current = new Set();
            subcollectionPendingRequestIdsRef.current = new Set();
            setPendingRequests(room?.pendingRequests || {});
        }

        const isRoomRequestReader = user?.role === 'coach' || user?.role === 'gm';
        const isCurrentRoomMember = room?.hostId === user?.uid
            || room?.memberUids?.includes(user?.uid || '')
            || room?.members?.some(member => member.uid === user?.uid);

        // 只在房間快照已由 server 確認，且目前帳號已被新房間辨識後建立 query。
        // 重開房間時先收到 cache/舊 room 快照，不應讓 pendingRequests 監聽提早觸發權限錯誤。
        if (!user || !room?.id || !room.sessionId || roomSyncState !== 'synced' || (!isRoomRequestReader && !isCurrentRoomMember)) return;

        const requestsRef = collection(db, 'rooms', room.id, 'pendingRequests');
        const requestsQuery = user.role === 'coach' || user.role === 'gm'
            ? query(requestsRef, where('sessionId', '==', room.sessionId))
            : query(requestsRef, where('uid', '==', user.uid));

        return onSnapshot(requestsQuery, { includeMetadataChanges: true }, snapshot => {
            const nextRequests = Object.fromEntries(
                snapshot.docs
                    .map(requestSnapshot => requestSnapshot.data() as PendingRequest)
                    .filter(request => request.sessionId === room.sessionId)
                    .map(request => [request.id, request])
            );
            setPendingRequests(current => {
                const next = { ...current };
                subcollectionPendingRequestIdsRef.current.forEach(requestId => delete next[requestId]);
                subcollectionPendingRequestIdsRef.current = new Set(Object.keys(nextRequests));
                Object.assign(next, nextRequests);
                const currentIds = Object.keys(current);
                const nextIds = Object.keys(next);
                if (currentIds.length === nextIds.length && nextIds.every(requestId => current[requestId] === next[requestId])) {
                    return current;
                }
                return next;
            });
        }, error => {
            console.error('監聽審核請求失敗:', error);
            if (error.code === 'permission-denied') {
                setError('審核請求同步權限不足，請重新整理後再試一次');
            }
        });
    }, [room?.id, room?.sessionId, room?.hostId, room?.memberUids, room?.members, roomSyncState, user?.role, user?.uid]);

    // Full financial state is private. Coaches can monitor all player documents;
    // ordinary players only subscribe to their own document.
    useEffect(() => {
        setPlayerStatesHydrated(false);
        lastPrivateStatesHashRef.current = null;
        if (!user || !room?.id) {
            setPlayerStates({});
            return;
        }

        const targetRoomId = room.id;
        const targetRoomScope = getRoomSessionScope(room);
        const statesRef = collection(db, 'rooms', targetRoomId, 'players');
        const applyStates = (states: Record<string, GameState>) => {
            if (activeRoomScopeRef.current !== targetRoomScope) return;
            const sessionStates = room.status === 'playing' && room.startedAt
                ? Object.fromEntries(Object.entries(states).filter(([, state]) => state.boardGameStartedAt === room.startedAt))
                : states;
            const statesHash = JSON.stringify(sessionStates);
            if (lastPrivateStatesHashRef.current === statesHash) {
                setPlayerStatesHydrated(true);
                return;
            }
            lastPrivateStatesHashRef.current = statesHash;
            setPlayerStates(sessionStates);
            setRoom(prev => prev && getRoomSessionScope(prev) === targetRoomScope
                ? { ...prev, playerStates: sessionStates }
                : prev);
            setPlayerStatesHydrated(true);
        };

        // 房主即使帳號角色資料尚未同步，也必須能讀取所有玩家的私有狀態。
        const canMonitorRoomPlayers = user.uid === room.hostId || user.role === 'coach' || user.role === 'gm';
        if (canMonitorRoomPlayers) {
            return onSnapshot(statesRef, { includeMetadataChanges: true }, snapshot => {
                applyStates(Object.fromEntries(
                    snapshot.docs.map(playerDoc => [playerDoc.id, playerDoc.data() as GameState])
                ));
            }, error => {
                console.error('監聽玩家私有狀態失敗:', error);
                setPlayerStatesHydrated(true);
            });
        }

        return onSnapshot(doc(db, 'rooms', targetRoomId, 'players', user.uid), { includeMetadataChanges: true }, snapshot => {
            applyStates(snapshot.exists() ? { [user.uid]: snapshot.data() as GameState } : {});
        }, error => {
            console.error('監聽自己的玩家狀態失敗:', error);
            setPlayerStatesHydrated(true);
        });
    }, [room?.id, room?.sessionId, room?.startedAt, room?.status, room?.hostId, user?.role, user?.uid]);

    const sharedPromptResponseFingerprint = JSON.stringify(room?.boardState?.sharedCardPrompt?.responses || {});

    // schema v2 的非財務共享回覆各自監聽 response 文件；玩家只能讀自己的
    // 文件，房主／執行師才讀完整集合並負責一次性結案。
    useEffect(() => {
        const prompt = room?.boardState?.sharedCardPrompt;
        if (!user || !room?.id || room.syncSchemaVersion !== 2 || prompt?.responseStorage !== 'subcollection') return;

        const isRoomCoach = room.hostId === user.uid || user.role === 'coach' || user.role === 'gm';
        const responsesRef = collection(db, 'rooms', room.id, 'events', prompt.id, 'responses');
        const handleResponses = (responses: Record<string, SharedCardPromptResponse>) => {
            setRoom(prev => {
                if (!prev?.boardState?.sharedCardPrompt || prev.boardState.sharedCardPrompt.id !== prompt.id) return prev;
                return {
                    ...prev,
                    boardState: {
                        ...prev.boardState,
                        sharedCardPrompt: {
                            ...prev.boardState.sharedCardPrompt,
                            responses: {
                                ...(prev.boardState.sharedCardPrompt.responses || {}),
                                ...responses
                            }
                        }
                    }
                };
            });

            if (isRoomCoach) {
                const mergedResponses = { ...(prompt.responses || {}), ...responses };
                if (prompt.targetPlayerUids.every(uid => mergedResponses[uid])) {
                    void finalizeSubcollectionSharedPrompt(room.id, prompt.id);
                }
            }
        };
        const handleError = (error: { code?: string }) => {
            console.error('監聽共享卡片回覆失敗:', error);
            if (error.code === 'permission-denied') setError('共享卡片回覆同步權限不足，請重新整理後再試一次');
        };

        if (isRoomCoach) {
            return onSnapshot(responsesRef, snapshot => {
                handleResponses(Object.fromEntries(
                    snapshot.docs.map(responseDoc => [responseDoc.id, responseDoc.data() as SharedCardPromptResponse])
                ));
            }, handleError);
        }

        return onSnapshot(doc(db, 'rooms', room.id, 'events', prompt.id, 'responses', user.uid), snapshot => {
            handleResponses(snapshot.exists() ? { [user.uid]: snapshot.data() as SharedCardPromptResponse } : {});
        }, handleError);
    }, [room?.id, room?.hostId, room?.syncSchemaVersion, room?.boardState?.sharedCardPrompt?.id, room?.boardState?.sharedCardPrompt?.responseStorage, sharedPromptResponseFingerprint, user?.role, user?.uid, finalizeSubcollectionSharedPrompt]);

    // 生成 6 位數房間碼
    const generateRoomCode = useCallback(async (): Promise<string> => {
        let code = '';
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            attempts++;
            code = Math.floor(100000 + Math.random() * 900000).toString();
            const roomDoc = await withRoomCreateTimeout(
                getDoc(doc(db, 'rooms', code)),
                '讀取房間服務逾時，請確認本地 Firestore 或網路連線'
            );
            if (!roomDoc || !roomDoc.exists()) {
                isUnique = true;
            }
        }

        if (!isUnique) {
            throw new Error('無法生成唯一的房間碼，請稍後再試');
        }

        return code;
    }, []);

    const createRoom = useCallback(async (settings?: { name: string; maxPlayers: number; duration: number; isPractice?: boolean; isBoardGame?: boolean }) => {
        if (!user) throw new Error('請先登入');
        if (user.role !== 'coach') throw new Error('只有執行師可以開房');
        if (isClosingRoomRef.current) throw new Error('上一個房間仍在關閉，請稍後再試');

        setIsLoadingRoom(true);
        setError(null);
        try {
            // 建立新房前以 Firestore 確認目前房間是否仍有效。遊戲結束後
            // CoachGameView 仍需保留 finished 房間顯示結算，所以不能只看本機 room。
            // 只檢查目前工作階段已載入的房間；帳號文件中的 activeGame 只是
            // 舊版恢復指標，不能在重新登入後阻擋建立新房。
            const existingRoomId = room?.id;

            if (existingRoomId) {
                const existingRoomDoc = await withRoomCreateTimeout(
                    getDoc(doc(db, 'rooms', existingRoomId)),
                    '讀取目前房間服務逾時，請確認本地 Firestore 或網路連線'
                );

                if (existingRoomDoc.exists()) {
                    const existingRoom = existingRoomDoc.data() as Room;
                    if (existingRoom.status !== 'finished' || existingRoom.hostId !== user.uid) {
                        throw new Error('請先關閉目前房間，再建立新房');
                    }
                }

                // 舊房間已結束或已不存在：清除本機與跨裝置恢復指標，避免
                // 舊 listener / activeGame 在建立新房前把它重新載回來。
                resumeSuppressedRoomRef.current = existingRoomId;
                setRoom(null);
                localStorage.removeItem(`active_room_${user.uid}`);
                if (user.activeGame?.roomId === existingRoomId) {
                    await updateDoc(doc(db, 'users', user.uid), { activeGame: deleteField() });
                }
            }

            const roomCode = await generateRoomCode();
            const newRoom: Room = {
                id: roomCode,
                name: settings?.name || '',
                hostId: user.uid,
                status: 'waiting',
                members: [{
                    uid: user.uid,
                    name: user.name,
                    photoURL: user.photoURL || 'bee',
                    email: user.email || '',
                    title: user.title || '',
                    experience: user.experience || 0,
                    role: 'coach',
                    joinedAt: new Date(),
                    photoPosition: user.photoPosition,
                    photoScale: user.photoScale
                }],
                memberUids: [user.uid],
                createdAt: serverTimestamp(),
                maxPlayers: settings?.maxPlayers || 6,
                closedPlayerSlots: Array.from({ length: ROOM_PLAYER_SLOT_COUNT }, (_, index) => index)
                    .filter(index => index >= (settings?.maxPlayers || 6)),
                duration: settings?.duration || 60,
                gameTimeLeft: (settings?.duration || 60) * 60,
                isTimerPaused: true,
                sessionId: `${roomCode}_${Date.now()}`,
                ...(settings?.isBoardGame ? { syncSchemaVersion: 2 } : {}),
                financialAcceleration: { multiplier: 1 },
                boardState: settings?.isBoardGame ? createInitialBoardState([{
                    uid: user.uid,
                    name: user.name,
                    photoURL: user.photoURL || 'bee',
                    email: user.email || '',
                    title: user.title || '',
                    experience: user.experience || 0,
                    role: 'coach',
                    joinedAt: new Date(),
                    photoPosition: user.photoPosition,
                    photoScale: user.photoScale
                }], user.uid) : null,
                ...(settings?.isBoardGame ? { isBoardGame: true } : {}),
                ...(settings?.isPractice ? { isPractice: true } : {})
            };
            const cleanedRoom = cleanObject(newRoom);
            await withRoomCreateTimeout(
                setDoc(doc(db, 'rooms', roomCode), cleanedRoom),
                '建立房間服務逾時，請確認本地 Firestore 或網路連線'
            );
            await updateDoc(doc(db, 'users', user.uid), {
                activeGame: { roomId: roomCode, joinedAt: Date.now() }
            });
            resumeSuppressedRoomRef.current = null;
            roomListenerTokenRef.current = roomCode;
            activeRoomScopeRef.current = getRoomSessionScope(cleanedRoom);
            localStorage.setItem(`active_room_${user.uid}`, roomCode);
            setRoom(cleanedRoom);
            return roomCode;
        } catch (err: any) {
            console.error('建立房間失敗:', err);
            const errMsg = err.code === 'permission-denied'
                ? '目前頁面的登入狀態沒有建立房間權限，請在此網址重新登入後再試一次'
                : (err.message || '建立房間時發生錯誤');
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setIsLoadingRoom(false);
        }
    }, [room, user, generateRoomCode]);

    const setRoomPlayerSlotOpen = async (slotIndex: number, isOpen: boolean) => {
        if (!room?.id || !user) throw new Error('請先進入房間');
        const roomRef = doc(db, 'rooms', room.id);
        try {
            await runTransaction(db, async transaction => {
                const snapshot = await transaction.get(roomRef);
                if (!snapshot.exists()) throw new Error('房間不存在');
                const latestRoom = snapshot.data() as Room;
                if (latestRoom.hostId !== user.uid) throw new Error('只有執行師可以編輯玩家欄位');
                if (latestRoom.status !== 'waiting') throw new Error('遊戲開始後不能調整玩家欄位');

                const occupiedPlayerCount = latestRoom.members.filter(member => member.uid !== latestRoom.hostId && !member.isLeft).length;
                const update = buildRoomPlayerSlotUpdate(
                    latestRoom.maxPlayers,
                    latestRoom.closedPlayerSlots,
                    slotIndex,
                    isOpen,
                    occupiedPlayerCount
                );
                if (update) transaction.update(roomRef, update);
            });
        } catch (err: any) {
            const message = err?.message || '更新玩家欄位失敗';
            setError(message);
            throw new Error(message);
        }
    };

    const joinRoom = async (roomCode: string) => {
        if (!user) throw new Error('請先登入');
        setIsLoadingRoom(true);
        setError(null);
        try {
            const newMember: RoomMember = {
                uid: user.uid,
                name: user.name,
                photoURL: user.photoURL || 'bee',
                email: user.email || '',
                title: user.title || '',
                experience: user.experience || 0,
                role: user.role,
                joinedAt: new Date(),
                photoPosition: user.photoPosition,
                photoScale: user.photoScale
            };

            const cleanedMember = cleanObject(newMember);
            const roomRef = doc(db, 'rooms', roomCode);
            const playerRef = doc(db, 'rooms', roomCode, 'players', user.uid);
            const joinedRoom = await runTransaction(db, async transaction => {
                const roomSnapshot = await transaction.get(roomRef);
                const privateStateSnapshot = await transaction.get(playerRef);
                if (!roomSnapshot.exists()) throw new Error('此房間不存在');

                const latestRoom = roomSnapshot.data() as Room;
                const existingMember = latestRoom.members.find(member => member.uid === user.uid);
                if (existingMember) return latestRoom;

                const hasCloudState = privateStateSnapshot.exists() || !!latestRoom.playerStates?.[user.uid];
                if (!hasCloudState && latestRoom.status !== 'waiting') throw new Error('遊戲已開始或已結束');

                const playerCount = latestRoom.members.filter(member => member.uid !== latestRoom.hostId && !member.isLeft).length;
                const openSlotCount = getRoomPlayerSlots(latestRoom.maxPlayers, latestRoom.closedPlayerSlots)
                    .filter(slot => slot.isOpen).length;
                if (playerCount >= openSlotCount) throw new Error('目前沒有開放的玩家欄位');

                transaction.update(roomRef, {
                    members: arrayUnion(cleanedMember),
                    memberUids: arrayUnion(user.uid)
                });
                return {
                    ...latestRoom,
                    members: [...latestRoom.members, cleanedMember],
                    memberUids: Array.from(new Set([...(latestRoom.memberUids || []), user.uid]))
                };
            });
            await updateDoc(doc(db, 'users', user.uid), {
                activeGame: { roomId: roomCode, joinedAt: Date.now() }
            });

            // 存入 localStorage 並手動更新 room ID 觸發監聽器
            resumeSuppressedRoomRef.current = null;
            roomListenerTokenRef.current = roomCode;
            activeRoomScopeRef.current = getRoomSessionScope(joinedRoom);
            localStorage.setItem(`active_room_${user.uid}`, roomCode);
            setRoom(joinedRoom);
        } catch (err: any) {
            const message = err?.code === 'permission-denied'
                ? '目前頁面的登入狀態無法讀取房間，請在此網址重新登入後再試一次'
                : err?.message || '加入房間失敗';
            setError(message);
            throw new Error(message);
        } finally {
            setIsLoadingRoom(false);
        }
    };

    const leaveRoom = async () => {
        if (!user || !room) return;
        const roomId = room.id;
        try {
            const roomRef = doc(db, 'rooms', roomId);
            const memberToRemove = room.members.find(m => m.uid === user.uid);

            // 先清除本地狀態，防止 UI 閃爍或重連
            resumeSuppressedRoomRef.current = roomId;
            setRoom(null);
            localStorage.removeItem(`active_room_${user.uid}`);

            if (memberToRemove) {
                await safeAsync(updateDoc(roomRef, {
                    members: arrayRemove(memberToRemove),
                    memberUids: arrayRemove(user.uid)
                }));
            }
            await safeAsync(updateDoc(doc(db, 'users', user.uid), { activeGame: deleteField() }));
        } catch (err: any) {
            console.error('離開房間失敗:', err);
        }
    };

    // 遊戲中暫時離開只離開畫面，保留房間席位與 activeGame，重開或重新登入即可恢復。
    const leaveToLobby = async () => {
        if (!user || !room) return;
        resumeSuppressedRoomRef.current = room.id;
        setRoom(null);
        localStorage.removeItem(`active_room_${user.uid}`);
    };

    const startRoomGame = async () => {
        if (!room || user?.uid !== room.hostId) return;
        const targetRoomId = room.id;
        const requestedStartedAt = Date.now();
        const requestedSessionId = `${targetRoomId}_${requestedStartedAt}`;
        try {
            // 開局必須在同一筆 transaction 內確認 waiting 狀態。網路延遲時即使
            // 使用者重複點擊，第二次也只能讀到既有場次，不得重建 session 或再次
            // 刪除玩家文件。
            const roomRef = doc(db, 'rooms', targetRoomId);
            const startResult = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) throw new Error('房間不存在或已關閉');

                const currentRoom = roomDoc.data() as Room;
                if (currentRoom.hostId !== user.uid) throw new Error('只有執行師可以開始遊戲');
                if (currentRoom.status === 'playing') {
                    return {
                        applied: false as const,
                        startedAt: currentRoom.startedAt,
                        sessionId: currentRoom.sessionId,
                        boardState: currentRoom.boardState,
                        marketPrices: currentRoom.marketPrices,
                        gameTimeLeft: currentRoom.gameTimeLeft,
                        isTimerPaused: currentRoom.isTimerPaused,
                        timerEndsAtMs: currentRoom.timerEndsAtMs
                    };
                }
                if (currentRoom.status !== 'waiting') throw new Error('目前房間不能開始新遊戲');

                const nextBoardState = currentRoom.isBoardGame
                    ? createInitialBoardState(currentRoom.members, currentRoom.hostId)
                    : null;
                const initialMarketPrices = currentRoom.isBoardGame ? createInitialMarketPrices() : undefined;
                const gameTimeLeft = (currentRoom.duration || 60) * 60;

                transaction.update(roomRef, {
                    status: 'playing',
                    publicPlayerStates: {},
                    playerStates: deleteField(),
                    pendingRequests: {},
                    startedAt: requestedStartedAt,
                    sessionId: requestedSessionId,
                    boardState: nextBoardState,
                    gameTimeLeft,
                    isTimerPaused: true,
                    timerEndsAtMs: deleteField(),
                    ...(initialMarketPrices ? {
                        marketPrices: initialMarketPrices,
                        previousMarketPrices: initialMarketPrices,
                        marketUpdates: deleteField()
                    } : {}),
                    memberUids: currentRoom.members.map(member => member.uid)
                });
                currentRoom.members
                    .filter(member => member.uid !== currentRoom.hostId)
                    .forEach(member => transaction.delete(doc(db, 'rooms', targetRoomId, 'players', member.uid)));

                return {
                    applied: true as const,
                    startedAt: requestedStartedAt,
                    sessionId: requestedSessionId,
                    boardState: nextBoardState,
                    marketPrices: initialMarketPrices,
                    gameTimeLeft,
                    isTimerPaused: true,
                    timerEndsAtMs: undefined
                };
            }));

            if (!startResult.applied || !startResult.startedAt || !startResult.sessionId) return;

            activeRoomScopeRef.current = getRoomSessionScope({ id: targetRoomId, sessionId: startResult.sessionId });
            lastAcceptedBoardSnapshotRef.current = null;
            lastPrivateStatesHashRef.current = null;
            setPlayerStates({});
            setPlayerStatesHydrated(false);
            setPendingRequests({});
            setRoom(prev => prev?.id === targetRoomId ? {
                ...prev,
                status: 'playing',
                publicPlayerStates: {},
                playerStates: {},
                pendingRequests: {},
                startedAt: startResult.startedAt,
                sessionId: startResult.sessionId,
                boardState: startResult.boardState,
                gameTimeLeft: startResult.gameTimeLeft,
                isTimerPaused: startResult.isTimerPaused,
                timerEndsAtMs: startResult.timerEndsAtMs,
                ...(startResult.marketPrices ? {
                    marketPrices: startResult.marketPrices,
                    previousMarketPrices: startResult.marketPrices,
                    marketUpdates: undefined
                } : {})
            } : prev);
        } catch (err: any) {
            console.error('開始遊戲失敗:', err);
            setError(err?.message || '開始遊戲失敗，請稍後再試');
        }
    };

    const rollBoardDice = async (requestedDiceCount?: 1 | 2) => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
            throw new Error('棋盤房間尚未準備完成');
        }
        if (room.status !== 'playing') {
            throw new Error('請等待執行師開始遊戲');
        }
        if (room.isTimerPaused) {
            throw new Error('請等待執行師開始或繼續遊戲');
        }

        const boardState = room.boardState;
        if (boardState.movement?.isActive) {
            throw new Error('目前角色仍在移動中');
        }
        if (boardState.currentTurnUid !== user.uid) {
            throw new Error('還沒輪到你');
        }
        if (boardState.hasRolledThisTurn) {
            throw new Error('這回合已經擲過骰子了，請先按「結束回合」再換下一位');
        }
        if (hasIncompleteSharedPrompts(boardState)) {
            throw new Error('請先等待所有玩家完成家庭重要歷程回覆');
        }

        const playerState = room.playerStates?.[user.uid];
        const candidateDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
        const diceCount = resolveBoardDiceCount(hasCarAsset(playerState), requestedDiceCount);
        const dice = candidateDice.slice(0, diceCount);
        const total = dice.reduce((sum, value) => sum + value, 0);
        const startPosition = boardState.playerPositions[user.uid] || 0;
        const pathLength = BOARD_SQUARES.length;
        const path = Array.from({ length: total }, (_, step) => (startPosition + step + 1) % pathLength);
        let nextPosition = startPosition;
        const passedMessages: string[] = [];

        const movementEffects = buildMovementEffects(path, hasCarAsset(playerState));
        const repairEffects = new Map(movementEffects.map(effect => [effect.squareIndex, effect]));
        for (let step = 0; step < path.length; step += 1) {
            nextPosition = path[step];
            const square = getSquareByIndex(nextPosition);
            if (square.type === 'bank') {
                passedMessages.push(`經過${square.label}，請完成月結餘確認`);
            }
            if (square.type === 'school') {
                passedMessages.push(`經過${square.label}，可前往升等考試`);
            }
            if (square.type === 'repair' && repairEffects.has(nextPosition)) {
                passedMessages.push(...describeMovementEffects([repairEffects.get(nextPosition)!]));
            }
        }

        // 大富翁式分段移動：這次擲骰只先走到第一個「經過事件」格（或直接走到終點，
        // 若中途沒有經過事件格），剩下的步數留到事件結案後再繼續走。
        const { legPath: firstLegPath, remainingPath: firstLegRemaining } = splitMovementLeg(path, movementEffects);

        const rollTimestamp = Date.now();
        const movement = {
            playerUid: user.uid,
            startPosition,
            path: firstLegPath,
            remainingPath: firstLegRemaining.length > 0 ? firstLegRemaining : undefined,
            rollTotal: total,
            dice,
            startedAt: rollTimestamp,
            stepDurationMs: BOARD_MOVE_STEP_DURATION_MS,
            introDelayMs: BOARD_MOVE_INTRO_DELAY_MS + DICE_PRESENTATION_DURATION_MS,
            landingDelayMs: BOARD_MOVE_LANDING_DELAY_MS,
            isActive: true,
            effects: movementEffects
        };
        const updates: Record<string, any> = {
            'boardState.currentTurnUid': user.uid,
            'boardState.hasRolledThisTurn': true,
            'boardState.lastRoll': {
                uid: user.uid,
                dice,
                total,
                timestamp: rollTimestamp
            },
            'boardState.currentCard': null,
            'boardState.currentCardReveal': null,
            'boardState.currentEvent': null,
            'boardState.movement': movement,
            'boardState.updatedAt': rollTimestamp
        };
        if (playerState?.bankServiceWindowActive) {
            updates[`playerStates.${user.uid}`] = cleanObject({
                ...playerState,
                bankServiceWindowActive: false,
                bankServiceGrantedAtEventId: undefined
            });
        }
        const rollCommandId = `roll:${user.uid}:${boardState.revision || 0}`;
        const rollResult = await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: rollCommandId,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            expectedRevision: boardState.revision || 0,
            onDuplicate: latestRoom => ({
                position: latestRoom.boardState?.movement?.path.at(-1) ?? latestRoom.boardState?.playerPositions[user.uid] ?? startPosition,
                detail: (latestRoom.boardState?.lastRoll as any)?.detail || '',
                skipTurns: latestRoom.playerStates?.[user.uid]?.skipTurns || 0,
                total: latestRoom.boardState?.lastRoll?.total || total,
                dice: latestRoom.boardState?.lastRoll?.dice || [latestRoom.boardState?.lastRoll?.total || total]
            }),
            mutate: (latestRoom, latestBoard) => {
                if (latestRoom.status !== 'playing') throw new Error('請等待執行師開始遊戲');
                if (latestRoom.isTimerPaused) throw new Error('請等待執行師開始或繼續遊戲');
                if (latestBoard.movement?.isActive) throw new Error('目前角色仍在移動中');
                if (latestBoard.currentTurnUid !== user.uid) throw new Error('還沒輪到你');
                if (latestBoard.hasRolledThisTurn || latestBoard.currentEvent || (latestBoard.pendingEvents?.length || 0) > 0) {
                    throw new Error('請先完成目前回合');
                }
                if (hasIncompleteSharedPrompts(latestBoard)) {
                    throw new Error('請先等待所有玩家完成家庭重要歷程回覆');
                }
                const latestPlayerState = latestRoom.playerStates?.[user.uid];
                const latestDiceCount = resolveBoardDiceCount(hasCarAsset(latestPlayerState), requestedDiceCount);
                const latestDice = candidateDice.slice(0, latestDiceCount);
                const latestTotal = latestDice.reduce((sum, value) => sum + value, 0);
                const latestStart = latestBoard.playerPositions[user.uid] || 0;
                const latestPath = Array.from({ length: latestTotal }, (_, step) => (latestStart + step + 1) % BOARD_SQUARES.length);
                const latestMovementEffects = buildMovementEffects(latestPath, hasCarAsset(latestPlayerState));
                const latestPassedMessages: string[] = [];
                for (const squareIndex of latestPath) {
                    const square = getSquareByIndex(squareIndex);
                    if (square.type === 'bank') latestPassedMessages.push(`經過${square.label}，請完成月結餘確認`);
                    if (square.type === 'school') latestPassedMessages.push(`經過${square.label}，可前往升等考試`);
                    if (square.type === 'repair') {
                        const repairEffect = latestMovementEffects.find(effect => effect.squareIndex === squareIndex);
                        if (repairEffect) latestPassedMessages.push(...describeMovementEffects([repairEffect]));
                    }
                }
                const { legPath: latestFirstLegPath, remainingPath: latestFirstLegRemaining } = splitMovementLeg(latestPath, latestMovementEffects);
                const latestMovement = {
                    ...movement,
                    startPosition: latestStart,
                    path: latestFirstLegPath,
                    remainingPath: latestFirstLegRemaining.length ? latestFirstLegRemaining : undefined,
                    rollTotal: latestTotal,
                    dice: latestDice,
                    effects: latestMovementEffects
                };
                const roomPatch: Record<string, unknown> = {};
                if (latestPlayerState?.bankServiceWindowActive) {
                    roomPatch[`playerStates.${user.uid}`] = cleanObject({
                        ...latestPlayerState,
                        bankServiceWindowActive: false,
                        bankServiceGrantedAtEventId: undefined
                    });
                }
                const nextBoardState = {
                        ...latestBoard,
                        currentTurnUid: user.uid,
                        hasRolledThisTurn: true,
                        lastRoll: { uid: user.uid, dice: latestDice, total: latestTotal, timestamp: rollTimestamp, detail: latestPassedMessages.join('\n') },
                        currentCard: null,
                        currentCardReveal: null,
                        currentEvent: null,
                        movement: latestMovement,
                        updatedAt: rollTimestamp
                };
                return {
                    boardState: appendDicePresentation(nextBoardState, {
                        id: rollCommandId,
                        sequence: (latestBoard.revision || 0) + 1,
                        playerUid: user.uid,
                        playerName: user.name || '玩家',
                        kind: 'board-movement',
                        dice: latestDice,
                        total: latestTotal,
                        detail: latestPassedMessages.join('\n'),
                        timestamp: rollTimestamp
                    }),
                    roomPatch: Object.keys(roomPatch).length ? roomPatch : undefined,
                    result: {
                        position: latestMovement.path.at(-1) ?? latestStart,
                        detail: latestPassedMessages.join('\n'),
                        skipTurns: latestPlayerState?.skipTurns || 0,
                        total: latestTotal,
                        dice: latestDice
                    }
                };
            }
        });

        return rollResult;
    }) as Promise<{ position: number; detail: string; skipTurns: number; total: number; dice: number[] }>;

    const rollRepairFee = async (eventId: string): Promise<{ roll: number; fee: number }> => {
        if (!room?.id || !user) throw new Error('維修廠事件尚未準備完成');
        const candidateRoll = rollBoardDie();
        const commandId = `repair-roll:${eventId}:${user.uid}`;
        const result = await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            onDuplicate: latestRoom => {
                const event = latestRoom.boardState?.currentEvent;
                if (event?.id !== eventId || !event.repairRoll || !event.repairFee) {
                    throw new Error('維修廠事件已更新');
                }
                return { roll: event.repairRoll, fee: event.repairFee };
            },
            mutate: (latestRoom, latestBoard) => {
                const event = latestBoard.currentEvent;
                if (latestRoom.status !== 'playing') throw new Error('遊戲尚未開始');
                if (!event || event.id !== eventId || event.type !== 'repair') throw new Error('維修廠事件已更新');
                if (event.playerUid !== user.uid || latestBoard.currentTurnUid !== user.uid) throw new Error('只有目前玩家可以擲骰');
                if (!event.repairHasCar) throw new Error('目前沒有需要保養的汽車');
                if (event.repairRoll && event.repairFee) {
                    return {
                        boardState: latestBoard,
                        commit: false,
                        result: { roll: event.repairRoll, fee: event.repairFee }
                    };
                }
                const fee = candidateRoll * 2000;
                const nextBoardState = {
                        ...latestBoard,
                        currentEvent: {
                            ...event,
                            detail: `汽車保養費 ${fee}，請完成財務檢核`,
                            repairRoll: candidateRoll,
                            repairFee: fee
                        },
                        updatedAt: Date.now()
                };
                return {
                    boardState: appendDicePresentation(nextBoardState, {
                        id: `repair-roll:${eventId}:${user.uid}`,
                        sequence: (latestBoard.revision || 0) + 1,
                        playerUid: user.uid,
                        playerName: event.playerName,
                        kind: 'repair',
                        sourceEventId: eventId,
                        dice: [candidateRoll],
                        total: candidateRoll,
                        detail: `汽車保養費 ${fee.toLocaleString()}`,
                        timestamp: Date.now()
                    }),
                    result: { roll: candidateRoll, fee }
                };
            }
        });
        return result;
    };

    const rollHospitalFee = async (eventId: string): Promise<{ roll: number; fee: number }> => {
        if (!room?.id || !room.isBoardGame || !user) throw new Error('醫院事件尚未準備完成');
        const candidateRoll = rollBoardDie();
        const commandId = `hospital-roll:${eventId}:${user.uid}`;
        const result = await runRoomBoardMutation<{ roll: number; fee: number }, Room>({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [],
            onDuplicate: latestRoom => {
                const event = latestRoom.boardState?.currentEvent;
                if (event?.id !== eventId || !event.hospitalRoll || !event.hospitalFee) {
                    throw new Error('醫院事件已更新');
                }
                return { roll: event.hospitalRoll, fee: event.hospitalFee };
            },
            mutate: (latestRoom, latestBoard) => {
                const event = latestBoard.currentEvent;
                if (latestRoom.status !== 'playing') throw new Error('遊戲尚未開始');
                if (!event || event.id !== eventId || event.type !== 'hospital') throw new Error('醫院事件已更新');
                if (event.playerUid !== user.uid || latestBoard.currentTurnUid !== user.uid) throw new Error('只有目前玩家可以擲骰');
                if (event.hospitalFeeCoveredByInsurance) throw new Error('醫療保險已抵免本次醫藥費');
                if (event.hospitalRoll && event.hospitalFee) {
                    return {
                        boardState: latestBoard,
                        commit: false,
                        result: { roll: event.hospitalRoll, fee: event.hospitalFee }
                    };
                }
                const fee = candidateRoll * 1000;
                const timestamp = Date.now();
                const nextBoardState = {
                    ...latestBoard,
                    currentEvent: {
                        ...event,
                        detail: `醫藥費 ${fee}，請完成財務檢核`,
                        hospitalRoll: candidateRoll,
                        hospitalFee: fee
                    },
                    updatedAt: timestamp
                };
                return {
                    boardState: appendDicePresentation(nextBoardState, {
                        id: commandId,
                        sequence: (latestBoard.revision || 0) + 1,
                        playerUid: user.uid,
                        playerName: event.playerName,
                        kind: 'hospital-fee',
                        sourceEventId: eventId,
                        dice: [candidateRoll],
                        total: candidateRoll,
                        detail: `醫藥費 ${fee.toLocaleString()}`,
                        timestamp
                    }),
                    result: { roll: candidateRoll, fee }
                };
            }
        });
        return result;
    };

    const rollSkillDice = async (payload: {
        kind: 'normal' | 'enhance_profession' | 'stock_ability' | 'real_estate_ability';
        sourceEventId?: string;
    }): Promise<BoardDiceRollResult> => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) throw new Error('升等骰子尚未準備完成');
        const candidateRoll = rollBoardDie();
        const commandId = `skill-roll:${room.sessionId || room.id}:${user.uid}:${payload.kind}:${payload.sourceEventId || room.boardState.revision || 0}`;
        const presentationKind: DicePresentationEvent['kind'] = payload.kind === 'normal' ? 'school-exam' : 'lifelong-learning';
        const result = await runRoomBoardMutation<BoardDiceRollResult, Room>({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            onDuplicate: latestRoom => {
                const event = latestRoom.boardState?.diceEvents?.find(item => item.id === commandId);
                if (!event) throw new Error('升等骰點事件已更新');
                return {
                    roll: event.total,
                    dice: event.dice,
                    total: event.total,
                    target: event.target,
                    success: event.success,
                    bonus: event.bonus,
                    newTitle: event.newTitle,
                    presentationDurationMs: DICE_PRESENTATION_DURATION_MS
                };
            },
            mutate: (latestRoom, latestBoard) => {
                if (latestRoom.status !== 'playing' || latestBoard.currentTurnUid !== user.uid) {
                    throw new Error('只有目前回合玩家可以擲升等骰');
                }
                if (payload.sourceEventId && latestBoard.currentEvent?.id !== payload.sourceEventId) {
                    throw new Error('升等事件已更新');
                }
                const latestState = latestRoom.playerStates?.[user.uid];
                if (!latestState) throw new Error('玩家資料尚未同步完成，請重新整理後再試');
                if (payload.kind === 'normal' && (
                    latestBoard.currentEvent?.type !== 'school' ||
                    latestBoard.currentEvent.playerUid !== user.uid
                )) {
                    throw new Error('目前沒有可執行的升等考試');
                }

                const level = latestState.currentRankLevel || 1;
                const target = payload.kind === 'normal'
                    ? level + 1
                    : payload.kind === 'stock_ability' || payload.kind === 'real_estate_ability' ? 4 : 2;
                const success = candidateRoll >= target;
                const timestamp = Date.now();
                const schoolEventId = latestBoard.currentEvent?.id;
                let nextPlayerState: GameState | undefined;
                let normalOutcome: { state: GameState; bonus: number; newTitle: string } | undefined;
                if (payload.kind === 'normal') {
                    if (!schoolEventId) throw new Error('升等事件資料不完整，請重新整理後再試');
                    let stateForExam = latestState;
                    if (!hasSchoolPromotionFee(latestState, schoolEventId)) {
                        if (latestState.cash < 1000) throw new Error('現金不足，請先完成升等考試報名費的財務檢核');
                        const feeTransaction: Transaction = {
                            id: `school-fee:${schoolEventId}`,
                            timestamp,
                            name: '升等考試報名費',
                            amount: 1000,
                            sourceLabel: '支出',
                            usageLabel: '教育進修',
                            cashChange: -1000,
                            balance: latestState.cash - 1000,
                            boardEventId: schoolEventId,
                            details: JSON.stringify({ type: 'promotion_fee', boardEventId: schoolEventId }),
                            flowType: '生活'
                        };
                        stateForExam = {
                            ...latestState,
                            cash: latestState.cash - 1000,
                            history: [feeTransaction, ...(latestState.history || [])]
                        };
                    }
                    normalOutcome = buildSchoolPromotionState(stateForExam, success, commandId, timestamp);
                    nextPlayerState = normalOutcome.state;
                } else if (success) {
                    nextPlayerState = buildLifelongLearningSuccessState(latestState, payload.kind, commandId, timestamp);
                }
                const resultLabel = success
                    ? (payload.kind === 'normal' ? '考試通過' : '學習成功')
                    : '未達標';
                const nextBoardState = { ...latestBoard, updatedAt: timestamp };
                const resultBonus = normalOutcome?.bonus || 0;
                const resultTitle = normalOutcome?.newTitle || latestState.currentRankTitle || '';
                return {
                    boardState: appendDicePresentation(nextBoardState, {
                        id: commandId,
                        sequence: (latestBoard.revision || 0) + 1,
                        playerUid: user.uid,
                        playerName: user.name || '玩家',
                        kind: presentationKind,
                        sourceEventId: payload.sourceEventId || latestBoard.currentEvent?.id,
                        dice: [candidateRoll],
                        total: candidateRoll,
                        target,
                        success,
                        resultLabel,
                        detail: `需 ${target} 點，實際 ${candidateRoll} 點`,
                        bonus: payload.kind === 'normal' ? resultBonus : 0,
                        newTitle: payload.kind === 'normal' ? resultTitle : latestState.currentRankTitle,
                        timestamp
                    }),
                    result: {
                        roll: candidateRoll,
                        dice: [candidateRoll],
                        total: candidateRoll,
                        target,
                        success,
                        bonus: payload.kind === 'normal' ? resultBonus : 0,
                        newTitle: payload.kind === 'normal' ? resultTitle : latestState.currentRankTitle || '',
                        presentationDurationMs: DICE_PRESENTATION_DURATION_MS
                    },
                    roomPatch: nextPlayerState ? { playerStates: { [user.uid]: nextPlayerState } } : undefined
                };
            }
        });
        return result;
    };

    const finishRoomGame = async () => {
        if (!canMutateCurrentRoom()) return;
        if (!room || user?.uid !== room.hostId) return;
        try {
            await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
                status: 'finished'
            }));
            const batch = writeBatch(db);
            room.members.forEach(member => batch.set(
                doc(db, 'users', member.uid),
                { activeGame: deleteField() },
                { merge: true }
            ));
            await batch.commit();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const closeRoom = async () => {
        if (!canMutateCurrentRoom()) return;
        if (!room || user?.uid !== room.hostId) return;
        const roomId = room.id;
        isClosingRoomRef.current = true;
        roomListenerTokenRef.current = null;
        try {
            const batch = writeBatch(db);
            room.members.forEach(member => batch.set(
                doc(db, 'users', member.uid),
                { activeGame: deleteField() },
                { merge: true }
            ));
            await batch.commit();
            await deleteDoc(doc(db, 'rooms', roomId));
            setRoom(null);
            localStorage.removeItem(`active_room_${user.uid}`);
            localStorage.removeItem('hf_practice_mode');
        } catch (err: any) {
            console.error('關閉房間失敗:', err);
            setError(err.message);
            throw err;
        } finally {
            isClosingRoomRef.current = false;
        }
    };

    const buyCurrentRealEstateCard = async (eventId: string, cardId: string, txData: TransactionData): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !user) return false;
        const commandId = `card-purchase:${eventId}:${user.uid}:${cardId}`;
        const result = await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            onDuplicate: latestRoom => latestRoom.boardState?.currentEvent?.id !== eventId,
            mutate: (latestRoom, latestBoard) => {
                if (
                    latestBoard.currentEvent?.id !== eventId ||
                    latestBoard.currentEvent.playerUid !== user.uid ||
                    latestBoard.currentCard?.cardId !== cardId ||
                    latestBoard.currentCard.deck !== 'news'
                ) throw new Error('不動產卡片事件已更新');
                if (txData.assetDetails?.type !== '不動產' || txData.assetDetails.symbol !== cardId) {
                    throw new Error('不動產交易資料已更新，請重新確認卡片');
                }

                const currentState = latestRoom.playerStates?.[user.uid];
                if (!currentState) throw new Error('玩家資料尚未同步完成');
                const nextState = buildRealEstatePurchaseState(currentState, txData, commandId);
                const nextRoom = {
                    ...latestRoom,
                    playerStates: { ...(latestRoom.playerStates || {}), [user.uid]: nextState },
                    boardState: latestBoard
                } as Room;
                const advanced = buildBoardEventAdvanceState(nextRoom);
                if (!advanced?.boardState) throw new Error('不動產卡片無法結案');
                return {
                    boardState: advanced.boardState,
                    roomPatch: { playerStates: { [user.uid]: nextState } },
                    result: true
                };
            }
        }), false, err => setError(err?.message || '不動產購買失敗'));
        return result === true;
    };

    const buyRealEstateFromMarket = async (
        cardId: string,
        attemptId: string,
        txData: TransactionData
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room || !user) return { status: 'failed', message: '目前沒有可用的房間連線' };

        const commandId = `market-purchase:${room.id}:${user.uid}:${cardId}:${attemptId}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentMarket = latestBoard.realEstateMarket || [];
                    if (!currentMarket.includes(cardId)) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '此不動產已出售或已從房市下架' }
                        };
                    }
                    if (!isCurrentRealEstatePurchase(cardId, txData)) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '房市交易資料已更新，請重新選擇物件' }
                        };
                    }

                    const now = Date.now();
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) throw new Error('房市購買資料尚未準備完成');
                    const shortfall = Math.max(0, -(Number(currentState.cash) + txData.cashChange));
                    if (shortfall > 0) {
                        const error = new Error('現金不足，無法購買此房屋') as Error & { code?: string; shortfall?: number };
                        error.code = 'requires_funding';
                        error.shortfall = shortfall;
                        throw error;
                    }

                    const nextState = buildRealEstatePurchaseState(currentState, txData, commandId, now);
                    return {
                        boardState: {
                            ...latestBoard,
                            realEstateMarket: currentMarket.filter(id => id !== cardId),
                            updatedAt: now
                        },
                        roomPatch: { playerStates: { [user.uid]: nextState } },
                        result: { status: 'applied' }
                    };
                }
            });
        } catch (err: any) {
            if (err?.code === 'requires_funding') {
                return { status: 'requires_funding', shortfall: err.shortfall || 0, message: err.message };
            }
            setError(err?.message || '房市物件同步失敗');
            return { status: 'failed', message: err?.message || '房市物件同步失敗' };
        }
    };

    const applyVehicleLoss = async (
        eventId: string,
        cardId: string,
        assetId?: string
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room || !user) return { status: 'failed', message: '目前沒有可用的房間連線' };

        const commandId = `vehicle-loss:${room.id}:${eventId}:${user.uid}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    if (
                        latestBoard.currentEvent?.id !== eventId ||
                        latestBoard.currentEvent.playerUid !== user.uid ||
                        latestBoard.currentCard?.cardId !== cardId ||
                        cardId !== 'C038'
                    ) throw new Error('汽車損失事件已更新');

                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) throw new Error('玩家資料尚未同步完成');
                    const vehicle = currentState.assets.find(asset =>
                        (asset.type === '汽車' || asset.type === '飛行器') &&
                        (!assetId || asset.id === assetId)
                    ) || currentState.assets.find(asset => asset.type === '汽車' || asset.type === '飛行器');
                    const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
                    const advanced = buildBoardEventAdvanceState({
                        ...latestRoom,
                        boardState: { ...latestBoard, cardLog: currentCardLog }
                    });
                    if (!advanced?.boardState) throw new Error('汽車損失事件無法結案');

                    if (!vehicle) {
                        return {
                            boardState: advanced.boardState,
                            roomPatch: (advanced as any).playerStates ? { playerStates: (advanced as any).playerStates } : undefined,
                            result: { status: 'applied', message: '目前沒有汽車，本卡無效果' }
                        };
                    }

                    const nextState = buildVehicleLossState(currentState, {
                        assetId: vehicle.id,
                        claimAmount: vehicle.isInsured ? 400000 : 0
                    }, commandId);
                    const advancedPlayerStates = (advanced as any).playerStates || {};
                    return {
                        boardState: advanced.boardState,
                        roomPatch: { playerStates: { ...advancedPlayerStates, [user.uid]: nextState } },
                        result: { status: 'applied' }
                    };
                }
            });
        } catch (err: any) {
            setError(err?.message || '汽車損失同步失敗');
            return { status: 'failed', message: err?.message || '汽車損失同步失敗' };
        }
    };

    const completeMedicalBoardCardAction = async (
        eventId: string,
        cardId: string,
        txData: TransactionData
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) {
            return { status: 'failed', message: '目前沒有可用的棋盤房間' };
        }

        const commandId = `medical-card:${room.sessionId || room.id}:${eventId}:${user.uid}:${cardId}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    if (
                        latestBoard.currentEvent?.id !== eventId ||
                        latestBoard.currentEvent.playerUid !== user.uid ||
                        latestBoard.currentCard?.cardId !== cardId ||
                        latestBoard.currentCard.deck !== 'opportunity'
                    ) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '醫療卡片事件已更新，請重新開啟卡片' }
                        };
                    }

                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }

                    const applied = buildMedicalBoardCardState({
                        currentState,
                        cardId,
                        eventId,
                        commandId,
                        txData
                    });
                    if (applied.status !== 'applied') {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: {
                                status: applied.status,
                                shortfall: applied.shortfall,
                                message: applied.message
                            }
                        };
                    }

                    return {
                        boardState: latestBoard,
                        roomPatch: { playerStates: { [user.uid]: applied.state } },
                        result: { status: 'applied' }
                    };
                }
            });
        } catch (err: any) {
            const message = err?.code === 'permission-denied'
                ? '醫療卡片同步權限不足，請確認目前仍在這個房間'
                : err?.code === 'unavailable' || err?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前答案後再試一次'
                    : err?.message || '醫療卡片同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const updateMarket = async (updates: Record<string, number>, code: string, isBubble: boolean = false) => {
        if (!canMutateCurrentRoom()) return;
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            // 先獲取當前的 marketPrices 作為 previousMarketPrices
            const currentPrices = room.marketPrices || {};
            const nextPrices = normalizeMarketPrices(updates, currentPrices);
            const nextMarketState = {
                marketUpdates: {
                    updates: nextPrices,
                    code,
                    isBubble,
                    timestamp: Date.now()
                },
                // 保存前一次的價格
                previousMarketPrices: currentPrices,
                // 更新為新的價格
                marketPrices: nextPrices
            };

            const result = await safeAsync(updateDoc(roomRef, nextMarketState), null, (err) => {
                setError(err?.message || '股市行情同步失敗');
            });

            if (result === null) {
                throw new Error('股市行情同步失敗');
            }

            setRoom(prev => prev && prev.id === room.id
                ? { ...prev, ...nextMarketState }
                : prev
            );
        } catch (err: any) {
            console.error('更新行情失敗:', err);
            setError(err.message);
            throw err;
        }
    };

    const revealBoardCard = async (eventId: string, cardId: string): Promise<BoardCardRevealResult> => {
        return executeBoardRevealWithRetry(async () => {
            if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
                throw new Error('棋盤房間尚未準備完成');
            }

            const familyCard = HAPPINESS_CARD_MAP[cardId];
            const opportunityCard = OPPORTUNITY_CARDS.find(card => card.id === cardId);
            const newsCard = NEWS_CARDS.find(card => card.id === cardId);
            const familyRequired = familyCard?.category === '家庭重要歷程' && !!familyCard.otherPlayersCanJoin;
            let sharedKind: SharedCardPrompt['kind'] | null = null;
            if (opportunityCard) sharedKind = getSharedOpportunityKind(cardId);
            else if (newsCard?.type === 'cash_dividend') sharedKind = 'cash_dividend';
            else if (newsCard?.type === 'stock_dividend') sharedKind = 'stock_dividend';
            else if (newsCard?.type === 'large_enterprise') sharedKind = 'investment';
            else if (newsCard?.type === 'small_business') sharedKind = 'startup_loan';

            const promptResult = (latestRoom: Room): { familyPrompt: 'opened' | 'no_target' | 'not_required'; sharedPrompt: 'opened' | 'no_target' | 'not_required' } => ({
                familyPrompt: familyRequired
                    ? latestRoom.boardState?.familyMilestoneJoinPrompt?.sourceEventId === eventId ? 'opened' : 'no_target'
                    : 'not_required',
                sharedPrompt: sharedKind
                    ? latestRoom.boardState?.sharedCardPrompt?.sourceEventId === eventId ? 'opened' : 'no_target'
                    : 'not_required'
            });

            const commandId = `reveal:${eventId}:${cardId}:atomic`;
            return runRoomBoardMutation({
                db,
                roomId: room.id,
                playerStateUids: familyRequired ? [user.uid] : [],
                forcePrivatePlayerStates: familyRequired,
                commandId,
                onDuplicate: latestRoom => promptResult(latestRoom as Room),
                mutate: (latestRoom, latestBoard) => {
                    if (latestBoard.currentEvent?.id !== eventId || latestBoard.currentCard?.cardId !== cardId) {
                        throw new Error('棋盤卡片已更新');
                    }
                    const reveal = buildBoardCardRevealState(
                        { ...latestRoom, boardState: latestBoard } as Room,
                        eventId,
                        cardId,
                        user.uid,
                        user.name || '玩家'
                    );
                    return {
                        boardState: reveal.boardState,
                        result: reveal.result
                    };
                }
            });
        });
    };

    const advanceBoardEventQueue = async (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup') => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState) return false;

        const { boardState } = room;
        if (expectedType && boardState.currentEvent?.type !== expectedType) return false;

        // Event Completion Guard: Ensure no pending shared events
        if (hasIncompleteSharedPrompts(boardState)) {
            alert('還有玩家尚未完成共享事件回覆，請等待所有人完成後再推進事件。');
            return false;
        }

        const commandId = `advance:${boardState.currentEvent?.id || 'none'}:${expectedType || 'event'}`;

        const advanced = await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [boardState.currentEvent?.playerUid || boardState.movement?.playerUid || user.uid],
            forcePrivatePlayerStates: true,
            onDuplicate: () => true,
            mutate: (currentRoom, currentBoardState) => {
                if (expectedType && currentBoardState.currentEvent?.type !== expectedType) {
                    return { boardState: currentBoardState, commit: false, result: false };
                }

                if (currentBoardState.currentEvent?.id !== boardState.currentEvent?.id) {
                    return { boardState: currentBoardState, commit: false, result: false };
                }

            // 醫院事件完成時才寫入停回合：未投保者在財務檢核後完成，已投保者則在
            // 保險抵免後直接完成；兩者都不得在棋子抵達時提前生效。
            let roomForAdvance = currentRoom;
            const hospitalSkipTurns = currentBoardState.currentEvent?.hospitalSkipTurns;
            if (expectedType === 'hospital' && hospitalSkipTurns && currentBoardState.currentEvent?.playerUid) {
                const hospitalPlayerUid = currentBoardState.currentEvent.playerUid;
                roomForAdvance = {
                    ...currentRoom,
                    boardState: {
                        ...currentBoardState,
                        skipTurns: {
                            ...currentBoardState.skipTurns,
                            [hospitalPlayerUid]: Math.max(currentBoardState.skipTurns?.[hospitalPlayerUid] || 0, hospitalSkipTurns)
                        }
                    }
                };
            }

            const repairSkipTurns = currentBoardState.currentEvent?.repairSkipTurns;
            if (expectedType === 'repair' && repairSkipTurns && currentBoardState.currentEvent?.playerUid) {
                const repairPlayerUid = currentBoardState.currentEvent.playerUid;
                const baseBoardState = roomForAdvance.boardState || currentBoardState;
                roomForAdvance = {
                    ...roomForAdvance,
                    boardState: {
                        ...baseBoardState,
                        skipTurns: {
                            ...baseBoardState.skipTurns,
                            [repairPlayerUid]: Math.max(baseBoardState.skipTurns?.[repairPlayerUid] || 0, repairSkipTurns)
                        }
                    }
                };
            }

            const nextState = buildBoardEventAdvanceState(roomForAdvance as Room);
            if (!nextState) return { boardState: currentBoardState, commit: false, result: false };

            const currentCardLog = appendBoardCardLog(currentBoardState, currentBoardState.currentCard, currentBoardState.currentEvent);
            const committedBoard = applyBoardCommand({
                ...(nextState.boardState || currentBoardState),
                cardLog: nextState.boardState?.currentCard
                    ? appendBoardCardLog({ ...currentBoardState, cardLog: currentCardLog }, nextState.boardState.currentCard, nextState.boardState.currentEvent)
                    : currentCardLog,
                updatedAt: Date.now()
            }, commandId).boardState;
                const { boardState: _nextBoard, playerStates, ...roomPatch } = nextState as Room;
                return {
                    boardState: committedBoard,
                    roomPatch: {
                        ...roomPatch,
                        ...(playerStates ? { playerStates } : {})
                    },
                    result: true
                };
            }
        }), false, err => setError(err?.message || '事件結案同步失敗'));
        return advanced === true;

    });

    // 回合不再於事件結算後自動切換，玩家必須自己確認所有動作都完成後按下
    // 「結束回合」才會真正換到下一位，比照大富翁的回合節奏。
    const endTurn = async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
            throw new Error('棋盤房間尚未同步完成');
        }
        const commandId = `turn-end:${user.uid}:${room.boardState.revision || 0}`;

        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            onDuplicate: () => undefined,
            mutate: (_currentRoom, currentBoardState) => ({
                boardState: buildNextBoardTurnState(currentBoardState, user.uid),
                result: undefined
            })
        });
    };

    const dismissBoardCard = async (eventId: string, cardId: string, addToRealEstateMarket = false): Promise<boolean> => (await executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState) return false;

        const { boardState } = room;
        const isCurrentCard =
            boardState.currentEvent?.id === eventId &&
            boardState.currentCard?.cardId === cardId;

        if (!isCurrentCard) return false;

        if (hasIncompleteSharedPrompts(boardState)) return false;
        const commandId = `dismiss:${eventId}:${cardId}${addToRealEstateMarket ? ':market' : ''}`;

        return runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [boardState.currentEvent?.playerUid || user.uid],
            onDuplicate: latestRoom => latestRoom.boardState?.currentEvent?.id !== eventId,
            mutate: (currentRoom, currentBoardState) => {
                const isStillCurrentCard =
                    currentBoardState.currentEvent?.id === eventId &&
                    currentBoardState.currentCard?.cardId === cardId;
                if (!isStillCurrentCard) return { boardState: currentBoardState, commit: false, result: true };

                if (hasIncompleteSharedPrompts(currentBoardState)) {
                    return { boardState: currentBoardState, commit: false, result: false };
                }
                const nextState = buildBoardEventAdvanceState({ ...currentRoom, boardState: currentBoardState } as Room);
                if (!nextState) return { boardState: currentBoardState, commit: false, result: false };

                const currentCardLog = appendBoardCardLog(currentBoardState, currentBoardState.currentCard, currentBoardState.currentEvent);
                const nextMarket = addToRealEstateMarket
                    ? addRealEstateCardToMarket(nextState.boardState?.realEstateMarket || currentBoardState.realEstateMarket || [], cardId)
                    : nextState.boardState?.realEstateMarket;
                const committedBoard = applyBoardCommand({
                    ...(nextState.boardState || currentBoardState),
                    ...(nextMarket ? { realEstateMarket: nextMarket } : {}),
                    cardLog: nextState.boardState?.currentCard
                        ? appendBoardCardLog({ ...currentBoardState, cardLog: currentCardLog }, nextState.boardState.currentCard, nextState.boardState.currentEvent)
                        : currentCardLog,
                    updatedAt: Date.now()
                }, commandId).boardState;
                const { boardState: _nextBoard, playerStates, ...roomPatch } = nextState as Room;
                return {
                    boardState: committedBoard,
                    roomPatch: {
                        ...roomPatch,
                        ...(playerStates ? { playerStates } : {})
                    },
                    result: true
                };
            }
        });
    })) ?? false;

    const drawPostExamHappinessCard = async (success: boolean) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !room.isBoardGame || !user) return;
        const commandId = `draw-post:${room.boardState?.currentEvent?.id || 'none'}:${success ? 'success' : 'failure'}`;

        // H1：牌堆抽卡（deckState 的 shift/push）必須以交易當下的最新狀態為準，
        // 直接拿本地 room 快照整包覆寫，若和其他並發寫入（例如另一個棋盤事件
        // 剛好也在更新 boardState）交錯，會把對方的結果連同這次抽卡一起蓋掉，
        // 也可能因為用了過期的 deckState 導致抽到已經被抽走的卡。
        await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            onDuplicate: () => undefined,
            mutate: (currentRoom, currentBoardState) => {
                if (
                    currentBoardState.currentEvent?.type !== 'school' ||
                    currentBoardState.currentEvent.playerUid !== user.uid ||
                    currentBoardState.currentCard
                ) {
                    throw new Error('學校考試事件已更新');
                }
                const drawResult = drawBoardCard(currentBoardState.deckState, 'happiness', currentRoom.playerStates?.[user.uid]);
                if (!drawResult) return { boardState: currentBoardState, commit: false, result: undefined };

            const timestamp = Date.now();
            const eventId = `${user.uid}_${timestamp}_exam_happiness`;
                const playerName = (currentRoom as Room).members.find(member => member.uid === user.uid)?.name || user.name || '玩家';
            const event: BoardEventLog = {
                id: eventId,
                playerUid: user.uid,
                playerName,
                type: 'exam_happiness',
                summary: `${playerName}${success ? '考完升等考試' : '完成升等考試'}後抽到幸福卡`,
                detail: `考試結束後抽到幸福卡：${drawResult.card.title}`,
                squareIndex: currentBoardState.playerPositions?.[user.uid] || 0,
                timestamp,
                rollTotal: currentBoardState.lastRoll?.total || 0
            };

            const nextBoard = applyBoardCommand({
                ...currentBoardState,
                deckState: drawResult.deckState,
                currentCard: drawResult.card,
                currentCardReveal: {
                    eventId,
                    cardId: drawResult.card.cardId,
                    isRevealed: false
                },
                currentEvent: event,
                pendingEvents: currentBoardState.pendingEvents || [],
                cardLog: appendBoardCardLog(currentBoardState, drawResult.card, event),
                updatedAt: timestamp
            }, commandId).boardState;
                return { boardState: nextBoard, result: undefined };
            }
        }));
    };

    const drawBoardFollowupCard = async (deck: 'happiness' | 'news', summary: string, detail?: string) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !room.isBoardGame || !user) return;
        const commandId = `draw-followup:${room.boardState?.currentEvent?.id || 'none'}:${deck}`;

        // H1：同 drawPostExamHappinessCard，改用交易避免用過期的本地 deckState
        // 快照覆寫掉並發寫入的 boardState，或抽到已經被抽走的卡片。
        await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            onDuplicate: () => undefined,
            mutate: (currentRoom, currentBoardState) => {
                const drawResult = drawBoardCard(currentBoardState.deckState, deck, currentRoom.playerStates?.[user.uid]);
                if (!drawResult) return { boardState: currentBoardState, commit: false, result: undefined };

            const timestamp = Date.now();
            const eventId = `${user.uid}_${timestamp}_${deck}_followup`;
                const playerName = (currentRoom as Room).members.find(member => member.uid === user.uid)?.name || user.name || '玩家';
            const event: BoardEventLog = {
                id: eventId,
                playerUid: user.uid,
                playerName,
                type: 'followup',
                summary,
                detail: detail || `接續效果抽到${deck === 'happiness' ? '幸福卡' : '新聞卡'}：${drawResult.card.title}`,
                squareIndex: currentBoardState.playerPositions?.[user.uid] || 0,
                timestamp,
                rollTotal: currentBoardState.lastRoll?.total || 0
            };

            const nextBoard = applyBoardCommand({
                ...currentBoardState,
                deckState: drawResult.deckState,
                currentCard: drawResult.card,
                currentCardReveal: {
                    eventId,
                    cardId: drawResult.card.cardId,
                    isRevealed: false
                },
                currentEvent: event,
                pendingEvents: currentBoardState.pendingEvents || [],
                cardLog: appendBoardCardLog(currentBoardState, drawResult.card, event),
                updatedAt: timestamp
            }, commandId).boardState;
                return { boardState: nextBoard, result: undefined };
            }
        }));
    };

    const openFamilyMilestoneJoinPrompt = async (eventId: string, cardId: string, sourceStageProgressId?: string) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return;

        const sourceCard = HAPPINESS_CARDS.find(card => card.id === cardId);
        if (!sourceCard || sourceCard.category !== '家庭重要歷程' || !sourceCard.otherPlayersCanJoin) return;

        const isCurrentCard =
            room.boardState.currentEvent?.id === eventId &&
            room.boardState.currentCard?.cardId === cardId &&
            room.boardState.currentEvent?.playerUid === user.uid;

        if (!isCurrentCard) return;

        const promptId = `${eventId}_${cardId}_family_join`;
        if (room.boardState.familyMilestoneJoinPrompt?.id === promptId) return;

        const opened = await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: `prompt:family:${promptId}`,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                if (latestBoard.currentEvent?.id !== eventId || latestBoard.currentCard?.cardId !== cardId || latestBoard.currentEvent?.playerUid !== user.uid) {
                    throw new Error('家庭共享事件已更新');
                }
                const latestSourceState = latestRoom.playerStates?.[user.uid];
                if (isFamilyMilestoneComplete(latestSourceState)) {
                    return { boardState: latestBoard, commit: false, result: false };
                }
                const targetPlayerUids = (latestRoom.members || [])
                    .filter(member => member.uid !== latestRoom.hostId && member.uid !== user.uid && !member.isLeft)
                    .filter(member => !isFamilyMilestoneComplete(latestRoom.playerStates?.[member.uid]))
                    .map(member => member.uid);
                if (targetPlayerUids.length === 0) {
                    return { boardState: latestBoard, commit: false, result: false };
                }
                const latestFamilyStatus = latestSourceState ? getFamilyMilestoneStatus(latestSourceState) : null;
                const latestSourceStageProgressId = latestFamilyStatus && latestFamilyStatus.currentStageIndex >= 0
                    ? latestFamilyStatus.stages[latestFamilyStatus.currentStageIndex]?.progressId
                    : sourceStageProgressId;
                const prompt: FamilyMilestoneJoinPrompt = {
                    id: promptId,
                    sourceEventId: eventId,
                    sourceCardId: cardId,
                    sourcePlayerUid: user.uid,
                    sourcePlayerName: latestBoard.currentEvent?.playerName || user.name || '玩家',
                    sourceStageProgressId: latestSourceStageProgressId,
                    sourceActionCompleted: false,
                    requiredRoll: sourceCard.joinDiceMin || 4,
                    targetPlayerUids,
                    responses: {},
                    responseStorage: latestRoom.syncSchemaVersion === 2 ? 'subcollection' : 'room',
                    createdAt: Date.now()
                };
                return {
                    boardState: { ...latestBoard, familyMilestoneJoinPrompt: prompt, updatedAt: Date.now() },
                    result: true
                };
            }
        });
        if (!opened) return;
    };

    const openSharedCardPrompt = async (eventId: string, cardId: string): Promise<'opened' | 'no_target' | false> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return false;

        const opportunityCard = OPPORTUNITY_CARDS.find(card => card.id === cardId);
        const newsCard = NEWS_CARDS.find(card => card.id === cardId);
        const promptId = `${eventId}_${cardId}_shared`;

        if (room.boardState.sharedCardPrompt?.id === promptId) return 'opened';

        const isCurrentCard =
            room.boardState.currentEvent?.id === eventId &&
            room.boardState.currentCard?.cardId === cardId &&
            room.boardState.currentEvent?.playerUid === user.uid;

        if (!isCurrentCard) return false;

        let kind: SharedCardPrompt['kind'] | null = null;
        if (opportunityCard) {
            kind = getSharedOpportunityKind(cardId);
        } else if (newsCard?.type === 'cash_dividend') {
            kind = 'cash_dividend';
        } else if (newsCard?.type === 'stock_dividend') {
            kind = 'stock_dividend';
        } else if (newsCard?.type === 'large_enterprise') {
            kind = 'investment';
        } else if (newsCard?.type === 'small_business') {
            kind = 'startup_loan';
        }

        if (!kind) return false;

        try {
            const opened = await runRoomBoardMutation({
                db,
                roomId: room.id,
                commandId: `prompt:shared:${promptId}`,
                playerStateUids: [],
                onDuplicate: () => undefined,
                mutate: (latestRoom, latestBoard) => {
                    if (latestBoard.currentEvent?.id !== eventId || latestBoard.currentCard?.cardId !== cardId || latestBoard.currentEvent?.playerUid !== user.uid) {
                        throw new Error('共享卡片事件已更新');
                    }
                    const targetPlayerUids = getSharedCardTargetPlayerUids(latestRoom.members || [], latestRoom.hostId || '', user.uid);
                    if (targetPlayerUids.length === 0) {
                        return { boardState: latestBoard, commit: false, result: 'no_target' as const };
                    }
                    const prompt: SharedCardPrompt = {
                        id: promptId,
                        kind,
                        sourceEventId: eventId,
                        sourceCardId: cardId,
                        sourcePlayerUid: user.uid,
                        sourcePlayerName: latestBoard.currentEvent?.playerName || user.name || '玩家',
                        targetPlayerUids,
                        responses: {},
                        responseStorage: latestRoom.syncSchemaVersion === 2 ? 'subcollection' : 'room',
                        createdAt: Date.now()
                    };
                    return {
                        boardState: { ...latestBoard, sharedCardPrompt: prompt, updatedAt: Date.now() },
                        result: 'opened' as const
                    };
                }
            });
            if (opened === 'no_target') return opened;
        } catch (err: any) {
            setError(err?.message || '共享卡片提示建立失敗');
            return false;
        }

        return 'opened';
    };

const finalizeFamilyMilestoneJoinPrompt = async (promptId: string) => {
        if (!room?.id || !user) return false;
        if (room.hostId !== user.uid && user.role !== 'coach' && user.role !== 'gm') return false;

        const result = await safeAsync(runRoomBoardMutation<boolean, Room>({
            db,
            roomId: room.id,
            commandId: `prompt:family:finalize:${promptId}:${user.uid}`,
            playerStateUids: [],
            forcePrivatePlayerStates: false,
            onDuplicate: latestRoom => {
                const latestPrompt = latestRoom.boardState?.familyMilestoneJoinPrompt;
                return !latestPrompt || latestPrompt.id !== promptId;
            },
            mutate: (latestRoom, latestBoard) => {
                const latestPrompt = latestBoard.familyMilestoneJoinPrompt;
                if (!latestPrompt || latestPrompt.id !== promptId) {
                    return { boardState: latestBoard, commit: false, result: true };
                }
                if (!isBoardPromptForCurrentEvent(latestPrompt, latestBoard) ||
                    latestPrompt.sourceActionCompleted !== true ||
                    hasIncompleteSharedPrompts(latestBoard)) {
                    return { boardState: latestBoard, commit: false, result: false };
                }

                const transition = buildCompletedFamilyTransition(latestRoom as Room, latestBoard, latestPrompt);
                if (!transition) {
                    return { boardState: latestBoard, commit: false, result: false };
                }
                return {
                    boardState: transition.boardState,
                    roomPatch: transition.roomPatch,
                    result: true
                };
            }
        }), false);
    return result === true;
};

// schema v2 家庭歷程回覆各自監聽 response 文件；房主／執行師讀完整集合，
// 玩家只讀自己的文件，避免多人同時擲骰改寫同一個房間 Map。
useEffect(() => {
        const prompt = room?.boardState?.familyMilestoneJoinPrompt;
        if (!user || !room?.id || room.syncSchemaVersion !== 2 || prompt?.responseStorage !== 'subcollection') return;

        const isRoomCoach = room.hostId === user.uid || user.role === 'coach' || user.role === 'gm';
        const responsesRef = collection(db, 'rooms', room.id, 'events', prompt.id, 'responses');
        let finalizeTimer: number | null = null;
        const handleResponses = (responses: Record<string, FamilyMilestoneJoinResponse>) => {
            setRoom(prev => {
                if (!prev?.boardState?.familyMilestoneJoinPrompt || prev.boardState.familyMilestoneJoinPrompt.id !== prompt.id) return prev;
                const currentResponses = prev.boardState.familyMilestoneJoinPrompt.responses || {};
                if (Object.entries(responses).every(([uid, response]) =>
                    JSON.stringify(currentResponses[uid]) === JSON.stringify(response))) return prev;
                return {
                    ...prev,
                    boardState: {
                        ...prev.boardState,
                        familyMilestoneJoinPrompt: {
                            ...prev.boardState.familyMilestoneJoinPrompt,
                            responses: {
                                ...(prev.boardState.familyMilestoneJoinPrompt.responses || {}),
                                ...responses
                            }
                        }
                    }
                };
            });

            if (isRoomCoach && finalizeTimer === null) {
                const mergedPrompt = { ...prompt, responses: { ...(prompt.responses || {}), ...responses } };
                // hasIncompleteSharedPrompts 會把「骰子動畫尚未播完」也算成未完成，導致在回覆剛寫入
                // 的那一刻永遠不排程結案；這裡只判斷是否全部回覆並完成，再等動畫結束後結案。
                const everyTargetDone = mergedPrompt.targetPlayerUids.every(uid => {
                    const response = mergedPrompt.responses?.[uid];
                    return !!response && (response.status !== 'passed' || response.actionCompleted === true);
                });
                if (mergedPrompt.sourceActionCompleted && everyTargetDone) {
                    const presentationReadyAt = Math.max(
                        0,
                        ...mergedPrompt.targetPlayerUids.map(uid => mergedPrompt.responses?.[uid]?.presentationReadyAt || 0)
                    );
                    const delay = Math.max(0, presentationReadyAt - Date.now()) + 50;
                    finalizeTimer = window.setTimeout(() => {
                        finalizeTimer = null;
                        void finalizeFamilyMilestoneJoinPrompt(prompt.id);
                    }, delay);
                }
            }
        };
        const handleError = (error: { code?: string }) => {
            console.error('監聽家庭歷程回覆失敗:', error);
            if (error.code === 'permission-denied') setError('家庭歷程回覆同步權限不足，請重新整理後再試一次');
        };

        const unsubscribe = isRoomCoach
            ? onSnapshot(responsesRef, snapshot => {
                handleResponses(Object.fromEntries(
                    snapshot.docs.map(responseDoc => [responseDoc.id, responseDoc.data() as FamilyMilestoneJoinResponse])
                ));
            }, handleError)
            : onSnapshot(doc(db, 'rooms', room.id, 'events', prompt.id, 'responses', user.uid), snapshot => {
                handleResponses(snapshot.exists() ? { [user.uid]: snapshot.data() as FamilyMilestoneJoinResponse } : {});
            }, handleError);
        return () => {
            unsubscribe();
            if (finalizeTimer !== null) window.clearTimeout(finalizeTimer);
        };
    // sourceActionCompleted 必須列入依賴：抽卡者先完成、參與者後回覆時，監聽器內的 prompt 若還是
    // 建立當下的舊快照（sourceActionCompleted=false），就永遠不會結案，回合也無法結束。
    }, [room?.id, room?.hostId, room?.syncSchemaVersion, room?.boardState?.familyMilestoneJoinPrompt?.id, room?.boardState?.familyMilestoneJoinPrompt?.responseStorage, room?.boardState?.familyMilestoneJoinPrompt?.sourceActionCompleted, user?.role, user?.uid, finalizeFamilyMilestoneJoinPrompt]);

    const familyJoinSubmitErrorRef = useRef('');
    const submitFamilyMilestoneJoinResponse = async (payload: {
        promptId: string;
        status: 'passed' | 'failed' | 'declined';
        roll?: number;
        cardId: string;
    }) => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return false;

        const prompt = room.boardState.familyMilestoneJoinPrompt;
        if (!prompt || prompt.id !== payload.promptId) return false;
        if (!prompt.targetPlayerUids.includes(user.uid)) return false;
        if (payload.roll !== undefined && (!Number.isInteger(payload.roll) || payload.roll < 1 || payload.roll > 6)) return false;

        let shouldFinalizeFamilyPrompt = false;
        familyJoinSubmitErrorRef.current = '';
        const result = await safeAsync(runRoomBoardMutation<FamilyMilestoneJoinResponse | false, Room>({
            db,
            roomId: room.id,
            commandId: `prompt:family:response:${payload.promptId}:${user.uid}`,
            playerStateUids: payload.status === 'passed' ? [user.uid] : [],
            responseReadUid: prompt.responseStorage === 'subcollection' ? user.uid : undefined,
            forcePrivatePlayerStates: payload.status === 'passed',
            retryOnPermissionDenied: prompt.responseStorage !== 'subcollection',
            onDuplicate: latestRoom => {
                const latestPrompt = latestRoom.boardState?.familyMilestoneJoinPrompt;
                shouldFinalizeFamilyPrompt = !!latestPrompt &&
                    latestPrompt.id === payload.promptId &&
                    latestPrompt.sourceActionCompleted === true &&
                    !hasIncompleteSharedPrompts(latestRoom.boardState);
                return latestPrompt?.responses?.[user.uid] || false;
            },
            mutate: (latestRoom, latestBoard) => {
                const latestPrompt = latestBoard.familyMilestoneJoinPrompt;
                if (!latestPrompt || latestPrompt.id !== payload.promptId) {
                    return { boardState: latestBoard, commit: false, result: false };
                }
                if (latestPrompt.responses?.[user.uid]) {
                    shouldFinalizeFamilyPrompt = latestPrompt.sourceActionCompleted === true &&
                        !hasIncompleteSharedPrompts(latestBoard);
                    return { boardState: latestBoard, commit: false, result: latestPrompt.responses[user.uid] };
                }

                const latestPlayerState = latestRoom.playerStates?.[user.uid];
                if (payload.status === 'passed' && !latestPlayerState) {
                    throw new Error('玩家資料尚未同步完成，請稍後再擲一次');
                }
                const familyStatus = latestPlayerState ? getFamilyMilestoneStatus(latestPlayerState) : null;
                const participantStage = familyStatus && familyStatus.currentStageIndex >= 0
                    ? familyStatus.stages[familyStatus.currentStageIndex]
                    : null;
                const responseTimestamp = Date.now();
                const response = cleanObject({
                    playerUid: user.uid,
                    playerName: user.name || '玩家',
                    status: payload.status,
                    actionCompleted: payload.status !== 'passed' || !participantStage,
                    stageProgressId: participantStage?.progressId,
                    roll: payload.roll,
                    respondedAt: responseTimestamp,
                    presentationReadyAt: payload.roll !== undefined
                        ? getFamilyDicePresentationReadyAt(responseTimestamp)
                        : undefined
                });

                const nextPrompt = {
                    ...latestPrompt,
                    responses: { ...(latestPrompt.responses || {}), [user.uid]: response }
                };
                shouldFinalizeFamilyPrompt = latestPrompt.sourceActionCompleted === true &&
                    !hasIncompleteSharedPrompts({ ...latestBoard, familyMilestoneJoinPrompt: nextPrompt });
                const nextState = payload.status === 'passed' && participantStage && latestPlayerState
                    ? cleanObject({
                        ...latestPlayerState,
                        pendingFamilyMilestoneJoinAction: {
                            promptId: payload.promptId,
                            cardId: payload.cardId,
                            sourcePlayerUid: latestPrompt.sourcePlayerUid,
                            stageProgressId: participantStage.progressId
                        },
                        pendingCardAction: `${latestPrompt.sourcePlayerName} 抽到家庭重要歷程，你擲出 ${payload.roll} 點並成功加入。`,
                        lastBoardEvent: '家庭重要歷程同步參與'
                    })
                    : undefined;

                return {
                    boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: responseTimestamp },
                    roomPatch: nextState ? { playerStates: { [user.uid]: nextState } } : undefined,
                    sharedResponse: { uid: user.uid, response },
                    result: response
                };
            }
        }), false, err => {
            familyJoinSubmitErrorRef.current = err?.code ? `${err.code}: ${err.message || ''}` : (err?.message || '');
            setError(err?.message || '家庭重要歷程回覆失敗');
        });
        if (result && shouldFinalizeFamilyPrompt && (room.hostId === user.uid || user.role === 'coach' || user.role === 'gm')) {
            // The Rules validate the response write and prompt deletion against
            // different document states. Keep them as two atomic transactions.
            await finalizeFamilyMilestoneJoinPrompt(payload.promptId);
        }
        return result || false;
    };

    const rollFamilyMilestoneJoin = async (promptId: string, cardId: string): Promise<{ roll: number; status: 'passed' | 'failed'; presentationReadyAt: number }> => {
        if (!room?.boardState?.familyMilestoneJoinPrompt || room.boardState.familyMilestoneJoinPrompt.id !== promptId) {
            throw new Error('家庭歷程參與事件已更新');
        }
        if (!user?.uid || !room.boardState.familyMilestoneJoinPrompt.targetPlayerUids.includes(user.uid)) {
            throw new Error('目前玩家不是此家庭歷程的參與對象');
        }
        const roll = rollBoardDie();
        const status = roll >= room.boardState.familyMilestoneJoinPrompt.requiredRoll ? 'passed' : 'failed';
        const submitted = await submitFamilyMilestoneJoinResponse({
            promptId,
            status,
            roll,
            cardId
        });
        if (!submitted) {
            const detail = familyJoinSubmitErrorRef.current;
            console.error('Family milestone join sync failed:', detail || 'mutation returned false');
            throw new Error(`家庭歷程參與結果同步失敗，請再試一次${detail ? `（${detail}）` : ''}`);
        }
        const submittedStatus = submitted.status === 'passed' || submitted.status === 'failed'
            ? submitted.status
            : status;
        return {
            roll: submitted.roll ?? roll,
            status: submittedStatus,
            presentationReadyAt: submitted.presentationReadyAt || getFamilyDicePresentationReadyAt(submitted.respondedAt || Date.now())
        };
    };

    const clearPendingFamilyMilestoneJoinAction = async (promptId: string) => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !user) return false;

        const currentPending = room.playerStates?.[user.uid]?.pendingFamilyMilestoneJoinAction;
        if (!currentPending || currentPending.promptId !== promptId) return true;

        const result = await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: `prompt:family:action-complete:${promptId}:${user.uid}`,
            playerStateUids: [user.uid],
            responseReadUid: room.boardState?.familyMilestoneJoinPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
            forcePrivatePlayerStates: true,
            retryOnPermissionDenied: room.boardState?.familyMilestoneJoinPrompt?.responseStorage !== 'subcollection',
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const latestState = latestRoom.playerStates?.[user.uid];
                const nextState = latestState ? { ...latestState } : undefined;
                if (nextState?.pendingFamilyMilestoneJoinAction?.promptId === promptId) {
                    delete nextState.pendingFamilyMilestoneJoinAction;
                }

                const latestPrompt = latestBoard.familyMilestoneJoinPrompt;
                const latestResponse = latestPrompt?.id === promptId
                    ? latestPrompt.responses?.[user.uid]
                    : undefined;
                if (!latestState?.pendingFamilyMilestoneJoinAction && (!latestResponse || latestResponse.actionCompleted)) {
                    return { boardState: latestBoard, commit: false, result: undefined };
                }
                const nextPrompt = latestPrompt && latestResponse
                    ? {
                        ...latestPrompt,
                        responses: {
                            ...latestPrompt.responses,
                            [user.uid]: { ...latestResponse, actionCompleted: true }
                        }
                    }
                    : latestPrompt;

                const completedTransition = latestPrompt && nextPrompt
                    ? buildCompletedFamilyTransition(latestRoom as Room, latestBoard, nextPrompt)
                    : null;
                if (completedTransition) {
                    return {
                        boardState: completedTransition.boardState,
                        roomPatch: {
                            ...(completedTransition.roomPatch || {}),
                            ...(nextState ? { playerStates: { [user.uid]: cleanObject(nextState) } } : {})
                        },
                        ...(nextPrompt?.responses?.[user.uid]
                            ? { sharedResponse: { uid: user.uid, response: nextPrompt.responses[user.uid] } }
                            : {}),
                        result: undefined
                    };
                }

                return {
                    boardState: {
                        ...latestBoard,
                        familyMilestoneJoinPrompt: nextPrompt,
                        updatedAt: Date.now()
                    },
                    roomPatch: nextState ? { playerStates: { [user.uid]: cleanObject(nextState) } } : undefined,
                    ...(nextPrompt?.responses?.[user.uid]
                        ? { sharedResponse: { uid: user.uid, response: nextPrompt.responses[user.uid] } }
                        : {}),
                    result: undefined
                };
            }
        }), null, err => {
            setError(err?.message || '清除家庭重要歷程等待狀態失敗');
        });
        return result !== null;
    };

    const markFamilyMilestoneSourceActionCompleted = async (promptId: string) => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !room.isBoardGame || !user) return false;

        const result = await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: `prompt:family:source-complete:${promptId}:${user.uid}`,
            playerStateUids: [user.uid],
            responseReadUid: room.boardState?.familyMilestoneJoinPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
            forcePrivatePlayerStates: true,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const prompt = latestBoard.familyMilestoneJoinPrompt;
                if (!prompt || prompt.id !== promptId || prompt.sourcePlayerUid !== user.uid) {
                    return { boardState: latestBoard, commit: false, result: false };
                }

                const nextPrompt = { ...prompt, sourceActionCompleted: true };
                const completedTransition = buildCompletedFamilyTransition(latestRoom as Room, latestBoard, nextPrompt);
                if (completedTransition) {
                    return {
                        boardState: completedTransition.boardState,
                        roomPatch: completedTransition.roomPatch,
                        result: true
                    };
                }

                return {
                    boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: Date.now() },
                    result: true
                };
            }
        }), false, err => {
            setError(err?.message || '家庭重要歷程主流程同步失敗');
        });
        return result === true;
    };

    const completeFamilyMilestoneAction = async (payload: { promptId: string; accepted: boolean; forcedDebtAmount?: number; fundingLoanAmount?: number }) => {
        const failedResult = (message: string) => ({ status: 'failed' as const, message });
        if (!canMutateCurrentRoom()) return failedResult('此分頁目前為唯讀');
        if (!room?.id || !room.isBoardGame || !user) return failedResult('目前沒有可同步的家庭歷程事件');

        try {
            const result = await runRoomBoardMutation<{
                status: 'applied' | 'duplicate' | 'requires_funding' | 'failed';
                shortfall?: number;
                message?: string;
                finalizeSource?: boolean;
            }, Room>({
                db,
                roomId: room.id,
                commandId: `family-action:${payload.promptId}:${user.uid}:${payload.accepted ? 'accept' : 'decline'}`,
                playerStateUids: [user.uid],
                responseReadUid: room.boardState?.familyMilestoneJoinPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
                forcePrivatePlayerStates: true,
                retryOnPermissionDenied: room.boardState?.familyMilestoneJoinPrompt?.responseStorage !== 'subcollection',
                onDuplicate: latestRoom => {
                    const latestPrompt = latestRoom.boardState?.familyMilestoneJoinPrompt;
                    const finalizeSource = !!latestPrompt &&
                        latestPrompt.id === payload.promptId &&
                        latestPrompt.sourcePlayerUid === user.uid &&
                        latestPrompt.sourceActionCompleted === true &&
                        !hasIncompleteSharedPrompts(latestRoom.boardState);
                    return { status: 'duplicate' as const, finalizeSource };
                },
                mutate: (latestRoom, latestBoard) => {
                    const prompt = latestBoard.familyMilestoneJoinPrompt;
                    if (!prompt || prompt.id !== payload.promptId || !isBoardPromptForCurrentEvent(prompt, latestBoard)) {
                        return { boardState: latestBoard, commit: false, result: failedResult('家庭歷程事件已更新或已完成，請重新整理確認目前狀態') };
                    }

                    const isSource = prompt.sourcePlayerUid === user.uid;
                    const response = prompt.responses?.[user.uid];
                    if (!isSource && (!prompt.targetPlayerUids.includes(user.uid) || response?.status !== 'passed')) {
                        return { boardState: latestBoard, commit: false, result: failedResult('目前尚未取得參與資格，請先完成擲骰或等待最新同步') };
                    }

                    const progressId = isSource ? prompt.sourceStageProgressId : response?.stageProgressId;
                    const stage = getFamilyMilestoneStageByProgressId(progressId);
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (payload.accepted && (!stage || !currentState)) {
                        return { boardState: latestBoard, commit: false, result: failedResult('玩家資料尚未完成同步，請重新整理後重試') };
                    }

                    let nextState = currentState;
                    let status: 'applied' | 'duplicate' = payload.accepted ? 'applied' : 'duplicate';
                    if (payload.accepted && stage && currentState) {
                        const operationId = `family:${prompt.id}:${user.uid}:${stage.progressId}`;
                        const applied = applyFamilyMilestoneStage(
                            currentState,
                            stage,
                            operationId,
                            Date.now(),
                            payload.forcedDebtAmount,
                            payload.fundingLoanAmount
                        );
                        if (applied.status === 'insufficient') {
                            throw new Error(`FAMILY_INSUFFICIENT:${applied.shortfall}`);
                        }
                        if (applied.status === 'failed') {
                            throw new Error(`FAMILY_FUNDING_FAILED:${applied.message}`);
                        }
                        status = applied.status;
                        nextState = applied.state;
                    }

                    if (nextState?.pendingFamilyMilestoneJoinAction?.promptId === prompt.id) {
                        nextState = { ...nextState };
                        delete nextState.pendingFamilyMilestoneJoinAction;
                    }

                    const nextPrompt: FamilyMilestoneJoinPrompt = isSource
                        ? { ...prompt, sourceActionCompleted: true }
                        : {
                            ...prompt,
                            responses: {
                                ...prompt.responses,
                                [user.uid]: { ...response!, actionCompleted: true }
                            }
                        };
                    const completedTransition = buildCompletedFamilyTransition(latestRoom as Room, latestBoard, nextPrompt);
                    const roomPatch = nextState ? { playerStates: { [user.uid]: cleanObject(nextState) } } : undefined;

                    // 所有人完成後，來源玩家與最後一位參與玩家都把結果、
                    // prompt 結案及回合推進放在同一筆 transaction，避免兩筆
                    // 寫入之間被監聽快照或權限判定打斷。舊版已提交過 source
                    // action 的 command 仍保留下方 finalizeSource 相容路徑。
                    if (completedTransition) {
                        return {
                            boardState: completedTransition.boardState,
                            roomPatch: {
                                ...(completedTransition.roomPatch || {}),
                                ...(roomPatch || {})
                            },
                            ...(!isSource && nextPrompt.responses?.[user.uid]
                                ? { sharedResponse: { uid: user.uid, response: nextPrompt.responses[user.uid] } }
                                : {}),
                            result: { status }
                        };
                    }

                    return {
                        boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: Date.now() },
                        roomPatch,
                        ...(!isSource && nextPrompt.responses?.[user.uid]
                            ? { sharedResponse: { uid: user.uid, response: nextPrompt.responses[user.uid] } }
                            : {}),
                        result: { status }
                    };
                }
            });

            if (!result.finalizeSource || room.boardState?.familyMilestoneJoinPrompt?.responseStorage === 'subcollection') return result;

            const finalized = await runRoomBoardMutation<{
                status: 'applied' | 'duplicate' | 'failed';
                message?: string;
            }, Room>({
                db,
                roomId: room.id,
                commandId: `family-complete:${payload.promptId}:${user.uid}`,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                retryOnPermissionDenied: true,
                onDuplicate: () => ({ status: 'duplicate' as const }),
                mutate: (latestRoom, latestBoard) => {
                    const latestPrompt = latestBoard.familyMilestoneJoinPrompt;
                    if (!latestPrompt || latestPrompt.id !== payload.promptId) {
                        throw new Error('FAMILY_ALREADY_FINALIZED');
                    }
                    if (
                        latestPrompt.sourcePlayerUid !== user.uid ||
                        latestPrompt.sourceActionCompleted !== true ||
                        hasIncompleteSharedPrompts(latestBoard)
                    ) {
                        throw new Error('家庭歷程尚未完成所有玩家動作');
                    }

                    const completedTransition = buildCompletedFamilyTransition(latestRoom as Room, latestBoard, latestPrompt);
                    if (!completedTransition) throw new Error('家庭歷程無法結案');

                    return {
                        boardState: completedTransition.boardState,
                        roomPatch: completedTransition.roomPatch,
                        result: { status: 'applied' as const }
                    };
                }
            });

            return finalized.status === 'failed'
                ? finalized
                : { status: finalized.status === 'duplicate' ? 'duplicate' as const : result.status };
        } catch (err: any) {
            const match = /^FAMILY_INSUFFICIENT:(\d+)$/.exec(err?.message || '');
            if (match) return { status: 'requires_funding' as const, shortfall: Number(match[1]) };
            if (err?.message === 'FAMILY_ALREADY_FINALIZED') return { status: 'duplicate' as const };
            if (err?.message?.startsWith('FAMILY_FUNDING_FAILED:')) {
                return failedResult(err.message.replace('FAMILY_FUNDING_FAILED:', ''));
            }
            const message = err?.code === 'permission-denied'
                ? '家庭歷程同步權限被拒絕，請重新整理後再試；若持續發生請通知執行師'
                : err?.message || '家庭歷程同步失敗，請檢查網路後重試';
            setError(message);
            return failedResult(message);
        }
    };

    const submitSharedCardPromptResponse = async (payload: {
        promptId: string;
        status: 'completed' | 'declined' | 'no_effect';
        amount?: number;
        selectedAssetIds?: string[];
        note?: string;
    }): Promise<boolean> => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return false;

        const prompt = room.boardState.sharedCardPrompt;
        if (!prompt || prompt.id !== payload.promptId) return false;
        if (!prompt.targetPlayerUids.includes(user.uid)) return false;
        if (prompt.responses?.[user.uid]) return true;

        const response = cleanObject({
            playerUid: user.uid,
            playerName: room.members.find(member => member.uid === user.uid)?.name || user.name || '玩家',
            status: payload.status,
            amount: payload.amount,
            selectedAssetIds: payload.selectedAssetIds,
            note: payload.note,
            respondedAt: Date.now()
        });

        // schema v2 的每種回覆只讀寫本人的文件；通用房間 mutation
        // 會讀取其他玩家回覆，玩家沒有該讀取權限。
        if (room.syncSchemaVersion === 2 && prompt.responseStorage === 'subcollection') {
            const commandId = `prompt:shared:response:${payload.promptId}:${user.uid}`;
            const responseRef = doc(db, 'rooms', room.id, 'events', payload.promptId, 'responses', user.uid);
            const persistedResponse = cleanObject({
                ...response,
                promptId: payload.promptId,
                commandId
            });

            let subcollectionResponseSaved = false;
            try {
                await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                    const roomRef = doc(db, 'rooms', room.id);
                    const [roomSnapshot, responseSnapshot] = await Promise.all([
                        transaction.get(roomRef),
                        transaction.get(responseRef)
                    ]);
                    if (!roomSnapshot.exists()) throw new Error('房間不存在');

                    const latestRoom = roomSnapshot.data() as Room;
                    const latestPrompt = latestRoom.boardState?.sharedCardPrompt;
                    if (!latestPrompt || latestPrompt.id !== payload.promptId || latestPrompt.responseStorage !== 'subcollection') {
                        throw new Error('共享卡片已更新，請重新查看');
                    }
                    if (!latestPrompt.targetPlayerUids.includes(user.uid)) {
                        throw new Error('目前玩家不在共享卡片參與名單內');
                    }
                    if (responseSnapshot.exists() || latestPrompt.responses?.[user.uid]) return;

                    transaction.set(responseRef, persistedResponse);
                }));
                subcollectionResponseSaved = true;
            } catch (err: any) {
                if (err?.code !== 'permission-denied') {
                    setError(err?.message || '共享卡片回覆同步失敗，請再試一次');
                    return false;
                }
                // Compatibility path for older cloud Rules. The generic board
                // mutation reads every response document, but players may read
                // only their own, so update the own response map directly.
                try {
                    await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                        const roomRef = doc(db, 'rooms', room.id);
                        const roomSnapshot = await transaction.get(roomRef);
                        if (!roomSnapshot.exists()) throw new Error('房間不存在');
                        const latestRoom = roomSnapshot.data() as Room;
                        const fallback = buildSharedPromptResponseFallback(
                            latestRoom,
                            payload.promptId,
                            user.uid,
                            persistedResponse as SharedCardPromptResponse,
                            commandId
                        );
                        if (fallback.status === 'stale') throw new Error('共享卡片已更新，請重新查看');
                        if (fallback.status === 'applied' && fallback.boardState) {
                            transaction.update(roomRef, { boardState: fallback.boardState });
                        }
                    }));
                    subcollectionResponseSaved = true;
                } catch (fallbackError: any) {
                    setError(fallbackError?.message || '共享卡片回覆同步失敗，請再試一次');
                    return false;
                }
            }

            if (subcollectionResponseSaved) {
                setRoom(prev => {
                    if (!prev?.boardState?.sharedCardPrompt || prev.boardState.sharedCardPrompt.id !== payload.promptId) {
                        return prev;
                    }

                    return {
                        ...prev,
                        boardState: {
                            ...prev.boardState,
                            sharedCardPrompt: {
                                ...prev.boardState.sharedCardPrompt,
                                responses: {
                                    ...(prev.boardState.sharedCardPrompt.responses || {}),
                                    [user.uid]: persistedResponse as SharedCardPromptResponse
                                }
                            }
                        }
                    };
                });
                if (room.hostId === user.uid) void finalizeSubcollectionSharedPrompt(room.id, payload.promptId);
                return true;
            }
        }

        const result = await safeAsync(runRoomBoardMutation<{ completed: boolean }, Room>({
            db,
            roomId: room.id,
            commandId: `prompt:shared:response:${payload.promptId}:${user.uid}`,
            playerStateUids: [],
            retryOnPermissionDenied: true,
            onDuplicate: latestRoom => ({
                completed: !latestRoom.boardState?.sharedCardPrompt || !hasIncompleteSharedPrompts(latestRoom.boardState)
            }),
            mutate: (latestRoom, latestBoard) => {
                const latestPrompt = latestBoard.sharedCardPrompt;
                if (!latestPrompt || latestPrompt.id !== payload.promptId) {
                    return { boardState: latestBoard, commit: false, result: { completed: true } };
                }
                if (latestPrompt.responses?.[user.uid]) {
                    return {
                        boardState: latestBoard,
                        commit: false,
                        result: { completed: !hasIncompleteSharedPrompts(latestBoard) }
                    };
                }

                const nextPrompt = {
                    ...latestPrompt,
                    responses: {
                        ...(latestPrompt.responses || {}),
                        [user.uid]: response
                    }
                };

                if (hasIncompleteSharedPrompts({ ...latestBoard, sharedCardPrompt: nextPrompt })) {
                    return {
                        boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: Date.now() },
                        sharedResponse: { uid: user.uid, response },
                        result: { completed: false }
                    };
                }

                const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
                const nextState = buildBoardEventAdvanceState({
                    ...latestRoom,
                    boardState: { ...latestBoard, sharedCardPrompt: undefined, cardLog: currentCardLog }
                } as Room);
                if (!nextState) {
                    return {
                        boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: Date.now() },
                        sharedResponse: { uid: user.uid, response },
                        result: { completed: false }
                    };
                }

                const { boardState: nextBoardState, playerStates, ...roomPatch } = nextState;
                return {
                    boardState: {
                        ...(nextBoardState || latestBoard),
                        cardLog: nextBoardState?.currentCard
                            ? appendBoardCardLog({ ...latestBoard, cardLog: currentCardLog }, nextBoardState.currentCard, nextBoardState.currentEvent)
                            : currentCardLog,
                        updatedAt: Date.now()
                    },
                    roomPatch: {
                        ...roomPatch,
                        ...(playerStates ? { playerStates } : {})
                    },
                    sharedResponse: { uid: user.uid, response },
                    result: { completed: true }
                };
            }
        }), null, err => {
            setError(err?.message || '共享卡片回覆失敗');
        });
        if (result === null) return false;

        if (result?.completed) return true;

        setRoom(prev => {
            if (!prev?.boardState?.sharedCardPrompt || prev.boardState.sharedCardPrompt.id !== payload.promptId) {
                return prev;
            }

            return {
                ...prev,
                boardState: {
                    ...prev.boardState,
                    sharedCardPrompt: {
                        ...prev.boardState.sharedCardPrompt,
                        responses: {
                            ...(prev.boardState.sharedCardPrompt.responses || {}),
                            [user.uid]: response
                        }
                    },
                    updatedAt: Date.now()
                }
            };
        });

        return true;
    };

    const completeSharedInvestmentAction = async (
        promptId: string,
        txData: TransactionData
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const commandId = `shared-investment:${promptId}:${user.uid}`;
        try {
            return await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomRef = doc(db, 'rooms', room.id);
                const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) return { status: 'failed' as const, message: '房間不存在或已關閉' };

                const latestRoom = roomSnapshot.data() as Room;
                const prompt = latestRoom.boardState?.sharedCardPrompt;
                const playerSnapshot = await transaction.get(playerRef);
                const responseRef = doc(db, 'rooms', room.id, 'events', promptId, 'responses', user.uid);
                const responseSnapshot = prompt?.responseStorage === 'subcollection'
                    ? await transaction.get(responseRef)
                    : null;
                if (responseSnapshot?.exists()) {
                    return responseSnapshot.data().status === 'completed'
                        ? { status: 'duplicate' as const }
                        : { status: 'failed' as const, message: '此共享卡片已選擇放棄' };
                }
                if (latestRoom.status !== 'playing' || latestRoom.sessionId !== room.sessionId ||
                    !prompt || prompt.id !== promptId || prompt.kind !== 'investment' ||
                    !prompt.targetPlayerUids.includes(user.uid)) {
                    return { status: 'failed' as const, message: '共享投資事件已更新，請重新開啟卡片' };
                }
                if (prompt.responses?.[user.uid]) {
                    return prompt.responses[user.uid].status === 'completed'
                        ? { status: 'duplicate' as const }
                        : { status: 'failed' as const, message: '此共享卡片已選擇放棄' };
                }
                const currentState = playerSnapshot.exists()
                    ? playerSnapshot.data() as GameState
                    : latestRoom.playerStates?.[user.uid];
                if (!currentState) return { status: 'failed' as const, message: '玩家資料尚未同步完成，請稍後再試' };

                const card = NEWS_CARD_MAP[prompt.sourceCardId];
                const legacyOperationId = `${prompt.sourceEventId}:asset:新聞卡：${card?.title}:${txData.amount}:`;
                const alreadyApplied = currentState.appliedBoardFinancialEventIds?.includes(legacyOperationId);
                const result = alreadyApplied
                    ? { status: 'duplicate' as const, state: currentState }
                    : buildSharedInvestmentState(currentState, prompt.sourceCardId, txData.amount, commandId, txData);
                if (result.status !== 'applied' && result.status !== 'duplicate') return result;

                const response = cleanObject({
                    promptId, playerUid: user.uid,
                    playerName: latestRoom.members.find(member => member.uid === user.uid)?.name || user.name || '玩家',
                    status: 'completed', amount: txData.amount, note: '大型企業投資已完成',
                    respondedAt: Date.now(), commandId
                });
                if (prompt.responseStorage === 'subcollection') {
                    transaction.set(responseRef, response);
                } else {
                    const fallback = buildSharedPromptResponseFallback(
                        latestRoom, promptId, user.uid, response as SharedCardPromptResponse, commandId
                    );
                    if (fallback.status !== 'applied' || !fallback.boardState) {
                        return { status: 'failed' as const, message: '共享投資事件已更新，請重新開啟卡片' };
                    }
                    transaction.update(roomRef, { boardState: fallback.boardState });
                }
                if (result.status === 'applied' && result.state) transaction.set(playerRef, result.state);
                return { status: result.status };
            }));
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '共享投資同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '共享投資同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completePlayerOnlyTransaction = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };
        const operationId = txData.boardEventId || txData.commandId;
        if (!operationId) return { status: 'failed', message: '交易缺少識別碼，請重新操作' };

        const commandId = `fin-player:${room.sessionId || room.id}:${user.uid}:${operationId}`;
        try {
            return await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
                const roomRef = doc(db, 'rooms', room.id);
                const [playerSnapshot, roomSnapshot] = await Promise.all([transaction.get(playerRef), transaction.get(roomRef)]);
                if (!roomSnapshot.exists()) return { status: 'failed' as const, message: '房間不存在或已關閉' };
                if (!playerSnapshot.exists()) return { status: 'failed' as const, message: '玩家資料尚未同步完成，請稍後再試' };

                const latestRoom = roomSnapshot.data() as Room;
                // 沒有房間指令編號可防重送，改以 boardEventId 記錄在玩家資料的 appliedBoardFinancialEventIds。
                const result = applyBoardTransaction(
                    playerSnapshot.data() as GameState,
                    { ...txData, boardEventId: operationId },
                    {
                        now: Date.now(),
                        generateId: createSequentialIdGenerator(commandId),
                        financialAcceleration: latestRoom.financialAcceleration
                    }
                );
                if (result.status === 'error') {
                    return result.code === 'insufficient_cash'
                        ? { status: 'requires_funding' as const, shortfall: result.shortfall, message: result.message }
                        : { status: 'failed' as const, message: result.message };
                }
                if (result.status === 'duplicate') return { status: 'duplicate' as const };
                transaction.set(playerRef, cleanObject(result.state));
                return { status: 'applied' as const };
            }));
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '財務同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '財務交易同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeSharedTransactionAction = async (
        promptId: string,
        txData: TransactionData,
        responseMeta: { status: 'completed' | 'no_effect'; amount?: number; note?: string }
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const commandId = `shared-tx:${promptId}:${user.uid}`;
        const sharedKinds: SharedCardPrompt['kind'][] = ['cash_dividend', 'stock_dividend', 'expense_adjustment'];
        try {
            return await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomRef = doc(db, 'rooms', room.id);
                const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) return { status: 'failed' as const, message: '房間不存在或已關閉' };

                const latestRoom = roomSnapshot.data() as Room;
                const prompt = latestRoom.boardState?.sharedCardPrompt;
                const playerSnapshot = await transaction.get(playerRef);
                const responseRef = doc(db, 'rooms', room.id, 'events', promptId, 'responses', user.uid);
                const responseSnapshot = prompt?.responseStorage === 'subcollection'
                    ? await transaction.get(responseRef)
                    : null;
                if (responseSnapshot?.exists()) return { status: 'duplicate' as const };
                if (latestRoom.status !== 'playing' || latestRoom.sessionId !== room.sessionId ||
                    !prompt || prompt.id !== promptId || !sharedKinds.includes(prompt.kind) ||
                    !prompt.targetPlayerUids.includes(user.uid)) {
                    return { status: 'failed' as const, message: '共享卡片事件已更新，請重新開啟卡片' };
                }
                if (prompt.responses?.[user.uid]) return { status: 'duplicate' as const };

                const currentState = playerSnapshot.exists()
                    ? playerSnapshot.data() as GameState
                    : latestRoom.playerStates?.[user.uid];
                if (!currentState) return { status: 'failed' as const, message: '玩家資料尚未同步完成，請稍後再試' };

                // 財務結算與共享回覆同一筆：任何一邊失敗整筆不生效。
                const result = applyBoardTransaction(
                    currentState,
                    { ...txData, boardEventId: txData.boardEventId || commandId },
                    {
                        now: Date.now(),
                        generateId: createSequentialIdGenerator(commandId),
                        financialAcceleration: latestRoom.financialAcceleration
                    }
                );
                if (result.status === 'error') {
                    return result.code === 'insufficient_cash'
                        ? { status: 'requires_funding' as const, shortfall: result.shortfall, message: result.message }
                        : { status: 'failed' as const, message: result.message };
                }

                const response = cleanObject({
                    promptId, playerUid: user.uid,
                    playerName: latestRoom.members.find(member => member.uid === user.uid)?.name || user.name || '玩家',
                    status: responseMeta.status, amount: responseMeta.amount, note: responseMeta.note,
                    respondedAt: Date.now(), commandId
                });
                if (prompt.responseStorage === 'subcollection') {
                    transaction.set(responseRef, response);
                } else {
                    const fallback = buildSharedPromptResponseFallback(
                        latestRoom, promptId, user.uid, response as SharedCardPromptResponse, commandId
                    );
                    if (fallback.status !== 'applied' || !fallback.boardState) {
                        return { status: 'failed' as const, message: '共享卡片事件已更新，請重新開啟卡片' };
                    }
                    transaction.update(roomRef, { boardState: fallback.boardState });
                }
                if (result.status === 'applied') transaction.set(playerRef, cleanObject(result.state));
                return { status: result.status };
            }));
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '共享卡片同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '共享卡片同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeStartupLoanAction = async (promptId: string): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !room.isBoardGame || !user) return false;

        const commandId = `startup-loan:${promptId}:${user.uid}`;
        const result = await safeAsync(runRoomBoardMutation<boolean, Room>({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            // Players may only read their own v2 response document.
            responseReadUid: room.boardState?.sharedCardPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
            retryOnPermissionDenied: room.boardState?.sharedCardPrompt?.responseStorage !== 'subcollection',
            onDuplicate: () => true,
            mutate: (latestRoom, latestBoard) => buildStartupLoanPromptMutation(
                latestRoom,
                latestBoard,
                promptId,
                user.uid,
                user.name || '玩家',
                commandId
            )
        }), false, err => {
            setError(err?.message || '創業貸款同步失敗');
        });

        return result === true;
    };

    const completeSharedAssetSaleAction = async (
        promptId: string,
        selectedAssetIds: string[]
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '目前分頁為唯讀，無法完成共享出售' };
        if (!room?.id || !room.isBoardGame || !user) {
            return { status: 'failed', message: '共享出售事件尚未準備完成' };
        }

        const commandId = `shared-asset-sale:${promptId}:${user.uid}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                responseReadUid: room.boardState?.sharedCardPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
                retryOnPermissionDenied: room.boardState?.sharedCardPrompt?.responseStorage !== 'subcollection',
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => buildSharedAssetSalePromptMutation(
                    latestRoom,
                    latestBoard,
                    promptId,
                    user.uid,
                    user.name || '玩家',
                    selectedAssetIds,
                    commandId
                )
            });
        } catch (err: any) {
            const message = err?.code === 'permission-denied'
                ? '共享出售同步權限被拒絕，請重新整理後再試'
                : err?.message || '共享出售同步失敗，請檢查網路後重試';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeTargetEnterprisePurchase = async (data: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '目前分頁為唯讀，無法購買目標企業' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '房間資料尚未準備完成' };
        const enterpriseId = room.playerStates?.[user.uid]?.selectedEnterprise?.id || 'unknown';
        const commandId = data.boardEventId || `target-enterprise:${room.sessionId || room.id}:${user.uid}:${enterpriseId}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const latestState = latestRoom.playerStates?.[user.uid];
                    if (!latestState) return { boardState: latestBoard, commit: false, result: { status: 'failed', message: '找不到玩家財務資料' } };
                    const result = buildTargetEnterprisePurchaseState(latestState, data, commandId);
                    if (!result.state) return { boardState: latestBoard, commit: false, result };
                    return {
                        boardState: latestBoard,
                        roomPatch: { playerStates: { [user.uid]: result.state } },
                        result: { status: result.status }
                    };
                }
            });
        } catch (err: any) {
            return { status: 'failed', message: err?.message || '目標企業購買同步失敗，請稍後再試' };
        }
    };

    const completeDirectHappinessCard = async (
        eventId: string,
        cardId: string,
        txData: TransactionData
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) {
            return { status: 'failed', message: '目前沒有可用的棋盤房間' };
        }

        const commandId = `happiness-card:${room.sessionId || room.id}:${eventId}:${user.uid}:${cardId}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    if (
                        latestBoard.currentEvent?.id !== eventId ||
                        latestBoard.currentEvent.playerUid !== user.uid ||
                        latestBoard.currentCard?.cardId !== cardId ||
                        latestBoard.currentCard.deck !== 'happiness'
                    ) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '幸福卡事件已更新，請重新開啟卡片' }
                        };
                    }

                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }

                    const nextState = buildDirectHappinessCardState(currentState, txData, commandId);
                    const cardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
                    const advanced = buildBoardEventAdvanceState({
                        ...latestRoom,
                        boardState: { ...latestBoard, cardLog }
                    } as Room);
                    if (!advanced?.boardState) {
                        throw new Error('幸福卡事件無法結案');
                    }

                    return {
                        boardState: advanced.boardState,
                        roomPatch: { playerStates: { [user.uid]: nextState } },
                        result: { status: 'applied' }
                    };
                }
            });
        } catch (err: any) {
            const message = err?.message || '幸福卡同步失敗，請稍後再試';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeInsurancePurchase = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const targetIds = txData.insurancePayload?.targetAssetIds?.slice().sort().join(',') || '';
        const commandId = `insurance:${room.sessionId || room.id}:${user.uid}:${txData.insuranceType || 'unknown'}:${targetIds}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }

                    try {
                        const nextState = buildInsurancePurchaseState(currentState, txData, commandId);
                        return {
                            boardState: latestBoard,
                            roomPatch: { playerStates: { [user.uid]: nextState } },
                            result: { status: 'applied' }
                        };
                    } catch (error: any) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: error?.message || '保險交易資料已更新，請重新操作' }
                        };
                    }
                }
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '保險同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '保險交易同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeDepositPurchase = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const sourceAssetId = txData.assetChange?.asset.id || txData.assetDetails?.symbol || txData.name;
        const commandId = `deposit:${room.sessionId || room.id}:${user.uid}:${sourceAssetId}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }
                    if (currentState.cash + txData.cashChange < 0) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'requires_funding', shortfall: Math.abs(currentState.cash + txData.cashChange), message: '現金不足，無法辦理定存' }
                        };
                    }

                    try {
                        const nextState = buildDepositPurchaseState(currentState, txData, commandId);
                        return {
                            boardState: latestBoard,
                            roomPatch: { playerStates: { [user.uid]: nextState } },
                            result: { status: 'applied' }
                        };
                    } catch (error: any) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: error?.message || '定存資料已更新，請重新操作' }
                        };
                    }
                }
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '定存同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '定存交易同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeStockTrade = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const tradeKey = txData.commandId || `${txData.usage}:${txData.name}:${JSON.stringify(txData.stockList || [])}`;
        const commandId = `stock:${room.sessionId || room.id}:${user.uid}:${tradeKey}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }

                    try {
                        const nextState = buildStockTradeState(currentState, txData, commandId);
                        return {
                            boardState: latestBoard,
                            roomPatch: { playerStates: { [user.uid]: nextState } },
                            result: { status: 'applied' }
                        };
                    } catch (error: any) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: error?.message || '股票交易資料已更新，請重新操作' }
                        };
                    }
                }
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '股票交易同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '股票交易同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    /**
     * 玩家私有財務資料的單一寫入入口：讀最新的私有狀態、由 `apply` 算出新狀態，
     * 並在同一筆交易寫回。統一處理唯讀分頁、房間資格、重複指令與錯誤訊息。
     */
    const runPlayerFinancialCommand = async (params: {
        commandId: string;
        failureLabel: string;
        apply: (
            state: GameState,
            latestRoom: Room
        ) => { status: 'applied'; state: GameState }
            | { status: 'duplicate' }
            | { status: 'requires_funding'; shortfall?: number; message?: string }
            | { status: 'failed'; message: string };
    }): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId: params.commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }
                    let outcome: ReturnType<typeof params.apply>;
                    try {
                        outcome = params.apply(currentState, latestRoom);
                    } catch (error: any) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: error?.message || `${params.failureLabel}資料已更新，請重新操作` }
                        };
                    }
                    if (outcome.status === 'applied') {
                        return {
                            boardState: latestBoard,
                            roomPatch: { playerStates: { [user.uid]: outcome.state } },
                            result: { status: 'applied' }
                        };
                    }
                    return { boardState: latestBoard, commit: false, result: outcome };
                }
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? `${params.failureLabel}同步權限不足，請確認目前仍在這個房間`
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || `${params.failureLabel}同步失敗，請再試一次`;
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completePaydayCollection = async (boardEventId: string): Promise<BoardFinancialMutationResult> => {
        const commandId = `fin-payday:${room?.sessionId || room?.id}:${user?.uid}:${boardEventId}`;
        return runPlayerFinancialCommand({
            commandId,
            failureLabel: '月結餘',
            apply: (state, latestRoom) => {
                const result = applyPaydayCollection(
                    state,
                    latestRoom.financialAcceleration,
                    boardEventId,
                    { now: Date.now(), generateId: createSequentialIdGenerator(commandId) }
                );
                if (result.status === 'duplicate') return { status: 'duplicate' };
                return { status: 'applied', state: result.state };
            }
        });
    };

    const completeHouseConversion = async (assetId: string, toSelfUse: boolean): Promise<BoardFinancialMutationResult> => {
        const commandId = `house-conv:${room?.sessionId || room?.id}:${user?.uid}:${assetId}:${Date.now()}`;
        return runPlayerFinancialCommand({
            commandId,
            failureLabel: '房屋自住／出租切換',
            apply: (state) => {
                const result = applyHouseConversion(state, assetId, toSelfUse);
                if (result.status === 'error') return { status: 'failed', message: result.message };
                return { status: 'applied', state: result.state };
            }
        });
    };

    const completeHappinessToggle = async (id: string, checked?: boolean): Promise<BoardFinancialMutationResult> => {
        const commandId = `happiness-toggle:${room?.sessionId || room?.id}:${user?.uid}:${id}:${Date.now()}`;
        return runPlayerFinancialCommand({
            commandId,
            failureLabel: '幸福清單',
            apply: (state) => ({ status: 'applied', state: applyHappinessToggle(state, id, checked) })
        });
    };

    const completeHappinessAdd = async (label: string, points: number): Promise<BoardFinancialMutationResult> => {
        const commandId = `happiness-add:${room?.sessionId || room?.id}:${user?.uid}:${Date.now()}`;
        return runPlayerFinancialCommand({
            commandId,
            failureLabel: '幸福清單',
            apply: (state) => ({
                status: 'applied',
                state: applyHappinessAdd(state, label, points, { now: Date.now(), generateId: createSequentialIdGenerator(commandId) })
            })
        });
    };

    const completeHappinessRemove = async (id: string): Promise<BoardFinancialMutationResult> => {
        const commandId = `happiness-remove:${room?.sessionId || room?.id}:${user?.uid}:${id}:${Date.now()}`;
        return runPlayerFinancialCommand({
            commandId,
            failureLabel: '幸福清單',
            apply: (state) => ({ status: 'applied', state: applyHappinessRemove(state, id) })
        });
    };

    const completeBoardTransaction = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        const operationId = txData.boardEventId || txData.commandId;
        if (!operationId) return { status: 'failed', message: '交易缺少識別碼，請重新操作' };
        const commandId = `fin:${room?.sessionId || room?.id}:${user?.uid}:${operationId}`;
        return runPlayerFinancialCommand({
            commandId,
            failureLabel: '財務交易',
            apply: (state, latestRoom) => {
                const result = applyBoardTransaction(state, txData, {
                    now: Date.now(),
                    generateId: createSequentialIdGenerator(commandId),
                    financialAcceleration: latestRoom.financialAcceleration
                });
                if (result.status === 'error') {
                    return result.code === 'insufficient_cash'
                        ? { status: 'requires_funding', shortfall: result.shortfall, message: result.message }
                        : { status: 'failed', message: result.message };
                }
                if (result.status === 'duplicate') return { status: 'duplicate' };
                return { status: 'applied', state: result.state };
            }
        });
    };

    const completeLoanBorrow = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const commandId = `loan:${room.sessionId || room.id}:${user.uid}:${txData.commandId || `${txData.name}:${txData.amount}`}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }
                    const amount = Number(txData.amount) || 0;
                    const remainingCredit = getRemainingCreditCapacity(
                        currentState.profession?.salary || 0,
                        currentState.liabilities || [],
                        currentState.loans || 0
                    );
                    if (amount > remainingCredit) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: `超過信貸上限，剩餘可借 ${remainingCredit.toLocaleString()}` }
                        };
                    }

                    try {
                        const nextState = buildLoanBorrowState(currentState, txData, commandId);
                        return {
                            boardState: latestBoard,
                            roomPatch: { playerStates: { [user.uid]: nextState } },
                            result: { status: 'applied' }
                        };
                    } catch (error: any) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: error?.message || '信用貸款資料已更新，請重新操作' }
                        };
                    }
                }
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '信用貸款同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '信用貸款同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeLoanRepayment = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const commandId = `repay:${room.sessionId || room.id}:${user.uid}:${txData.commandId || `${txData.liabilityId}:${txData.amount}`}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }
                    try {
                        const nextState = buildLoanRepaymentState(currentState, txData, commandId);
                        return {
                            boardState: latestBoard,
                            roomPatch: { playerStates: { [user.uid]: nextState } },
                            result: { status: 'applied' }
                        };
                    } catch (error: any) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: error?.message || '還款資料已更新，請重新操作' }
                        };
                    }
                }
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '還款同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '還款同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeDepositWithdrawal = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const commandId = `deposit-withdrawal:${room.sessionId || room.id}:${user.uid}:${txData.commandId || `${txData.relatedAssetId}:${txData.amount}`}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' }
                        };
                    }
                    try {
                        const nextState = buildDepositWithdrawalState(currentState, txData, commandId);
                        return {
                            boardState: latestBoard,
                            roomPatch: { playerStates: { [user.uid]: nextState } },
                            result: { status: 'applied' }
                        };
                    } catch (error: any) {
                        return {
                            boardState: latestBoard,
                            commit: false,
                            result: { status: 'failed', message: error?.message || '定存資料已更新，請重新操作' }
                        };
                    }
                }
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '定存解約同步權限不足，請確認目前仍在這個房間'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '定存解約同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const completeCarPurchase = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const commandId = `car-purchase:${room.sessionId || room.id}:${user.uid}:${txData.commandId || `${txData.name}:${txData.amount}`}`;
        try {
            return await runTransaction(db, async transaction => {
                const roomRef = doc(db, 'rooms', room.id);
                const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
                const [roomSnapshot, playerSnapshot] = await Promise.all([
                    transaction.get(roomRef),
                    transaction.get(playerRef)
                ]);
                if (!roomSnapshot.exists()) return { status: 'failed', message: '房間不存在或已關閉' };

                const latestRoom = roomSnapshot.data() as Room;
                const gateError = getCarPurchaseGateError(latestRoom, user.uid);
                if (gateError) return { status: 'failed', message: gateError };

                const currentState = playerSnapshot.exists()
                    ? playerSnapshot.data() as GameState
                    : latestRoom.playerStates?.[user.uid];
                if (!currentState) return { status: 'failed', message: '玩家資料尚未同步完成，請稍後再試' };
                if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) {
                    return { status: 'duplicate' };
                }

                const nextState = buildCarPurchaseState(currentState, txData, commandId);
                transaction.set(playerRef, nextState);
                return { status: 'applied' };
            });
        } catch (error: any) {
            const message = error?.code === 'permission-denied'
                ? '汽車交易被資料庫安全規則拒絕；請重新整理，若仍發生請執行師確認房間成員與雲端 Firestore 規則'
                : error?.code === 'unavailable' || error?.code === 'deadline-exceeded'
                    ? '資料庫連線暫時不穩定，請保留目前選擇後再試一次'
                    : error?.message || '汽車交易同步失敗，請再試一次';
            setError(message);
            return { status: 'failed', message };
        }
    };

    const rollStartupUpgradeDice = async (payload: {
        assetId: string;
        cardId: string;
        stage: 1 | 2;
        sourceEventId?: string;
    }): Promise<{ roll: number; eligible?: boolean; presentationDurationMs?: number }> => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) throw new Error('企業升級骰子尚未準備完成');
        const roll = rollBoardDie();
        const sourceEventId = payload.sourceEventId || room.boardState.currentEvent?.id;
        const retryKey = payload.stage === 1
            ? sourceEventId || 'no-event'
            : `${sourceEventId || 'no-event'}:${room.boardState.revision || 0}`;
        const commandId = `startup-upgrade-roll:${room.sessionId || room.id}:${user.uid}:${payload.assetId}:${payload.stage}:${retryKey}`;
        const result = await runRoomBoardMutation<{ roll: number; eligible?: boolean }, Room>({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            onDuplicate: latestRoom => {
                const event = latestRoom.boardState?.diceEvents?.find(item => item.id === commandId);
                if (!event) throw new Error('企業升級骰點事件已更新');
                return { roll: event.total, eligible: event.success };
            },
            mutate: (latestRoom, latestBoard) => {
                const latestState = latestRoom.playerStates?.[user.uid];
                const target = latestState ? resolveStartupUpgradeTarget(latestState, payload) : null;
                if (!latestState || !target) throw new Error('企業升級等待狀態已更新');
                if (latestRoom.status !== 'playing' || latestBoard.currentTurnUid !== user.uid) {
                    throw new Error('只有目前回合玩家可以擲企業升級骰');
                }
                // 交易內的 latestBoard 才是權威狀態。呼叫端的 sourceEventId 可能因
                // listener 落後一個 revision 而過期，不應因此擋掉有效的銀行骰點。
                if (!isCurrentPlayerBankEvent(latestBoard, user.uid)) {
                    throw new Error('目前沒有可執行的銀行升級事件');
                }
                const eligible = payload.stage === 2 || roll >= 5;
                const timestamp = Date.now();
                return {
                    boardState: appendDicePresentation({ ...latestBoard, updatedAt: timestamp }, {
                        id: commandId,
                        sequence: (latestBoard.revision || 0) + 1,
                        playerUid: user.uid,
                        playerName: user.name || '玩家',
                        kind: 'business-upgrade',
                        sourceEventId: latestBoard.currentEvent?.id,
                        dice: [roll],
                        total: roll,
                        target: payload.stage === 1 ? 5 : undefined,
                        success: eligible,
                        resultLabel: payload.stage === 1
                            ? (eligible ? '升級判定通過' : '升級判定未達標')
                            : '收入骰完成',
                        detail: payload.stage === 1 ? `需 5 點，實際 ${roll} 點` : `企業收入增加 ${roll * 10000}`,
                        timestamp
                    }),
                    roomPatch: target.recovered ? {
                        playerStates: {
                            [user.uid]: cleanObject({
                                ...latestState,
                                pendingStartupUpgradeAction: target.pending,
                                pendingStartupUpgradeActions: getPendingStartupUpgradeActions(latestState)
                            })
                        }
                    } : undefined,
                    result: { roll, eligible }
                };
            }
        });
        // 大螢幕從 Firestore 事件播放完整骰子動畫；玩家端在同一段時間內
        // 保持「請看大螢幕」，避免交易回傳後提前揭示結果。
        return { ...result, presentationDurationMs: DICE_PRESENTATION_DURATION_MS };
    };

    const completeStartupUpgradeAction = async (payload: {
        assetId: string;
        cardId: string;
        diceRoll: number;
    }): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) {
            return { status: 'failed', message: '目前沒有可用的棋盤房間' };
        }

        const commandId = `startup-upgrade:${room.sessionId || room.id}:${user.uid}:${payload.assetId}`;
        try {
            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => ({ status: 'duplicate' }),
                mutate: (latestRoom, latestBoard) => {
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) throw new Error('玩家資料尚未同步完成');
                    const nextState = buildStartupUpgradeState(currentState, payload, commandId);
                    return {
                        boardState: { ...latestBoard, updatedAt: Date.now() },
                        roomPatch: { playerStates: { [user.uid]: nextState } },
                        result: { status: 'applied' }
                    };
                }
            });
        } catch (err: any) {
            setError(err?.message || '企業升級同步失敗');
            return { status: 'failed', message: err?.message || '企業升級同步失敗' };
        }
    };

    const clearSharedCardPrompt = async (promptId: string) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !room.boardState?.sharedCardPrompt) return;
        if (room.boardState.sharedCardPrompt.id !== promptId) return;

        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: `prompt:shared:clear:${promptId}`,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                if (latestBoard.currentTurnUid !== user?.uid || latestBoard.sharedCardPrompt?.id !== promptId) {
                    throw new Error('共享卡片提示已更新');
                }
                return {
                    boardState: { ...latestBoard, sharedCardPrompt: undefined, updatedAt: Date.now() },
                    result: undefined
                };
            }
        });
    };

    const setPendingStartupUpgradeAction = async (payload: { cardId: string; symbol: string }): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !user) return false;
        const result = await safeAsync(runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
            const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
            const playerSnapshot = await transaction.get(playerRef);
            if (!playerSnapshot.exists()) throw new Error('玩家資料尚未同步完成');
            // 只更新待升級欄位，避免把剛完成的企業貸款或其他財務結果
            // 以舊快照整份覆蓋回去。
            transaction.update(playerRef, {
                pendingStartupUpgradeAction: cleanObject(payload)
            });
            return true;
        })), null, err => {
            setError(err?.message || '建立企業升級等待狀態失敗');
        });
        return result === true;
    };

    const clearPendingStartupUpgradeAction = async (): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !user) return false;

        const result = await safeAsync(runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
            const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
            const playerSnapshot = await transaction.get(playerRef);
            if (!playerSnapshot.exists()) return false;
            transaction.update(playerRef, {
                pendingStartupUpgradeAction: deleteField(),
                pendingStartupUpgradeActions: deleteField()
            });
            return true;
        })), false, err => {
            setError(err?.message || '清除企業升級等待狀態失敗');
        });

        if (result !== true) return false;

        return true;
    };

    const applyBoardExpenseToAllPlayers = async (payload: {
        amount: number;
        category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
        isIncrease: boolean;
        summary: string;
        detail?: string;
    }) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !room.isBoardGame || !user) return;

        // 共享支出只發布公開事件，不把任何玩家的完整財務資料寫回房間文件。
        const commandId = `shared-expense:${room.boardState?.currentEvent?.id || 'none'}:${payload.category}:${payload.amount}:${payload.isIncrease ? 'increase' : 'decrease'}`;
        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [],
            onDuplicate: () => undefined,
            mutate: (currentRoom, currentBoard) => {
                if (currentBoard.currentEvent?.playerUid !== user.uid) throw new Error('共享支出不是目前事件');
                const syncedAt = Date.now();
                return {
                    boardState: {
                        ...currentBoard,
                        sharedExpenseEffect: {
                            id: commandId,
                            sourcePlayerUid: user.uid,
                            ...payload,
                            timestamp: syncedAt
                        },
                        updatedAt: syncedAt
                    },
                    result: undefined
                };
            }
        });
    };

    const moveCurrentPlayerToSquare = async (payload: {
        squareType: 'school' | 'hospital' | 'bank' | 'repair';
        skipTurns?: number;
        detail?: string;
    }) => {
        if (!canMutateCurrentRoom()) return null;
        if (!room?.id || !room.isBoardGame || !user) return null;

        const boardLength = BOARD_SQUARES.length;

        // H1：原本直接把本地 room.boardState/room.playerStates 整包（含所有其他
        // 玩家的欄位）覆寫回去，若跟其他玩家並發的寫入交錯，會用過期的本地
        // 快照蓋掉他們剛寫入的新資料。改用交易讀最新狀態算出正確的
        // currentPosition/nextIndex，並只用點記法（dotted path）寫入這位玩家
        // 自己的欄位，不會動到其他玩家的資料。
        const commandId = `move:${user.uid}:${payload.squareType}:${room.boardState?.currentEvent?.id || room.boardState?.revision || 0}`;
        return runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            onDuplicate: latestRoom => latestRoom.boardState?.playerPositions[user.uid] ?? null,
            mutate: (currentRoom, currentBoardState) => {
                if (currentBoardState.currentTurnUid !== user.uid) throw new Error('還沒輪到你');
                const currentPosition = currentBoardState.playerPositions?.[user.uid] || 0;
                // 找「順時針方向最近」的目標格，不是陣列裡第一個同類型格——
                // 原本的寫法 (index - currentPosition + N) % N > 0 對任何
                // index !== currentPosition 恆為真，等於沒有真正比較距離。
                const nextSquare = BOARD_SQUARES
                    .filter(square => square.type === payload.squareType && square.index !== currentPosition)
                    .reduce<typeof BOARD_SQUARES[number] | null>((closest, square) => {
                        const distance = (square.index - currentPosition + boardLength) % boardLength;
                        if (!closest) return square;
                        const closestDistance = (closest.index - currentPosition + boardLength) % boardLength;
                        return distance < closestDistance ? square : closest;
                    }, null);
                if (!nextSquare) throw new Error('找不到目標棋盤格');

                const playerState = currentRoom.playerStates?.[user.uid];
                const nextSkipTurns = Math.max(currentBoardState.skipTurns?.[user.uid] || 0, payload.skipTurns || 0);
                const timestamp = Date.now();
                return {
                    boardState: {
                        ...currentBoardState,
                        playerPositions: { ...currentBoardState.playerPositions, [user.uid]: nextSquare.index },
                        skipTurns: { ...currentBoardState.skipTurns, [user.uid]: nextSkipTurns },
                        updatedAt: timestamp
                    },
                    roomPatch: {
                        [`playerStates.${user.uid}`]: cleanObject({
                            ...playerState,
                            boardPosition: nextSquare.index,
                            skipTurns: nextSkipTurns,
                            lastBoardEvent: payload.detail || `移動到${payload.squareType}`,
                            pendingCardAction: payload.detail,
                            bankServiceWindowActive: false,
                            bankServiceGrantedAtEventId: undefined
                        })
                    },
                    result: nextSquare.index
                };
            }
        });
    };

    const applyBoardMarketPrices = async (updates: Record<string, number>, code: string, isBubble: boolean = false) => {
        if (!canMutateCurrentRoom()) return;
        if (!room || !user) return;
        if (!room.isBoardGame) return;

        const isCurrentTurnPlayer = room.boardState?.currentTurnUid === user.uid;
        const isCurrentBoardEventPlayer =
            room.boardState?.currentEvent?.playerUid === user.uid &&
            !!room.boardState?.currentCard;

        if (!isCurrentTurnPlayer && !isCurrentBoardEventPlayer) return;

        try {
            const commandId = `market:${code}:${room.boardState?.currentEvent?.id || room.boardState?.revision || 0}`;
            const nextMarketState = await runRoomBoardMutation<Pick<Room, 'marketUpdates' | 'previousMarketPrices' | 'marketPrices'>, Room>({
                db,
                roomId: room.id,
                commandId,
                onDuplicate: latestRoom => ({
                    marketUpdates: latestRoom.marketUpdates,
                    previousMarketPrices: latestRoom.previousMarketPrices,
                    marketPrices: latestRoom.marketPrices
                }),
                mutate: (latestRoom, latestBoard) => {
                    const isLatestTurnPlayer = latestBoard.currentTurnUid === user.uid;
                    const isLatestEventPlayer = latestBoard.currentEvent?.playerUid === user.uid && !!latestBoard.currentCard;
                    if (!isLatestTurnPlayer && !isLatestEventPlayer) throw new Error('還沒輪到你');

                    const currentPrices = latestRoom.marketPrices || {};
                    const nextPrices = normalizeMarketPrices(updates, currentPrices);
                    const marketState = {
                        marketUpdates: {
                            updates: nextPrices,
                            code,
                            isBubble,
                            timestamp: Date.now()
                        },
                        previousMarketPrices: currentPrices,
                        marketPrices: nextPrices
                    };
                    return {
                        boardState: { ...latestBoard, updatedAt: Date.now() },
                        roomPatch: marketState,
                        result: marketState
                    };
                }
            });

            setRoom(prev => prev && prev.id === room.id
                ? {
                    ...prev,
                    marketUpdates: nextMarketState.marketUpdates,
                    previousMarketPrices: nextMarketState.previousMarketPrices,
                    marketPrices: nextMarketState.marketPrices
                }
                : prev
            );
        } catch (err: any) {
            console.error('套用棋盤行情失敗:', err);
            setError(err.message);
            throw err;
        }
    };

    const adjustPlayerCash = async (playerUid: string, amount: number) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整玩家現金');
        }

        const delta = Math.trunc(Number(amount));
        if (!Number.isFinite(delta) || delta === 0) throw new Error('請輸入有效的現金調整金額');

        const playerRef = doc(db, 'rooms', room.id, 'players', playerUid);
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                const currentCash = Number(currentState.cash) || 0;
                const nextCash = currentCash + delta;
                if (nextCash < 0) throw new Error('玩家現金不足，無法扣除這麼多');

                const transactionRecord: Transaction = {
                    id: `coach-cash:${user.uid}:${playerUid}:${Date.now()}`,
                    name: delta > 0 ? '執行師增加現金' : '執行師扣除現金',
                    amount: Math.abs(delta),
                    sourceLabel: '執行師調整',
                    usageLabel: '現金調整',
                    cashChange: delta,
                    balance: nextCash,
                    timestamp: Date.now(),
                    details: '由執行師端手動調整',
                    flowType: '其它'
                };
                const updatedState = cleanObject({
                    ...currentState,
                    cash: nextCash,
                    history: [...(currentState.history || []), transactionRecord]
                }) as GameState;

                transaction.set(playerRef, updatedState);
                return updatedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家現金調整失敗');
            throw err;
        }

        setPlayerStates(prev => ({ ...prev, [playerUid]: nextState }));
        setRoom(prev => prev ? {
            ...prev,
            playerStates: { ...(prev.playerStates || {}), [playerUid]: nextState }
        } : prev);
    };

    const adjustPlayerInvestmentIncome = async (playerUid: string, amount: number) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整玩家理財收入');
        }

        const delta = Math.trunc(Number(amount));
        if (!Number.isFinite(delta) || delta === 0) throw new Error('請輸入有效的理財收入調整金額');

        const playerRef = doc(db, 'rooms', room.id, 'players', playerUid);
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                const currentIncome = Number(currentState.income?.investment) || 0;
                const nextIncome = currentIncome + delta;
                if (nextIncome < 0) throw new Error('玩家理財收入不足，無法扣除這麼多');

                const now = Date.now();
                const transactionRecord: Transaction = {
                    id: `coach-investment-income:${user.uid}:${playerUid}:${now}`,
                    name: delta > 0 ? '執行師增加理財收入' : '執行師扣除理財收入',
                    amount: Math.abs(delta),
                    sourceLabel: '執行師調整',
                    usageLabel: '理財收入調整',
                    cashChange: 0,
                    balance: Number(currentState.cash) || 0,
                    timestamp: now,
                    details: '由執行師端手動調整，後續月結套用房間收益倍率',
                    flowType: '投資',
                    incomeMultiplierEligible: true,
                    originalAmount: Math.abs(delta),
                    appliedMultiplier: 1
                };
                const updatedState = cleanObject({
                    ...currentState,
                    income: { ...(currentState.income || {}), investment: nextIncome },
                    history: [...(currentState.history || []), transactionRecord]
                }) as GameState;
                transaction.set(playerRef, updatedState);
                return updatedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家理財收入調整失敗');
            throw err;
        }

        setPlayerStates(prev => ({ ...prev, [playerUid]: nextState }));
        setRoom(prev => prev ? {
            ...prev,
            playerStates: { ...(prev.playerStates || {}), [playerUid]: nextState }
        } : prev);
    };

    const adjustPlayerLiability = async (
        playerUid: string,
        liabilityId: string,
        adjustments: { totalOwedDelta: number; monthlyPaymentDelta: number; reason: string }
    ) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整玩家負債');
        }
        const reason = adjustments.reason.trim();
        if (!reason) throw new Error('請填寫負債調整原因');

        const playerRef = doc(db, 'rooms', room.id, 'players', playerUid);
        const operationId = `coach-liability:${user.uid}:${playerUid}:${liabilityId}:${Date.now()}`;
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                const result = applyPlayerLiabilityAdjustment(
                    currentState,
                    liabilityId,
                    adjustments.totalOwedDelta,
                    adjustments.monthlyPaymentDelta
                );
                const now = Date.now();
                const transactionRecord: Transaction = {
                    id: operationId,
                    name: `執行師調整負債：${result.liabilityName}`,
                    amount: Math.abs(Math.trunc(Number(adjustments.totalOwedDelta) || 0)) + Math.abs(Math.trunc(Number(adjustments.monthlyPaymentDelta) || 0)),
                    sourceLabel: '執行師調整',
                    usageLabel: '負債調整',
                    cashChange: 0,
                    balance: Number(currentState.cash) || 0,
                    timestamp: now,
                    details: `執行師 ${user.name || user.uid}；原因：${reason}；本金 ${result.before.totalOwed.toLocaleString()} → ${result.after.totalOwed.toLocaleString()}；每月還款 ${result.before.monthlyPayment.toLocaleString()} → ${result.after.monthlyPayment.toLocaleString()}`,
                    flowType: '融資'
                };
                const updatedState = cleanObject({
                    ...result.state,
                    history: [...(currentState.history || []), transactionRecord]
                }) as GameState;
                transaction.set(playerRef, updatedState);
                return updatedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家負債調整失敗');
            throw err;
        }

        setPlayerStates(prev => ({ ...prev, [playerUid]: nextState }));
        setRoom(prev => prev ? {
            ...prev,
            playerStates: { ...(prev.playerStates || {}), [playerUid]: nextState }
        } : prev);
    };

    const adjustPlayerExpense = async (
        playerUid: string,
        category: CoachExpenseCategory,
        amountDelta: number,
        reason: string
    ) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整玩家每月支出');
        }
        const trimmedReason = reason.trim();
        if (!trimmedReason) throw new Error('請填寫每月支出調整原因');

        const categoryLabels: Record<CoachExpenseCategory, string> = {
            basicLiving: '基本生活',
            transportEdu: '交通教育',
            otherMedicalChild: '其他醫療育兒'
        };
        const playerRef = doc(db, 'rooms', room.id, 'players', playerUid);
        const operationId = `coach-expense:${user.uid}:${playerUid}:${category}:${Date.now()}`;
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                const result = applyPlayerExpenseAdjustment(currentState, category, amountDelta);
                const delta = Math.trunc(Number(amountDelta));
                const transactionRecord: Transaction = {
                    id: operationId,
                    name: `執行師調整每月支出：${categoryLabels[category]}`,
                    amount: Math.abs(delta),
                    sourceLabel: '執行師調整',
                    usageLabel: '每月支出調整',
                    cashChange: 0,
                    balance: Number(currentState.cash) || 0,
                    timestamp: Date.now(),
                    details: `執行師 ${user.name || user.uid}；原因：${trimmedReason}；${categoryLabels[category]} ${result.before.toLocaleString()} → ${result.after.toLocaleString()} / 月`,
                    flowType: '生活'
                };
                const updatedState = cleanObject({
                    ...result.state,
                    history: [...(currentState.history || []), transactionRecord]
                }) as GameState;
                transaction.set(playerRef, updatedState);
                return updatedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家每月支出調整失敗');
            throw err;
        }

        setPlayerStates(prev => ({ ...prev, [playerUid]: nextState }));
        setRoom(prev => prev ? {
            ...prev,
            playerStates: { ...(prev.playerStates || {}), [playerUid]: nextState }
        } : prev);
    };

    const updateFinancialAcceleration = async (multiplier: FinancialAccelerationMultiplier) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整全局財務加速器');
        }

        const roomRef = doc(db, 'rooms', room.id);
        let nextAcceleration: FinancialAccelerationState;
        try {
            nextAcceleration = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) throw new Error('房間不存在');
                const latestRoom = roomSnapshot.data() as Room;
                if (latestRoom.status === 'finished') throw new Error('遊戲已結束，無法修改財務加速器');

                const currentMultiplier = latestRoom.financialAcceleration?.multiplier || 1;
                if (currentMultiplier === multiplier) return latestRoom.financialAcceleration || { multiplier: 1 };

                const next = {
                    multiplier,
                    updatedAt: Date.now(),
                    updatedByUid: user.uid,
                    updatedByName: user.name
                } satisfies FinancialAccelerationState;
                transaction.update(roomRef, { financialAcceleration: next });
                return next;
            }));
        } catch (err: any) {
            setError(err?.message || '財務加速器更新失敗');
            throw err;
        }

        setRoom(prev => prev?.id === room.id ? { ...prev, financialAcceleration: nextAcceleration } : prev);
    };

    const grantFinancialSubsidyToAllPlayers = async (amount: number) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以發放全體補助');
        }

        const subsidyAmount = Math.trunc(Number(amount));
        if (!Number.isFinite(subsidyAmount) || subsidyAmount <= 0) throw new Error('補助金額必須大於 0');

        const roomRef = doc(db, 'rooms', room.id);
        let result: { subsidy: FinancialSubsidyState; states: Record<string, GameState> };
        try {
            result = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) throw new Error('房間不存在');
                const latestRoom = roomSnapshot.data() as Room;
                if (latestRoom.status === 'finished') throw new Error('遊戲已結束，無法發放全體補助');
                const playerUids = latestRoom.members
                    .filter(member => member.uid !== latestRoom.hostId && !member.isLeft)
                    .map(member => member.uid);
                if (playerUids.length === 0) throw new Error('目前沒有可發放補助的玩家');

                const playerRefs = playerUids.map(uid => doc(db, 'rooms', room.id, 'players', uid));
                const snapshots = await Promise.all(playerRefs.map(playerRef => transaction.get(playerRef)));
                const grantedAt = Date.now();
                const sequence = (Number(latestRoom.financialSubsidy?.sequence) || 0) + 1;
                const grantId = `financial-subsidy:${room.id}:${sequence}`;
                const states: Record<string, GameState> = {};

                snapshots.forEach((snapshot, index) => {
                    if (!snapshot.exists()) return;
                    const currentState = snapshot.data() as GameState;
                    const nextCash = (Number(currentState.cash) || 0) + subsidyAmount;
                    const transactionRecord: Transaction = {
                        id: grantId,
                        name: '執行師全體補助',
                        amount: subsidyAmount,
                        sourceLabel: '執行師補助',
                        usageLabel: '全體補助',
                        cashChange: subsidyAmount,
                        balance: nextCash,
                        timestamp: grantedAt,
                        details: `第 ${sequence} 次全體補助，不套用收益倍率`,
                        flowType: '其它',
                        incomeMultiplierEligible: false
                    };
                    const nextState = cleanObject({
                        ...currentState,
                        cash: nextCash,
                        history: [...(currentState.history || []), transactionRecord]
                    }) as GameState;
                    states[playerUids[index]] = nextState;
                    transaction.set(playerRefs[index], nextState);
                });

                const subsidy: FinancialSubsidyState = {
                    sequence,
                    amount: subsidyAmount,
                    grantedAt,
                    grantedByUid: user.uid,
                    grantedByName: user.name,
                    playerUids: Object.keys(states)
                };
                transaction.update(roomRef, { financialSubsidy: subsidy });
                return { subsidy, states };
            }));
        } catch (err: any) {
            setError(err?.message || '全體補助發放失敗');
            throw err;
        }

        setPlayerStates(prev => ({ ...prev, ...result.states }));
        setRoom(prev => prev ? {
            ...prev,
            financialSubsidy: result.subsidy,
            playerStates: { ...(prev.playerStates || {}), ...result.states }
        } : prev);
    };

    const updateRoomTimer = async (timeLeft: number, isPaused: boolean, timerEndsAtMs: number | null = null) => {
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await runTransaction(db, async transaction => {
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) throw new Error('房間不存在或已關閉');
                const latestRoom = roomSnapshot.data() as Room;
                if (latestRoom.hostId !== user.uid) throw new Error('只有執行師可以控制遊戲計時器');
                if (latestRoom.status !== 'playing') throw new Error('請先開始遊戲，再啟動計時器');
                transaction.update(roomRef, cleanObject({
                    gameTimeLeft: timeLeft,
                    isTimerPaused: isPaused,
                    timerEndsAtMs: isPaused ? null : timerEndsAtMs
                }));
            });
        } catch (err: any) {
            console.error('更新計時器失敗:', err);
            setError(`計時器同步失敗：${err?.code || err?.message || '請稍後再試'}`);
            throw err;
        }
    };

    const resyncRoom = async () => {
        if (!room?.id) return;
        const snapshot = await getDoc(doc(db, 'rooms', room.id));
        if (!snapshot.exists()) throw new Error('房間不存在或已關閉');
        setRoom(snapshot.data() as Room);
        setError(null);
    };

    const retryStaleBoardMovement = async () => {
        if (!room?.id || !room.boardState?.movement?.isActive) throw new Error('目前沒有可重試的棋盤移動');
        const movement = room.boardState.movement;
        const movementDeadline = movement.startedAt + getBoardMovementSettleMs(movement);
        if (Date.now() <= movementDeadline + BOARD_MOVE_STALE_BUFFER_MS) {
            throw new Error('棋盤移動尚未超過可重試時間');
        }

        const commandId = `movement:${movement.playerUid}:${movement.startedAt}:settle`;
        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [movement.playerUid],
            forcePrivatePlayerStates: true,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const latestMovement = latestBoard.movement;
                if (!latestMovement?.isActive || latestMovement.playerUid !== movement.playerUid || latestMovement.startedAt !== movement.startedAt) {
                    throw new Error('棋盤移動已更新');
                }
                const resolution = buildBoardMovementLegResolution(latestRoom as Room, movement.playerUid);
                if (!resolution?.boardState) throw new Error('棋盤移動無法結算');
                return {
                    boardState: resolution.boardState,
                    roomPatch: resolution.playerStates ? { playerStates: resolution.playerStates } : undefined,
                    result: undefined
                };
            }
        });
    };

    // 所有事件結案只要恢復了 movement，就由移動玩家或執行師依遠端狀態
    // 安排同一個冪等結算；不再只依賴玩家分頁的計時器。主持端接手可避免
    // 背景分頁、手機省電或網路延遲讓銀行／卡片事件遲遲不建立。
    useEffect(() => {
        const movement = room?.boardState?.movement;
        const hostIsOffline = !!room?.hostId && presenceStates[room.hostId]?.status === 'offline';
        const isMovementOwnerFallback = movement?.playerUid === user?.uid && hostIsOffline;
        if (!room?.id || !movement?.isActive || (room.hostId !== user?.uid && !isMovementOwnerFallback)) return;

        const delay = Math.max(0, movement.startedAt + getBoardMovementSettleMs(movement) - Date.now());
        const timeoutId = window.setTimeout(() => {
            const commandId = `movement:${movement.playerUid}:${movement.startedAt}:settle`;
            void runRoomBoardMutation({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [movement.playerUid],
                forcePrivatePlayerStates: true,
                onDuplicate: () => undefined,
                mutate: (latestRoom, latestBoard) => {
                    const latestMovement = latestBoard.movement;
                    if (!latestMovement?.isActive || latestMovement.playerUid !== movement.playerUid || latestMovement.startedAt !== movement.startedAt) {
                        return { boardState: latestBoard, commit: false, result: undefined };
                    }
                    const resolution = buildBoardMovementLegResolution(latestRoom as Room, movement.playerUid);
                    if (!resolution?.boardState) throw new Error('棋盤移動無法結算');
                    return {
                        boardState: resolution.boardState,
                        roomPatch: resolution.playerStates ? { playerStates: resolution.playerStates } : undefined,
                        result: undefined
                    };
                }
            }).catch(err => console.error('棋盤移動自動結算失敗:', err));
        }, delay);

        return () => window.clearTimeout(timeoutId);
    }, [presenceStates, room?.boardState?.movement?.isActive, room?.boardState?.movement?.startedAt, room?.hostId, room?.id, user?.uid]);

    const submitRequest = async (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room) return false;
        try {
            const requestId = buildPendingRequestId(request, room.sessionId);
            const newRequest: PendingRequest = {
                ...request,
                id: requestId,
                status: 'pending',
                timestamp: Date.now(),
                ...(room.sessionId ? { sessionId: room.sessionId } : {})
            };

            // 首次建立子集合請求時不要先 transaction.get：玩家規則只允許
            // 讀取自己的既有請求，讀取不存在的文件會在 create 前被拒絕。
            // 直接 set 讓 Firestore 依 create/update 規則判斷，並保留固定 ID
            // 讓重整與重送不會產生第二筆請求。
            if (!room.sessionId) {
                const legacyRequest = cleanObject({ ...newRequest, id: request.uid });
                await updateDoc(doc(db, 'rooms', room.id), {
                    [`pendingRequests.${request.uid}`]: legacyRequest
                });
                return true;
            }

            const requestRef = doc(db, 'rooms', room.id, 'pendingRequests', requestId);
            try {
                await setDoc(requestRef, cleanObject(newRequest));
                return true;
            } catch (writeError) {
                // 連點或監聽延遲時，固定 ID 可能已由本次操作建立；更新會
                // 被 Rules 擋下，但既有 pending/approved 請求本身是成功狀態。
                const existingSnapshot = await getDoc(requestRef).catch(() => null);
                if (existingSnapshot?.exists()) {
                    const existingRequest = existingSnapshot.data() as PendingRequest;
                    if (
                        existingRequest.uid === request.uid &&
                        existingRequest.sessionId === room.sessionId &&
                        (existingRequest.status === 'pending' || existingRequest.status === 'approved')
                    ) {
                        return true;
                    }
                }
                throw writeError;
            }
        } catch (err: any) {
            console.error('送出審核請求失敗:', err);
            setError(err.message);
            return false;
        }
    };

    const approveRequest = async (requestId: string): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room || (user?.role !== 'coach' && user?.role !== 'gm')) return false;
        try {
            const request = pendingRequests[requestId] || room.pendingRequests?.[requestId];
            if (isPendingRequestDocumentId(requestId)) {
                if (!request) throw new Error('這筆審核請求不存在，請重新整理');
                const requestRef = doc(db, 'rooms', room.id, 'pendingRequests', requestId);
                if (request.type === 'happiness') {
                    const result = await safeAsync(runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                        const roomRef = doc(db, 'rooms', room.id);
                        const playerRef = doc(db, 'rooms', room.id, 'players', request.uid);
                        const [requestSnapshot, roomSnapshot, playerSnapshot] = await Promise.all([
                            transaction.get(requestRef),
                            transaction.get(roomRef),
                            transaction.get(playerRef)
                        ]);
                        if (!requestSnapshot.exists()) throw new Error('這筆幸福分享已處理或不存在');
                        const latestRequest = requestSnapshot.data() as PendingRequest;
                        if (latestRequest.status === 'approved') return;
                        if (latestRequest.type !== 'happiness' || latestRequest.status !== 'pending') {
                            throw new Error('這筆幸福分享已處理或不存在');
                        }
                        const latestRoom = roomSnapshot.data() as Room;
                        const latestBoard = latestRoom.boardState;
                        const card = latestRequest.boardCardId ? HAPPINESS_CARD_MAP[latestRequest.boardCardId] : null;
                        if (
                            !latestBoard ||
                            !card?.requiresStorySharing ||
                            latestBoard.currentEvent?.id !== latestRequest.boardEventId ||
                            latestBoard.currentCard?.cardId !== latestRequest.boardCardId
                        ) {
                            // 玩家在審核前已關閉卡片或事件已換卡：這筆請求已失效。改標為拒絕，
                            // 讓執行師端的審核彈窗自動消失，否則「同意」永遠失敗、彈窗卡住整個畫面。
                            transaction.update(requestRef, { status: 'rejected' });
                            return 'stale' as const;
                        }
                        if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');
                        const applied = applyApprovedHappinessStory(
                            playerSnapshot.data() as GameState,
                            latestRequest,
                            card.happinessPoints
                        );
                        if (!applied.duplicate) {
                            transaction.set(playerRef, cleanObject(applied.state));
                        }
                        transaction.update(requestRef, { status: 'approved' });
                    })));
                    if (result === 'stale') {
                        setError('這筆分享請求對應的卡片事件已結束，已自動清除');
                        return false;
                    }
                    return result !== null;
                }
                const result = await safeAsync(updateDoc(requestRef, { status: 'approved' }));
                return result !== null;
            }

            if (request?.type === 'happiness') {
                const requestKey = getPendingRequestExecutionKey(request);
                return await runRoomBoardMutation<boolean, Room>({
                    db,
                    roomId: room.id,
                    commandId: `approve-happiness:${requestKey}`,
                    playerStateUids: [request.uid],
                    onDuplicate: () => true,
                    mutate: (latestRoom, latestBoard) => {
                        const latestRequest = latestRoom.pendingRequests?.[requestId];
                        const card = latestRequest?.boardCardId ? HAPPINESS_CARD_MAP[latestRequest.boardCardId] : null;
                        if (!latestRequest || latestRequest.type !== 'happiness' || latestRequest.status !== 'pending') {
                            throw new Error('這筆幸福分享已處理或不存在');
                        }
                        if (
                            !card?.requiresStorySharing ||
                            latestBoard.currentEvent?.id !== latestRequest.boardEventId ||
                            latestBoard.currentCard?.cardId !== latestRequest.boardCardId
                        ) {
                            throw new Error('幸福分享事件已更新，請重新整理');
                        }
                        const latestPlayerState = latestRoom.playerStates?.[latestRequest.uid];
                        if (!latestPlayerState) throw new Error('找不到玩家資料');
                        const applied = applyApprovedHappinessStory(
                            latestPlayerState,
                            latestRequest,
                            card.happinessPoints
                        );
                        return {
                            boardState: latestBoard,
                            roomPatch: {
                                [`pendingRequests.${requestId}.status`]: 'approved',
                                [`playerStates.${latestRequest.uid}`]: applied.state
                            },
                            result: true
                        };
                    }
                });
            }
            const roomRef = doc(db, 'rooms', room.id);
            const result = await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}.status`]: 'approved'
            }));
            return result !== null;
        } catch (err: any) {
            console.error('核准請求失敗:', err);
            setError(err.message);
            return false;
        }
    };

    const rejectRequest = async (requestId: string): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room || (user?.role !== 'coach' && user?.role !== 'gm')) return false;
        try {
            if (isPendingRequestDocumentId(requestId)) {
                const result = await safeAsync(updateDoc(
                    doc(db, 'rooms', room.id, 'pendingRequests', requestId),
                    { status: 'rejected' }
                ));
                return result !== null;
            }
            const roomRef = doc(db, 'rooms', room.id);
            const result = await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}.status`]: 'rejected'
            }));
            return result !== null;
        } catch (err: any) {
            console.error('拒絕請求失敗:', err);
            setError(err.message);
            return false;
        }
    };

    const clearRequest = async (requestId: string): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room) return false;
        try {
            if (isPendingRequestDocumentId(requestId)) {
                try {
                    await deleteDoc(doc(db, 'rooms', room.id, 'pendingRequests', requestId));
                } catch (deleteError: any) {
                    // 執行師處理完會先刪除請求；Rules 對「已不存在的文件」的刪除會回
                    // permission-denied（resource 為 null）。請求已不在就等同清除完成，
                    // 不能因此讓玩家端的審核後續流程停住。
                    if (deleteError?.code === 'permission-denied') return true;
                    throw deleteError;
                }
                return true;
            }
            const roomRef = doc(db, 'rooms', room.id);
            const result = await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}`]: deleteField()
            }));
            return result !== null;
        } catch (err: any) {
            console.error('清除請求失敗:', err);
            setError(err.message);
            return false;
        }
    };

    const skipDisconnectedTurn = async (playerUid: string) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !room.boardState || !user || (user.role !== 'coach' && user.role !== 'gm')) return;

        let latestRealtimePresence: PresenceState | undefined;
        if (USE_REALTIME_PRESENCE) {
            const [presenceSnapshot, lastOnlineSnapshot] = await Promise.all([
                getRealtimeValue(realtimeRef(realtimeDb, `roomConnections/${room.id}/${playerUid}`)),
                getRealtimeValue(realtimeRef(realtimeDb, `roomLastOnline/${room.id}/${playerUid}`))
            ]);
            latestRealtimePresence = mapRealtimePresenceValue(
                { [playerUid]: presenceSnapshot.val() },
                { [playerUid]: lastOnlineSnapshot.val() }
            )[playerUid];
        }

        const presence = latestRealtimePresence || presenceStates[playerUid];
        if (!canSkipDisconnectedPlayer(presence)) {
            throw new Error('玩家尚未離線超過 120 秒');
        }
        if (room.boardState.currentTurnUid !== playerUid) {
            throw new Error('該玩家目前不是回合玩家');
        }
        if (
            room.boardState.movement?.isActive ||
            room.boardState.currentEvent ||
            room.boardState.pendingEvents?.length ||
            hasIncompleteSharedPrompts(room.boardState)
        ) {
            throw new Error('目前仍有未完成事件，不能跳過回合');
        }

        const roomRef = doc(db, 'rooms', room.id);
        const commandId = `turn-timeout:${playerUid}:${room.boardState.revision || 0}`;

        await safeAsync(runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
            const roomSnapshot = await transaction.get(roomRef);
            if (!roomSnapshot.exists()) throw new Error('房間不存在');

            const latestRoom = roomSnapshot.data() as Room;
            let latestPresence = latestRealtimePresence || presenceStates[playerUid];
            const latestBoard = latestRoom.boardState;
            if (!latestBoard || latestBoard.currentTurnUid !== playerUid) throw new Error('回合已更新');
            if (!canSkipDisconnectedPlayer(latestPresence)) throw new Error('玩家尚未離線超過 120 秒');
            if (
                latestBoard.movement?.isActive ||
                latestBoard.currentEvent ||
                latestBoard.pendingEvents?.length ||
                hasIncompleteSharedPrompts(latestBoard)
            ) throw new Error('目前仍有未完成事件，不能跳過回合');

            const nextTurn = getNextBoardTurn(latestBoard);
            const nextTurnUid = nextTurn?.nextUid || playerUid;
            const timestamp = Date.now();
            const nextBoard = applyBoardCommand({
                ...latestBoard,
                currentTurnUid: nextTurnUid,
                hasRolledThisTurn: false,
                skipTurns: nextTurn?.skipTurns || latestBoard.skipTurns,
                skippedTurnNotice: nextTurn?.skippedUids.length ? {
                    playerUids: nextTurn.skippedUids,
                    nextTurnUid,
                    timestamp
                } : null,
                updatedAt: timestamp
            }, commandId).boardState;
            transaction.update(roomRef, { boardState: nextBoard });
        })));
    };

    const skipDisconnectedSharedPromptTarget = async (playerUid: string) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !room.boardState?.sharedCardPrompt || !user || room.hostId !== user.uid) return;

        let latestRealtimePresence: PresenceState | undefined;
        if (USE_REALTIME_PRESENCE) {
            const [presenceSnapshot, lastOnlineSnapshot] = await Promise.all([
                getRealtimeValue(realtimeRef(realtimeDb, `roomConnections/${room.id}/${playerUid}`)),
                getRealtimeValue(realtimeRef(realtimeDb, `roomLastOnline/${room.id}/${playerUid}`))
            ]);
            latestRealtimePresence = mapRealtimePresenceValue(
                { [playerUid]: presenceSnapshot.val() },
                { [playerUid]: lastOnlineSnapshot.val() }
            )[playerUid];
        }
        if (!canSkipDisconnectedPlayer(latestRealtimePresence || presenceStates[playerUid])) {
            throw new Error('玩家尚未離線超過 120 秒');
        }

        const promptId = room.boardState.sharedCardPrompt.id;
        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: `prompt:shared:offline:${promptId}:${playerUid}`,
            retryOnPermissionDenied: true,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const prompt = latestBoard.sharedCardPrompt;
                if (!prompt || prompt.id !== promptId || !prompt.targetPlayerUids.includes(playerUid) || prompt.responses?.[playerUid]) {
                    return { boardState: latestBoard, commit: false, result: undefined };
                }
                if (!canSkipDisconnectedPlayer(latestRealtimePresence || presenceStates[playerUid])) {
                    throw new Error('玩家尚未離線超過 120 秒');
                }
                const response: SharedCardPromptResponse = {
                    playerUid,
                    playerName: room.members.find(member => member.uid === playerUid)?.name || '失聯玩家',
                    status: 'declined',
                    note: '主持人依離線門檻排除',
                    respondedAt: Date.now()
                };
                const nextPrompt: SharedCardPrompt = {
                    ...prompt,
                    responses: {
                        ...(prompt.responses || {}),
                        [playerUid]: response
                    }
                };
                if (hasIncompleteSharedPrompts({ ...latestBoard, sharedCardPrompt: nextPrompt })) {
                    return {
                        boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: Date.now() },
                        sharedResponse: { uid: playerUid, response },
                        result: undefined
                    };
                }
                const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
                const advanced = buildBoardEventAdvanceState({
                    ...latestRoom,
                    boardState: { ...latestBoard, sharedCardPrompt: undefined, cardLog: currentCardLog }
                } as Room);
                if (!advanced?.boardState) throw new Error('共享事件無法結案');
                return {
                    boardState: { ...advanced.boardState, cardLog: currentCardLog, updatedAt: Date.now() },
                    sharedResponse: { uid: playerUid, response },
                    result: undefined
                };
            }
        });
    };

    const coachTriggerBoardCard = async (playerUid: string, cardId: string) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以觸發測試卡片');
        }
        if (!room.boardState.turnOrder.includes(playerUid)) throw new Error('找不到這位玩家');

        const commandId = `coach-card-test:${cardId}:${playerUid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        try {
            await runRoomBoardMutation({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [playerUid],
                onDuplicate: () => undefined,
                mutate: (latestRoom, latestBoard) => {
                const targetMember = latestRoom.members.find(member => member.uid === playerUid && !member.isLeft);
                if (!targetMember || !latestBoard.turnOrder.includes(playerUid)) throw new Error('這位玩家目前不在遊戲中');
                if (latestBoard.movement || latestBoard.currentEvent || latestBoard.currentCard || latestBoard.pendingEvents?.length || hasIncompleteSharedPrompts(latestBoard)) {
                    throw new Error('請先完成或解除目前遊戲流程');
                }

                const card = buildBoardCardResultById(cardId, latestRoom.playerStates?.[playerUid]);
                if (!card) throw new Error(`找不到卡片 ${cardId}`);

                const timestamp = Date.now();
                const eventId = `coach-card-test:${cardId}:${playerUid}:${timestamp}`;
                const event: BoardEventLog = {
                    id: eventId,
                    playerUid,
                    playerName: latestRoom.playerStates?.[playerUid]?.playerName || room.members.find(member => member.uid === playerUid)?.name || '玩家',
                    type: 'card',
                    summary: `測試觸發：${card.title}`,
                    detail: `執行師直接觸發 ${card.cardId}`,
                    squareIndex: latestBoard.playerPositions[playerUid] ?? 0,
                    timestamp
                };

                    return {
                        boardState: {
                            ...latestBoard,
                            currentTurnUid: playerUid,
                            hasRolledThisTurn: true,
                            currentEvent: event,
                            currentCard: card,
                            currentCardReveal: { eventId, cardId: card.cardId, isRevealed: false },
                            skippedTurnNotice: null,
                            updatedAt: timestamp
                        },
                        result: undefined
                    };
                }
            });
        } catch (error) {
            if (isRetryableBoardTransactionError(error)) {
                throw new Error('房間正在同步，請稍候再試；請不要重複點擊。');
            }
            throw error;
        }
    };

    const repeatCurrentBoardEvent = async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以重複目前事件');
        }
        if (!room.boardState.currentEvent) throw new Error('目前沒有可重複的事件');
        if (room.boardState.movement || room.boardState.pendingEvents?.length || hasIncompleteSharedPrompts(room.boardState)) {
            throw new Error('請先完成目前的移動或共享事件');
        }

        const eventId = room.boardState.currentEvent.id;
        const commandId = `coach-repeat:${eventId}:${room.boardState.revision || 0}`;
        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [room.boardState.currentEvent.playerUid],
            onDuplicate: () => undefined,
            mutate: (_latestRoom, latestBoard) => {
                const currentEvent = latestBoard.currentEvent;
                if (!currentEvent || currentEvent.id !== eventId) throw new Error('目前事件已更新');
                if (latestBoard.movement || latestBoard.pendingEvents?.length || hasIncompleteSharedPrompts(latestBoard)) {
                    throw new Error('請先完成目前的移動或共享事件');
                }
                const timestamp = Date.now();
                return {
                    boardState: {
                        ...latestBoard,
                        currentEvent: {
                            ...currentEvent,
                            id: `${currentEvent.id}:repeat:${timestamp}`,
                            timestamp
                        },
                        currentCardReveal: null,
                        updatedAt: timestamp
                    },
                    result: undefined
                };
            }
        });
    };

    const setCoachNextTurn = async (playerUid: string) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以指定下一回合');
        }
        if (!room.boardState.turnOrder.includes(playerUid)) throw new Error('找不到這位玩家');
        if (room.boardState.movement || room.boardState.currentEvent || room.boardState.pendingEvents?.length || hasIncompleteSharedPrompts(room.boardState)) {
            throw new Error('請先完成目前的遊戲流程');
        }

        const commandId = `coach-turn:${playerUid}:${room.boardState.revision || 0}`;
        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const isPlayer = latestBoard.turnOrder.includes(playerUid);
                if (!isPlayer) throw new Error('這位玩家目前不在遊戲中');
                if (latestBoard.movement || latestBoard.currentEvent || latestBoard.pendingEvents?.length || hasIncompleteSharedPrompts(latestBoard)) {
                    throw new Error('請先完成目前的遊戲流程');
                }
                return {
                    boardState: {
                        ...latestBoard,
                        currentTurnUid: playerUid,
                        hasRolledThisTurn: false,
                        skippedTurnNotice: null,
                        updatedAt: Date.now()
                    },
                    result: undefined
                };
            }
        });
    };

    const runCoachBoardRecovery = async (mode: 'clear_event' | 'force_end') => {
        if (!room?.id || !room.boardState || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以執行回合解鎖');
        }

        const commandId = `coach-${mode}:${room.boardState.currentTurnUid || 'none'}:${room.boardState.revision || 0}`;
        await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: room.boardState.turnOrder,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const timestamp = Date.now();
                const clearedBoard = clearBoardFlowState(latestBoard, timestamp);
                const clearedPlayerStates = Object.fromEntries(
                    Object.entries(latestRoom.playerStates || {}).map(([uid, state]) => {
                        const nextState = { ...state };
                        delete nextState.pendingFamilyMilestoneJoinAction;
                        delete nextState.pendingStartupUpgradeAction;
                        delete nextState.pendingStartupUpgradeActions;
                        delete nextState.pendingCardAction;
                        return [uid, cleanObject(nextState)];
                    })
                );

                if (mode === 'clear_event') {
                    return {
                        boardState: clearedBoard,
                        roomPatch: { playerStates: clearedPlayerStates },
                        result: undefined
                    };
                }

                const nextTurn = getNextBoardTurn(clearedBoard);
                const nextTurnUid = nextTurn?.nextUid || clearedBoard.currentTurnUid;
                return {
                    boardState: {
                        ...clearedBoard,
                        currentTurnUid: nextTurnUid,
                        hasRolledThisTurn: false,
                        skipTurns: nextTurn?.skipTurns || clearedBoard.skipTurns,
                        skippedTurnNotice: nextTurn?.skippedUids.length ? {
                            playerUids: nextTurn.skippedUids,
                            nextTurnUid: nextTurnUid || '',
                            timestamp
                        } : null
                    },
                    roomPatch: { playerStates: clearedPlayerStates },
                    result: undefined
                };
            }
        });
    };

    const clearCurrentBoardEvent = () => runCoachBoardRecovery('clear_event');
    const forceEndBoardTurn = () => runCoachBoardRecovery('force_end');

    return (
        <RoomContext.Provider value={{
            room,
            isLoadingRoom,
            error,
            playerStates,
            playerStatesHydrated,
            roomSyncState,
            connectionState,
            isController,
            presenceStates,
            pendingRequests,
            createRoom,
            setRoomPlayerSlotOpen,
            joinRoom,
            leaveRoom,
            leaveToLobby,
            startRoomGame,
            finishRoomGame,
            closeRoom,
            updateMarket,
            adjustPlayerCash,
            adjustPlayerInvestmentIncome,
            adjustPlayerLiability,
            adjustPlayerExpense,
            updateFinancialAcceleration,
            grantFinancialSubsidyToAllPlayers,
            updateRoomTimer,
            submitRequest,
            approveRequest,
            rejectRequest,
            clearRequest,
            rollBoardDice,
            rollRepairFee,
            rollHospitalFee,
            rollSkillDice,
            rollFamilyMilestoneJoin,
            rollStartupUpgradeDice,
            revealBoardCard,
            dismissBoardCard,
            advanceBoardEventQueue,
            endTurn,
            drawPostExamHappinessCard,
            drawBoardFollowupCard,
            openFamilyMilestoneJoinPrompt,
            openSharedCardPrompt,
            submitFamilyMilestoneJoinResponse,
            clearPendingFamilyMilestoneJoinAction,
            markFamilyMilestoneSourceActionCompleted,
            completeFamilyMilestoneAction,
            submitSharedCardPromptResponse,
            completeSharedInvestmentAction,
            completeSharedAssetSaleAction,
            completeStartupLoanAction,
            completeTargetEnterprisePurchase,
            completeMedicalBoardCardAction,
            completeDirectHappinessCard,
            completeInsurancePurchase,
            completeDepositPurchase,
            completeStockTrade,
            completeLoanBorrow,
            completeBoardTransaction,
            completePaydayCollection,
            completeHouseConversion,
            completeHappinessToggle,
            completeHappinessAdd,
            completeHappinessRemove,
            completePlayerOnlyTransaction,
            completeSharedTransactionAction,
            completeLoanRepayment,
            completeDepositWithdrawal,
            completeCarPurchase,
            completeStartupUpgradeAction,
            clearSharedCardPrompt,
            setPendingStartupUpgradeAction,
            clearPendingStartupUpgradeAction,
            applyBoardExpenseToAllPlayers,
            moveCurrentPlayerToSquare,
            applyBoardMarketPrices,
            buyCurrentRealEstateCard,
            buyRealEstateFromMarket,
            applyVehicleLoss,
            skipDisconnectedTurn,
            skipDisconnectedSharedPromptTarget,
            coachTriggerBoardCard,
            repeatCurrentBoardEvent,
            setCoachNextTurn,
            clearCurrentBoardEvent,
            forceEndBoardTurn,
            resyncRoom,
            retryStaleBoardMovement
        }}>
            {children}
        </RoomContext.Provider>
    );
};

export const useRoom = () => {
    const context = useContext(RoomContext);
    if (!context) throw new Error('useRoom must be used within a RoomProvider');
    return context;
};
