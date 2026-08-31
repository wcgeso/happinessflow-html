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
import { BoardCardLogEntry, BoardCardResult, BoardDeckState, BoardEventLog, BoardQueuedEvent, BoardState, CoachExpenseCategory, FamilyMilestoneJoinPrompt, FinancialAccelerationMultiplier, FinancialAccelerationState, FinancialSubsidyState, GameState, PlayerDiagnosticState, PresenceState, PublicPlayerState, SharedCardPrompt, Transaction, TransactionData } from '../types';
import { cleanObject, safeAsync } from '../utils/utils';
import { STOCK_SYMBOLS } from '../constants';
import { flowLog } from '../utils/flowLog';
import { BOARD_SQUARES, createInitialDeckState, getSquareByIndex } from '../constants/board';
import {
    buildHappinessCardMetaFromSchema,
    buildNewsCardMetaFromSchema,
    buildOpportunityCardMetaFromSchema,
    HAPPINESS_CARDS,
    NEWS_CARD_MAP,
    NEWS_CARDS,
    OPPORTUNITY_CARDS
} from '../constants/cards';
import { applyFamilyMilestoneStage, getFamilyMilestoneStageByCardId, getFamilyMilestoneStageByProgressId, getFamilyMilestoneStatus } from '../utils/familyMilestones';
import { getSharedOpportunityKind, resolveBoardCardAction, hasIncompleteSharedPrompts, isBoardPromptForCurrentEvent } from '../utils/boardCardActions';
import { buildMovementEffects, describeMovementEffects } from '../game/board/movementEffects';
import { runRoomBoardMutation as runRoomBoardMutationOnServer, type BoardRoomSnapshot, type RunRoomBoardMutationParams } from '../game/board/runBoardMutation';
import { applyBoardCommand } from '../game/board/boardRevision';
import { toPublicPlayerState } from '../utils/playerState';
import { getBusinessAssetLabel, getRealEstateAssetLabel } from '../utils/assetLabels';
import { canSkipDisconnectedPlayer, mapRealtimeDiagnosticsValue, mapRealtimePresenceValue } from '../utils/presence';
import { clearBoardFlowState, getNextBoardTurn } from '../utils/experienceState';
import { applyPlayerExpenseAdjustment, applyPlayerLiabilityAdjustment } from '../utils/coachAdjustments';

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

// Presence/diagnostics are ephemeral connection data; Firestore is reserved for game state.
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
}

export type BoardFinancialMutationResult = {
    status: 'applied' | 'duplicate' | 'requires_funding' | 'failed';
    shortfall?: number;
    message?: string;
};

export const getPendingRequestExecutionKey = (request: Pick<PendingRequest, 'id' | 'uid' | 'type' | 'timestamp' | 'boardEventId' | 'boardCardId'>) =>
    [request.type, request.uid, request.boardEventId || 'no-event', request.boardCardId || 'no-card', request.timestamp || request.id].join(':');

export interface Room {
    id: string; // 房間碼 (6位數)
    name?: string; // 房間標題
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    members: RoomMember[];
    memberUids?: string[];
    createdAt: any;
    maxPlayers: number;
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

export const mergeRoomSnapshotWithPrivateStates = (snapshotRoom: Room, currentRoom: Room | null): Room => ({
    ...snapshotRoom,
    ...(currentRoom?.id === snapshotRoom.id && currentRoom.playerStates
        ? { playerStates: currentRoom.playerStates }
        : {})
});

const buildHappinessCardMeta = (cardId: string, playerState?: GameState | null) => {
    return buildHappinessCardMetaFromSchema(cardId, playerState);
};

const buildOpportunityCardMeta = (cardId: string) => {
    return buildOpportunityCardMetaFromSchema(cardId);
};

const buildNewsCardMeta = (cardId: string) => {
    return buildNewsCardMetaFromSchema(cardId);
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

    const meta = deck === 'happiness'
        ? buildHappinessCardMeta(cardId, playerState)
        : deck === 'opportunity'
            ? buildOpportunityCardMeta(cardId)
            : buildNewsCardMeta(cardId);
    if (!meta) return null;

    usedDeck.push(cardId);

    return {
        card: {
            deck: meta.deck,
            cardId,
            title: meta.title,
            description: meta.description,
            subtitle: meta.subtitle,
            effectLines: meta.effectLines
        } as BoardCardResult,
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
const BOARD_DICE_ROLL_ANIMATION_MS = 3500;
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

// 注意：第一段移動的 introDelayMs 已內含 BOARD_DICE_ROLL_ANIMATION_MS
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
        { cardId: card.id, symbol: card.id }
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

export const buildStartupUpgradeState = (
    currentState: GameState,
    payload: { assetId: string; cardId: string; diceRoll: number },
    commandId: string,
    now = Date.now()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;

    const pending = currentState.pendingStartupUpgradeAction || currentState.pendingStartupUpgradeActions?.[0];
    if (!pending || pending.cardId !== payload.cardId) {
        throw new Error('企業升級等待狀態已更新');
    }
    if (!Number.isInteger(payload.diceRoll) || payload.diceRoll < 1 || payload.diceRoll > 6) {
        throw new Error('企業升級骰點無效');
    }

    const assetIndex = currentState.assets.findIndex(asset => asset.id === payload.assetId);
    if (assetIndex < 0) throw new Error('待升級的兼職工作室不存在');
    const asset = currentState.assets[assetIndex];
    if (asset.type !== '企業' || asset.isUpgraded) return currentState;

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

    const pendingUpgradeQueue = (currentState.pendingStartupUpgradeActions || (currentState.pendingStartupUpgradeAction ? [currentState.pendingStartupUpgradeAction] : []))
        .filter(item => item.cardId !== pending.cardId);

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
        return { boardState: latestBoard, result: false };
    }

    const currentState = latestRoom.playerStates?.[playerUid];
    if (!currentState) throw new Error('玩家資料尚未同步完成');

    const card = NEWS_CARD_MAP[prompt.sourceCardId];
    if (!card || card.type !== 'small_business') throw new Error('創業貸款事件資料已更新');

    const nextPlayerState = buildStartupLoanState(currentState, card.id, commandId);
    const nextPrompt: SharedCardPrompt = {
        ...prompt,
        responses: {
            ...(prompt.responses || {}),
            [playerUid]: {
                playerUid,
                playerName,
                status: 'completed',
                amount: card.investmentPerMonth,
                note: '創業貸款已建立',
                respondedAt: Date.now()
            }
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
        result: true
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
        hasCarAsset(playerState),
        rollBoardDie
    );
    const repairEffects = new Map(movementEffects.map(effect => [effect.squareIndex, effect]));
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
            // 依 docs/gdd/REPAIR_SYSTEM.md：經過維修廠與停留維修廠都必須先擲一次正式事件骰點，
            // 保養費必須走正式財務檢核，不得只顯示文字讓玩家自行登錄。
            const repairEffect = repairEffects.get(nextPosition);
            const repairRoll = repairEffect?.dice || rollBoardDie();
            const repairFee = repairEffect?.amount || repairRoll * 2000;
            event = {
                id: `${playerUid}_${eventTimestamp}_repair`,
                playerUid,
                playerName,
                type: 'repair',
                summary: `${playerName} 經過維修廠`,
                detail: `經過維修廠，汽車保養費 ${repairFee}，請完成財務檢核`,
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                repairRoll,
                repairFee,
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
        const repairEffect = repairEffects.get(nextPosition);
        const repairRoll = repairEffect?.dice || rollBoardDie();
        const repairFee = repairEffect?.amount || repairRoll * 2000;
        if (hasCarAsset(playerState)) {
            detailMessages.push(`踩到維修廠，保養費 ${repairFee}，並暫停一回合`);
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
                repairRoll,
                repairFee: hasCar ? repairFee : 0,
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
    playerDiagnostics: Record<string, PlayerDiagnosticState>;
    createRoom: (settings?: { name: string; maxPlayers: number; duration: number; isPractice?: boolean; isBoardGame?: boolean }) => Promise<string>;
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
    updatePlayerDiagnostic: (diagnostic: Omit<PlayerDiagnosticState, 'uid' | 'updatedAt'>) => Promise<void>;
    updateFinancialAcceleration: (multiplier: FinancialAccelerationMultiplier) => Promise<void>;
    grantFinancialSubsidyToAllPlayers: (amount: number) => Promise<void>;
    updateRoomTimer: (timeLeft: number, isPaused: boolean, timerEndsAtMs?: number | null) => Promise<void>;
    submitRequest: (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>) => Promise<boolean>;
    approveRequest: (requestId: string) => Promise<boolean>;
    rejectRequest: (requestId: string) => Promise<boolean>;
    clearRequest: (requestId: string) => Promise<boolean>;
    rollBoardDice: (diceCount?: 1 | 2) => Promise<{ position: number; detail: string; skipTurns: number; total: number; dice: number[] }>;
    revealBoardCard: (eventId: string, cardId: string) => Promise<void>;
    dismissBoardCard: (eventId: string, cardId: string, addToRealEstateMarket?: boolean) => Promise<boolean>;
    advanceBoardEventQueue: (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup') => Promise<void>;
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
    }) => Promise<boolean>;
    clearPendingFamilyMilestoneJoinAction: (promptId: string) => Promise<boolean>;
    markFamilyMilestoneSourceActionCompleted: (promptId: string) => Promise<boolean>;
    completeFamilyMilestoneAction: (payload: { promptId: string; accepted: boolean }) => Promise<{
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
    completeStartupLoanAction: (promptId: string) => Promise<boolean>;
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
    const [roomSyncState, setRoomSyncState] = useState<RoomContextValue['roomSyncState']>('idle');
    const [connectionState, setConnectionState] = useState<RoomContextValue['connectionState']>('offline');
    const [isController, setIsController] = useState(true);
    const [presenceStates, setPresenceStates] = useState<Record<string, PresenceState>>({});
    const [playerDiagnostics, setPlayerDiagnostics] = useState<Record<string, PlayerDiagnosticState>>({});
    const presenceSessionIdRef = useRef<string | null>(null);
    const presenceConnectionRef = useRef<DatabaseReference | null>(null);
    const realtimeClientIdRef = useRef<string>(getTabClientId());
    const presenceLastOnlineRef = useRef<Record<string, number>>({});
    const presenceConnectionsRef = useRef<unknown>({});
    const roomListenerTokenRef = useRef<string | null>(null);
    const resumeSuppressedRoomRef = useRef<string | null>(null);
    const isClosingRoomRef = useRef(false);

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
        const clientId = realtimeClientIdRef.current;
        const connectionRef = pushRealtime(realtimeRef(realtimeDb, `roomConnections/${room.id}/${user.uid}`));
        const lastOnlineRef = realtimeRef(realtimeDb, `roomLastOnline/${room.id}/${user.uid}`);
        const diagnosticRef = realtimeRef(realtimeDb, `roomDiagnostics/${room.id}/${user.uid}/${clientId}`);
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
                onRealtimeDisconnect(diagnosticRef).remove(),
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
                removeRealtime(diagnosticRef)
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
        const unsubscribeLastOnline = onRealtimeValue(
            realtimeRef(realtimeDb, `roomLastOnline/${room.id}`),
            snapshot => {
                presenceLastOnlineRef.current = (snapshot.val() || {}) as Record<string, number>;
                updatePresence();
            },
            error => console.error('監聽玩家最後離線時間失敗:', error)
        );
        return () => {
            unsubscribeConnections();
            unsubscribeLastOnline();
        };
        }, [room?.id, user?.uid]);

    useEffect(() => {
        const canMonitorRoomPlayers = !!user && !!room && (user.uid === room.hostId || user.role === 'coach' || user.role === 'gm');
        if (!canMonitorRoomPlayers || !room?.id) {
            setPlayerDiagnostics({});
            return;
        }

        return onRealtimeValue(
            realtimeRef(realtimeDb, `roomDiagnostics/${room.id}`),
            snapshot => setPlayerDiagnostics(mapRealtimeDiagnosticsValue(snapshot.val())),
            error => console.error('監聽玩家診斷狀態失敗:', error)
        );
    }, [room?.hostId, room?.id, user?.role, user?.uid]);

    // 同一帳號多分頁時，最新開啟的分頁取得控制權；舊分頁只保留畫面同步。
    useEffect(() => {
        if (!user?.uid || !room?.id) {
            setIsController(true);
            return;
        }
        setIsController(false);
        const controllerRef = realtimeRef(realtimeDb, `roomControllers/${room.id}/${user.uid}`);
        const clientId = realtimeClientIdRef.current;
        void setRealtime(controllerRef, { clientId, claimedAt: Date.now() })
            .catch(error => console.error('取得分頁控制權失敗:', error));
        return onRealtimeValue(controllerRef, snapshot => {
            setIsController(snapshot.val()?.clientId === clientId);
        }, error => {
            console.error('監聽分頁控制權失敗:', error);
            setIsController(false);
        });
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

    const executeBoardRevealWithRetry = async (action: () => Promise<boolean>): Promise<void> => {
        const retryLimit = 20;
        for (let attempt = 0; attempt < retryLimit; attempt += 1) {
            if (isProcessingRef.current) {
                await new Promise(resolve => window.setTimeout(resolve, 50));
                continue;
            }

            const completed = await executeWithLock(action);
            if (completed) return;
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
            await safeAsync(runTransaction(db, async transaction => {
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
            }));
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
            await safeAsync(runTransaction(db, async (transaction) => {
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
            }));
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
                commandId: `repair:board-prompt:${snapshotBoard.revision || 0}:${completedFamilyPrompt?.id || Array.from(stalePromptIds).join('|')}`,
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
                    if (!shouldClearFamily && !shouldClearShared) {
                        return { boardState: latestBoard, result: false };
                    }

                    const nextPlayerStates = Object.fromEntries(
                        Object.entries(latestRoom.playerStates || {}).map(([uid, state]) => {
                            const pendingPromptId = state?.pendingFamilyMilestoneJoinAction?.promptId;
                            if (!pendingPromptId || !stalePromptIds.has(pendingPromptId)) return [uid, state];
                            const nextState = { ...state };
                            delete nextState.pendingFamilyMilestoneJoinAction;
                            return [uid, cleanObject(nextState)];
                        })
                    );
                    const nextPendingRequests = Object.fromEntries(
                        Object.entries(latestRoom.pendingRequests || {}).filter(([, request]) =>
                            request.type !== 'family_milestone' &&
                            (!request.boardEventId || !staleEventIds.has(request.boardEventId))
                        )
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

    // 監聽房間狀態
    useEffect(() => {
        if (!user) {
            setRoomSyncState('idle');
            setRoom(null);
            setPlayerStates({});
            setPlayerStatesHydrated(false);
            return;
        }

        // 優先目前房間，其次本分頁快取，最後使用帳號的跨裝置恢復指標。
        const persistedRoomId = localStorage.getItem(`active_room_${user.uid}`);
        const resumableRoomId = resumeSuppressedRoomRef.current === user.activeGame?.roomId
            ? undefined
            : user.activeGame?.roomId;
        const targetRoomId = room?.id || persistedRoomId || resumableRoomId;

        if (!targetRoomId) {
            roomListenerTokenRef.current = null;
            setRoomSyncState('idle');
            // 如果連 localStorage 都沒 ID，確保 room 狀態也是 null
            if (room) setRoom(null);
            return;
        }

        roomListenerTokenRef.current = targetRoomId;
        setRoomSyncState('cached');
        console.log('開始監聽房間:', targetRoomId);
        const unsubscribe = onSnapshot(doc(db, 'rooms', targetRoomId), { includeMetadataChanges: true }, (snapshot) => {
            if (roomListenerTokenRef.current !== targetRoomId) return;
            const serverConfirmed = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
            setRoomSyncState(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites ? 'cached' : 'synced');
            if (snapshot.exists()) {
                const data = snapshot.data() as Room;
                console.log('房間數據更新:', data.id, '狀態:', data.status, '成員數:', data.members?.length);

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
                    (data.hostId === user.uid || movement.playerUid === user.uid)
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
                    setRoom(null);
                    localStorage.removeItem(`active_room_${user.uid}`);
                    localStorage.removeItem('hf_practice_mode');
                    return;
                }

                if (data.pendingRequests) {
                    console.log('偵測到待審核請求:', Object.keys(data.pendingRequests).length, '筆');
                }
                setRoom(prev => mergeRoomSnapshotWithPrivateStates(data, prev));

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
            } else {
                console.log('房間不存在或已被關閉');
                setRoom(null);
                localStorage.removeItem(`active_room_${user.uid}`);
                localStorage.removeItem('hf_practice_mode');
            }
        }, (err) => {
            if (roomListenerTokenRef.current !== targetRoomId) return;
            console.error('監聽房間失敗:', err);
            setRoomSyncState(err.code === 'unavailable' ? 'offline' : 'error');
            if (err.code === 'permission-denied') {
                setError('權限不足，請檢查 Firebase Firestore Rules 設定');
            }
            if (err.code === 'permission-denied' || err.code === 'not-found') {
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
    }, [user?.activeGame?.roomId, user?.uid, room?.id, healMissingTurnOrderPlayers, healStaleBoardPrompts, migrateLegacyPlayerStates]); // 監聽 room.id 變化，確保切換房間時能重新綁定器

    // Full financial state is private. Coaches can monitor all player documents;
    // ordinary players only subscribe to their own document.
    useEffect(() => {
        setPlayerStatesHydrated(false);
        if (!user || !room?.id) {
            setPlayerStates({});
            return;
        }

        const statesRef = collection(db, 'rooms', room.id, 'players');
        const applyStates = (states: Record<string, GameState>) => {
            setPlayerStates(states);
            setRoom(prev => prev ? { ...prev, playerStates: states } : prev);
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

        return onSnapshot(doc(db, 'rooms', room.id, 'players', user.uid), { includeMetadataChanges: true }, snapshot => {
            applyStates(snapshot.exists() ? { [user.uid]: snapshot.data() as GameState } : {});
        }, error => {
            console.error('監聽自己的玩家狀態失敗:', error);
            setPlayerStatesHydrated(true);
        });
    }, [room?.id, room?.hostId, user?.role, user?.uid]);

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
        if (room) throw new Error('請先關閉目前房間，再建立新房');

        setIsLoadingRoom(true);
        setError(null);
        try {
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
                duration: settings?.duration || 60,
                gameTimeLeft: (settings?.duration || 60) * 60,
                isTimerPaused: true,
                sessionId: `${roomCode}_${Date.now()}`,
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

    const joinRoom = async (roomCode: string) => {
        if (!user) throw new Error('請先登入');
        setIsLoadingRoom(true);
        setError(null);
        try {
            const roomRef = doc(db, 'rooms', roomCode);
            const roomDoc = await getDoc(roomRef);

            if (!roomDoc || !roomDoc.exists()) throw new Error('此房間不存在');

            const roomData = roomDoc.data() as Room;
            const privateStateDoc = await getDoc(doc(db, 'rooms', roomCode, 'players', user.uid));

            // 檢查是否已在房間內或已有存檔（支援斷線重連，不論房間狀態）
            const existingMember = roomData.members.find(m => m.uid === user.uid);
            const hasCloudState = privateStateDoc?.exists() || !!roomData.playerStates?.[user.uid];
            
            if (existingMember || hasCloudState) {
                // 如果已經在 members 裡面，直接進入
                if (existingMember) {
                    resumeSuppressedRoomRef.current = null;
                    await updateDoc(doc(db, 'users', user.uid), {
                        activeGame: { roomId: roomCode, joinedAt: Date.now() }
                    });
                    setRoom(roomData);
                    localStorage.setItem(`active_room_${user.uid}`, roomCode);
                    return;
                }
                
                // 如果不在 members 但有 playerStates，表示是中途離開又回來的玩家，允許重新加入
                console.log('偵測到雲端存檔，允許中途重新加入房間');
            } else if (roomData.status !== 'waiting') {
                throw new Error('遊戲已開始或已結束');
            }

            // 檢查人數限制（排除房主本人，執行師帳號也可能以參與者身分加入別人的房間）
            const playerMembers = roomData.members.filter(m => m.uid !== roomData.hostId);
            if (playerMembers.length >= roomData.maxPlayers) throw new Error('房間已滿');

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

            // 使用同步更新確保本地狀態第一時間反映
            setRoom(prev => {
                if (!prev || prev.id !== roomCode) return prev;
                // 避免重複添加
                const exists = prev.members.some(m => m.uid === user.uid);
                if (exists) return prev;
                return {
                    ...prev,
                    members: [...prev.members, cleanedMember]
                };
            });

            await updateDoc(roomRef, {
                members: arrayUnion(cleanedMember),
                memberUids: arrayUnion(user.uid)
            });
            await updateDoc(doc(db, 'users', user.uid), {
                activeGame: { roomId: roomCode, joinedAt: Date.now() }
            });

            // 存入 localStorage 並手動更新 room ID 觸發監聽器
            resumeSuppressedRoomRef.current = null;
            localStorage.setItem(`active_room_${user.uid}`, roomCode);
            setRoom(prev => (prev?.id === roomCode ? prev : { id: roomCode, members: [], hostId: '', status: 'waiting', name: '' } as any));
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
        if (!canMutateCurrentRoom()) return;
        if (!room || user?.uid !== room.hostId) return;
        try {
            // 讀取本地 room 快照有可能落後於 Firestore 最新狀態（例如玩家剛加入、
            // 監聽尚未同步回房主端），若直接拿本地 room.members 建立 turnOrder，
            // 會漏掉剛加入但還沒同步到的玩家，導致棋盤永久少人。改用 transaction
            // 內即時讀取最新的房間文件，確保 turnOrder 以 Firestore 當下的真實
            // members 為準。
            const roomRef = doc(db, 'rooms', room.id);
            const roomDoc = await getDoc(roomRef);
            if (!roomDoc.exists()) throw new Error('房間不存在或已關閉');

            const currentRoom = roomDoc.data() as Room;
            if (currentRoom.hostId !== user.uid) throw new Error('只有執行師可以開始遊戲');

            const nextBoardState = currentRoom.isBoardGame
                ? createInitialBoardState(currentRoom.members, currentRoom.hostId, currentRoom.playerStates)
                : null;
            const startedAt = Date.now();
            const sessionId = `${room.id}_${startedAt}`;
            const batch = writeBatch(db);

            batch.update(roomRef, {
                status: 'playing',
                publicPlayerStates: {},
                playerStates: deleteField(),
                pendingRequests: {},
                startedAt,
                sessionId,
                boardState: nextBoardState,
                memberUids: currentRoom.members.map(member => member.uid)
            });
            currentRoom.members
                .filter(member => member.uid !== currentRoom.hostId)
                .forEach(member => batch.delete(doc(db, 'rooms', room.id, 'players', member.uid)));

            await batch.commit();
            setRoom(prev => prev?.id === room.id ? { ...prev, status: 'playing', startedAt, sessionId, boardState: nextBoardState } : prev);
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
        const diceCount = hasCarAsset(playerState)
            ? (requestedDiceCount === 1 ? 1 : 2)
            : 1;
        const dice = candidateDice.slice(0, diceCount);
        const total = dice.reduce((sum, value) => sum + value, 0);
        const startPosition = boardState.playerPositions[user.uid] || 0;
        const pathLength = BOARD_SQUARES.length;
        const path = Array.from({ length: total }, (_, step) => (startPosition + step + 1) % pathLength);
        let nextPosition = startPosition;
        const passedMessages: string[] = [];

        const movementEffects = buildMovementEffects(path, hasCarAsset(playerState), rollBoardDie);
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
            introDelayMs: BOARD_MOVE_INTRO_DELAY_MS + BOARD_DICE_ROLL_ANIMATION_MS,
            landingDelayMs: BOARD_MOVE_LANDING_DELAY_MS,
            isActive: true,
            effects: movementEffects
        };
        const settleDelayMs = getBoardMovementSettleMs(movement);

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
                const latestDiceCount = hasCarAsset(latestPlayerState)
                    ? (requestedDiceCount === 1 ? 1 : 2)
                    : 1;
                const latestDice = candidateDice.slice(0, latestDiceCount);
                const latestTotal = latestDice.reduce((sum, value) => sum + value, 0);
                const latestStart = latestBoard.playerPositions[user.uid] || 0;
                const latestPath = Array.from({ length: latestTotal }, (_, step) => (latestStart + step + 1) % BOARD_SQUARES.length);
                const latestMovementEffects = buildMovementEffects(latestPath, hasCarAsset(latestPlayerState), rollBoardDie);
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
                return {
                    boardState: {
                        ...latestBoard,
                        currentTurnUid: user.uid,
                        hasRolledThisTurn: true,
                        lastRoll: { uid: user.uid, dice: latestDice, total: latestTotal, timestamp: rollTimestamp, detail: latestPassedMessages.join('\n') },
                        currentCard: null,
                        currentCardReveal: null,
                        currentEvent: null,
                        movement: latestMovement,
                        updatedAt: rollTimestamp
                    },
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

        void (async () => {
            await wait(settleDelayMs);

            try {
                const latestSnap = await safeAsync(getDoc(doc(db, 'rooms', room.id)));
                if (!latestSnap?.exists()) return;

                const latestRoom = latestSnap.data() as Room;
                const latestMovement = latestRoom.boardState?.movement;
                if (
                    !latestMovement?.isActive ||
                    latestMovement.playerUid !== user.uid ||
                    latestMovement.startedAt !== rollTimestamp
                ) {
                    return;
                }

                const settleCommandId = `movement:${user.uid}:${rollTimestamp}:settle`;
                await runRoomBoardMutation({
                    db,
                    roomId: room.id,
                    commandId: settleCommandId,
                    playerStateUids: [user.uid],
                    onDuplicate: () => undefined,
                    mutate: (currentRoom, currentBoard) => {
                        const currentMovement = currentBoard.movement;
                        if (!currentMovement?.isActive || currentMovement.playerUid !== user.uid || currentMovement.startedAt !== rollTimestamp) {
                            throw new Error('棋盤移動已更新');
                        }
                        const resolution = buildBoardMovementLegResolution(currentRoom as Room, user.uid);
                        if (!resolution?.boardState) throw new Error('棋盤移動無法結算');
                        return {
                            boardState: resolution.boardState,
                            roomPatch: resolution.playerStates ? { playerStates: resolution.playerStates } : undefined,
                            result: undefined
                        };
                    }
                });
            } catch (err) {
                console.error('棋盤移動結算失敗:', err);
            }
        })();

        return rollResult;
    }) as Promise<{ position: number; detail: string; skipTurns: number; total: number; dice: number[] }>;

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

    const revealBoardCard = async (eventId: string, cardId: string): Promise<void> => {
        await executeBoardRevealWithRetry(async () => {
            if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
                throw new Error('棋盤房間尚未準備完成');
            }

            const commandId = `reveal:${eventId}:${cardId}`;
            await runRoomBoardMutation({
                db,
                roomId: room.id,
                commandId,
                onDuplicate: () => undefined,
                mutate: (latestRoom, latestBoard) => {
                    if (latestBoard.currentEvent?.id !== eventId || latestBoard.currentCard?.cardId !== cardId) {
                        throw new Error('棋盤卡片已更新');
                    }
                    const timestamp = Date.now();
                    return {
                        boardState: {
                            ...latestBoard,
                            currentCardReveal: { eventId, cardId, isRevealed: true, revealedAt: timestamp, revealedBy: user.uid },
                            cardLog: appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent),
                            updatedAt: timestamp
                        },
                        result: undefined
                    };
                }
            });
            return true;
        });
    };

    const advanceBoardEventQueue = async (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup') => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState) return;

        const { boardState } = room;
        if (expectedType && boardState.currentEvent?.type !== expectedType) return;

        // Event Completion Guard: Ensure no pending shared events
        if (hasIncompleteSharedPrompts(boardState)) {
            alert('還有玩家尚未完成共享事件回覆，請等待所有人完成後再推進事件。');
            return;
        }

        // 若這次推進事件後又接續了下一段分段移動動畫，記下來，交易成功後再排程
        // 等待動畫結束、觸發下一段的正式結算（比照 rollBoardDice 的做法）。
        let resumedMovement: { playerUid: string; startedAt: number; settleDelayMs: number } | null = null;
        const commandId = `advance:${boardState.currentEvent?.id || 'none'}:${expectedType || 'event'}`;

        await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [boardState.currentEvent?.playerUid || boardState.movement?.playerUid || user.uid],
            onDuplicate: () => undefined,
            mutate: (currentRoom, currentBoardState) => {
                if (expectedType && currentBoardState.currentEvent?.type !== expectedType) {
                    return { boardState: currentBoardState, result: undefined };
                }

                if (currentBoardState.currentEvent?.id !== boardState.currentEvent?.id) {
                    return { boardState: currentBoardState, result: undefined };
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
            if (!nextState) return;

            const nextMovement = nextState.boardState?.movement;
            if (nextMovement?.isActive) {
                resumedMovement = {
                    playerUid: nextMovement.playerUid,
                    startedAt: nextMovement.startedAt,
                    settleDelayMs: getBoardMovementSettleMs(nextMovement)
                };
            }

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
                    result: undefined
                };
            }
        }));

        if (resumedMovement) {
            const { playerUid, startedAt, settleDelayMs } = resumedMovement;
            void (async () => {
                await wait(settleDelayMs);
                try {
                    const latestSnap = await safeAsync(getDoc(doc(db, 'rooms', room.id)));
                    if (!latestSnap?.exists()) return;

                    const latestRoom = latestSnap.data() as Room;
                    const latestMovement = latestRoom.boardState?.movement;
                    if (
                        !latestMovement?.isActive ||
                        latestMovement.playerUid !== playerUid ||
                        latestMovement.startedAt !== startedAt
                    ) {
                        return;
                    }

                    const settleCommandId = `movement:${playerUid}:${startedAt}:settle`;
                    await runRoomBoardMutation({
                        db,
                        roomId: room.id,
                        commandId: settleCommandId,
                        playerStateUids: [playerUid],
                        onDuplicate: () => undefined,
                        mutate: (currentRoom, currentBoard) => {
                            const currentMovement = currentBoard.movement;
                            if (!currentMovement?.isActive || currentMovement.playerUid !== playerUid || currentMovement.startedAt !== startedAt) {
                                throw new Error('棋盤移動已更新');
                            }
                            const legResolution = buildBoardMovementLegResolution(currentRoom as Room, playerUid);
                            if (!legResolution?.boardState) throw new Error('棋盤移動無法結算');
                            return {
                                boardState: legResolution.boardState,
                                roomPatch: legResolution.playerStates ? { playerStates: legResolution.playerStates } : undefined,
                                result: undefined
                            };
                        }
                    });
                } catch (err) {
                    console.error('分段棋盤移動結算失敗:', err);
                }
            })();
        }
    });

    // 回合不再於事件結算後自動切換，玩家必須自己確認所有動作都完成後按下
    // 「結束回合」才會真正換到下一位，比照大富翁的回合節奏。
    const endTurn = async () => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return;

        const { boardState } = room;
        if (boardState.currentTurnUid !== user.uid) return;

        if (boardState.movement) {
            alert('移動尚未完成，無法結束回合。');
            return;
        }

        if (!boardState.hasRolledThisTurn) {
            alert('請先擲骰後才能結束回合。');
            return;
        }

        if (boardState.currentEvent || (boardState.pendingEvents && boardState.pendingEvents.length > 0)) {
            alert('請先完成目前的棋盤事件，才能結束回合。');
            return;
        }

        if (hasIncompleteSharedPrompts(boardState)) {
            alert('還有玩家尚未完成共享事件回覆，請等待所有人完成後再結束回合。');
            return;
        }
        const commandId = `turn-end:${user.uid}:${boardState.revision || 0}`;

        await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            onDuplicate: () => undefined,
            mutate: (currentRoom, currentBoardState) => {
                // Transaction 內重新檢查，避免競態下重複結束回合或跳過尚未完成的事件。
                if (currentBoardState.currentTurnUid !== user.uid) return { boardState: currentBoardState, result: undefined };
                if (currentBoardState.movement) return { boardState: currentBoardState, result: undefined };
                if (!currentBoardState.hasRolledThisTurn) return { boardState: currentBoardState, result: undefined };
                if (currentBoardState.currentEvent || (currentBoardState.pendingEvents && currentBoardState.pendingEvents.length > 0)) {
                    return { boardState: currentBoardState, result: undefined };
                }
                if (hasIncompleteSharedPrompts(currentBoardState)) return { boardState: currentBoardState, result: undefined };

            const nextTurn = getNextBoardTurn(currentBoardState);
            const nextTurnUid = nextTurn?.nextUid || user.uid;
            const timestamp = Date.now();

            const nextBoard = applyBoardCommand({
                ...currentBoardState,
                currentTurnUid: nextTurnUid,
                hasRolledThisTurn: false,
                skipTurns: nextTurn?.skipTurns || currentBoardState.skipTurns,
                skippedTurnNotice: nextTurn?.skippedUids.length ? {
                    playerUids: nextTurn.skippedUids,
                    nextTurnUid,
                    timestamp
                } : null,
                updatedAt: timestamp
            }, commandId).boardState;
                return {
                    boardState: nextBoard,
                    result: undefined
                };
            }
        }));
    });

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
                if (!isStillCurrentCard) return { boardState: currentBoardState, result: true };

                if (hasIncompleteSharedPrompts(currentBoardState)) {
                    return { boardState: currentBoardState, result: false };
                }
                const nextState = buildBoardEventAdvanceState({ ...currentRoom, boardState: currentBoardState } as Room);
                if (!nextState) return { boardState: currentBoardState, result: false };

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
                if (!drawResult) return { boardState: currentBoardState, result: undefined };

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
                if (!drawResult) return { boardState: currentBoardState, result: undefined };

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
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                if (latestBoard.currentEvent?.id !== eventId || latestBoard.currentCard?.cardId !== cardId || latestBoard.currentEvent?.playerUid !== user.uid) {
                    throw new Error('家庭共享事件已更新');
                }
                const targetPlayerUids = (latestRoom.members || [])
                    .filter(member => member.uid !== latestRoom.hostId && member.uid !== user.uid && !member.isLeft)
                    .map(member => member.uid);
                if (targetPlayerUids.length === 0) {
                    return { boardState: latestBoard, result: false };
                }
                const latestSourceState = latestRoom.playerStates?.[user.uid];
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
                        return { boardState: latestBoard, result: 'no_target' as const };
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
        if (prompt.responses?.[user.uid]) return true;

        const result = await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: `prompt:family:response:${payload.promptId}:${user.uid}`,
            playerStateUids: [user.uid],
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const latestPrompt = latestBoard.familyMilestoneJoinPrompt;
                if (!latestPrompt || latestPrompt.id !== payload.promptId || latestPrompt.responses?.[user.uid]) {
                    return { boardState: latestBoard, result: undefined };
                }

                const latestPlayerState = latestRoom.playerStates?.[user.uid];
                if (payload.status === 'passed' && !latestPlayerState) {
                    throw new Error('玩家資料尚未同步完成，請稍後再擲一次');
                }
                const familyStatus = latestPlayerState ? getFamilyMilestoneStatus(latestPlayerState) : null;
                const participantStage = familyStatus && familyStatus.currentStageIndex >= 0
                    ? familyStatus.stages[familyStatus.currentStageIndex]
                    : null;
                const response = cleanObject({
                    playerUid: user.uid,
                    playerName: user.name || '玩家',
                    status: payload.status,
                    actionCompleted: payload.status !== 'passed' || !participantStage,
                    stageProgressId: participantStage?.progressId,
                    roll: payload.roll,
                    respondedAt: Date.now()
                });

                const nextPrompt = {
                    ...latestPrompt,
                    responses: { ...(latestPrompt.responses || {}), [user.uid]: response }
                };
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

                const completedTransition = buildCompletedFamilyTransition(latestRoom as Room, latestBoard, nextPrompt);
                if (completedTransition) {
                    return {
                        boardState: completedTransition.boardState,
                        roomPatch: completedTransition.roomPatch,
                        result: { completed: true }
                    };
                }

                return {
                    boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: Date.now() },
                    roomPatch: nextState ? { playerStates: { [user.uid]: nextState } } : undefined,
                    result: { completed: !hasIncompleteSharedPrompts({ ...latestBoard, familyMilestoneJoinPrompt: nextPrompt }) }
                };
            }
        }), null, err => {
            setError(err?.message || '家庭重要歷程回覆失敗');
        });
        return result !== null;
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
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const prompt = latestBoard.familyMilestoneJoinPrompt;
                if (!prompt || prompt.id !== promptId || prompt.sourcePlayerUid !== user.uid) {
                    return { boardState: latestBoard, result: false };
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

    const completeFamilyMilestoneAction = async (payload: { promptId: string; accepted: boolean }) => {
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
                        return { boardState: latestBoard, result: failedResult('家庭歷程事件已更新或已完成，請重新整理確認目前狀態') };
                    }

                    const isSource = prompt.sourcePlayerUid === user.uid;
                    const response = prompt.responses?.[user.uid];
                    if (!isSource && (!prompt.targetPlayerUids.includes(user.uid) || response?.status !== 'passed')) {
                        return { boardState: latestBoard, result: failedResult('目前尚未取得參與資格，請先完成擲骰或等待最新同步') };
                    }

                    const progressId = isSource ? prompt.sourceStageProgressId : response?.stageProgressId;
                    const stage = getFamilyMilestoneStageByProgressId(progressId);
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (payload.accepted && (!stage || !currentState)) {
                        return { boardState: latestBoard, result: failedResult('玩家資料尚未完成同步，請重新整理後重試') };
                    }

                    let nextState = currentState;
                    let status: 'applied' | 'duplicate' = payload.accepted ? 'applied' : 'duplicate';
                    if (payload.accepted && stage && currentState) {
                        const operationId = `family:${prompt.id}:${user.uid}:${stage.progressId}`;
                        const applied = applyFamilyMilestoneStage(currentState, stage, operationId);
                        if (applied.status === 'insufficient') {
                            throw new Error(`FAMILY_INSUFFICIENT:${applied.shortfall}`);
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

                    // 來源玩家的「完成自己的動作」與「清除整個共享事件」是
                    // Firestore 規則中的兩種不同權限。先提交財務與來源完成狀態，
                    // 再由下方獨立的冪等 command 結案，避免最後一位完成者被規則拒絕。
                    if (isSource && completedTransition) {
                        return {
                            boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: Date.now() },
                            roomPatch,
                            result: { status, finalizeSource: true }
                        };
                    }

                    if (completedTransition) {
                        return {
                            boardState: completedTransition.boardState,
                            roomPatch: {
                                ...(completedTransition.roomPatch || {}),
                                ...(roomPatch || {})
                            },
                            result: { status }
                        };
                    }

                    return {
                        boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: Date.now() },
                        roomPatch,
                        result: { status }
                    };
                }
            });

            if (!result.finalizeSource) return result;

            const finalized = await runRoomBoardMutation<{
                status: 'applied' | 'duplicate' | 'failed';
                message?: string;
            }, Room>({
                db,
                roomId: room.id,
                commandId: `family-complete:${payload.promptId}:${user.uid}`,
                playerStateUids: [user.uid],
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

        const result = await safeAsync(runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId: `prompt:shared:response:${payload.promptId}:${user.uid}`,
            playerStateUids: [],
            onDuplicate: latestRoom => ({
                completed: !latestRoom.boardState?.sharedCardPrompt || !hasIncompleteSharedPrompts(latestRoom.boardState)
            }),
            mutate: (latestRoom, latestBoard) => {
                const latestPrompt = latestBoard.sharedCardPrompt;
                if (!latestPrompt || latestPrompt.id !== payload.promptId) {
                    return { boardState: latestBoard, result: { completed: true } };
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
                    result: { completed: true }
                };
            }
        }), null, err => {
            setError(err?.message || '共享卡片回覆失敗');
        });

        if (result === null) return false;

        if (result.completed) return true;

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

    const completeStartupLoanAction = async (promptId: string): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !room.isBoardGame || !user) return false;

        const commandId = `startup-loan:${promptId}:${user.uid}`;
        const result = await safeAsync(runRoomBoardMutation<boolean, Room>({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
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
        const result = await safeAsync(runTransaction(db, async transaction => {
            const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
            const playerSnapshot = await transaction.get(playerRef);
            if (!playerSnapshot.exists()) throw new Error('玩家資料尚未同步完成');
            // 只更新待升級欄位，避免把剛完成的企業貸款或其他財務結果
            // 以舊快照整份覆蓋回去。
            transaction.update(playerRef, {
                pendingStartupUpgradeAction: cleanObject(payload)
            });
            return true;
        }), null, err => {
            setError(err?.message || '建立企業升級等待狀態失敗');
        });
        return result === true;
    };

    const clearPendingStartupUpgradeAction = async (): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !user) return false;

        const result = await safeAsync(runTransaction(db, async transaction => {
            const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
            const playerSnapshot = await transaction.get(playerRef);
            if (!playerSnapshot.exists()) return false;
            transaction.update(playerRef, {
                pendingStartupUpgradeAction: deleteField(),
                pendingStartupUpgradeActions: deleteField()
            });
            return true;
        }), false, err => {
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
            nextState = await runTransaction(db, async transaction => {
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
            });
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
            nextState = await runTransaction(db, async transaction => {
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
            });
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
            nextState = await runTransaction(db, async transaction => {
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
            });
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
            nextState = await runTransaction(db, async transaction => {
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
            });
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

    const updatePlayerDiagnostic = async (diagnostic: Omit<PlayerDiagnosticState, 'uid' | 'updatedAt'>) => {
        if (!room?.id || !user?.uid || user.uid === room.hostId || user.role === 'coach' || user.role === 'gm') return;
        if (!isController) return;
        const diagnosticRef = realtimeRef(realtimeDb, `roomDiagnostics/${room.id}/${user.uid}/${realtimeClientIdRef.current}`);
        await setRealtime(diagnosticRef, {
            ...cleanObject(diagnostic),
            uid: user.uid,
            updatedAt: realtimeServerTimestamp()
        });
    };

    const updateFinancialAcceleration = async (multiplier: FinancialAccelerationMultiplier) => {
        if (!canMutateCurrentRoom()) return;
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整全局財務加速器');
        }

        const roomRef = doc(db, 'rooms', room.id);
        let nextAcceleration: FinancialAccelerationState;
        try {
            nextAcceleration = await runTransaction(db, async transaction => {
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
            });
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
            result = await runTransaction(db, async transaction => {
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
            });
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
        if (!canMutateCurrentRoom()) return;
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await updateDoc(roomRef, cleanObject({
                gameTimeLeft: timeLeft,
                isTimerPaused: isPaused,
                timerEndsAtMs: isPaused ? null : timerEndsAtMs
            }));
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

    // 所有事件結案只要恢復了 movement，就由移動玩家依遠端狀態安排同一個
    // 冪等結算；不再依賴是哪一個 UI 函式完成卡片。
    useEffect(() => {
        const movement = room?.boardState?.movement;
        if (!room?.id || !movement?.isActive || movement.playerUid !== user?.uid) return;

        const delay = Math.max(0, movement.startedAt + getBoardMovementSettleMs(movement) - Date.now());
        const timeoutId = window.setTimeout(() => {
            const commandId = `movement:${movement.playerUid}:${movement.startedAt}:settle`;
            void runRoomBoardMutation({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [movement.playerUid],
                onDuplicate: () => undefined,
                mutate: (latestRoom, latestBoard) => {
                    const latestMovement = latestBoard.movement;
                    if (!latestMovement?.isActive || latestMovement.playerUid !== movement.playerUid || latestMovement.startedAt !== movement.startedAt) {
                        return { boardState: latestBoard, result: undefined };
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
    }, [room?.boardState?.movement?.isActive, room?.boardState?.movement?.startedAt, room?.id, user?.uid]);

    const submitRequest = async (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room) return false;
        try {
            // 每位玩家同時只保留一筆待審核請求，讓 Firestore Rules 可以
            // 嚴格限制玩家只能建立／清除自己的請求。
            const requestId = request.uid;
            const newRequest: PendingRequest = {
                ...request,
                id: requestId,
                status: 'pending',
                timestamp: Date.now()
            };
            const roomRef = doc(db, 'rooms', room.id);
            const result = await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}`]: newRequest
            }));
            return result !== null;
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

        await safeAsync(runTransaction(db, async transaction => {
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
        }));
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
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                const prompt = latestBoard.sharedCardPrompt;
                if (!prompt || prompt.id !== promptId || !prompt.targetPlayerUids.includes(playerUid) || prompt.responses?.[playerUid]) {
                    return { boardState: latestBoard, result: undefined };
                }
                if (!canSkipDisconnectedPlayer(latestRealtimePresence || presenceStates[playerUid])) {
                    throw new Error('玩家尚未離線超過 120 秒');
                }
                const nextPrompt: SharedCardPrompt = {
                    ...prompt,
                    responses: {
                        ...(prompt.responses || {}),
                        [playerUid]: {
                            playerUid,
                            playerName: room.members.find(member => member.uid === playerUid)?.name || '失聯玩家',
                            status: 'declined',
                            note: '主持人依離線門檻排除',
                            respondedAt: Date.now()
                        }
                    }
                };
                if (hasIncompleteSharedPrompts({ ...latestBoard, sharedCardPrompt: nextPrompt })) {
                    return { boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: Date.now() }, result: undefined };
                }
                const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
                const advanced = buildBoardEventAdvanceState({
                    ...latestRoom,
                    boardState: { ...latestBoard, sharedCardPrompt: undefined, cardLog: currentCardLog }
                } as Room);
                if (!advanced?.boardState) throw new Error('共享事件無法結案');
                return { boardState: { ...advanced.boardState, cardLog: currentCardLog, updatedAt: Date.now() }, result: undefined };
            }
        });
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
            playerDiagnostics,
            createRoom,
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
            updatePlayerDiagnostic,
            updateFinancialAcceleration,
            grantFinancialSubsidyToAllPlayers,
            updateRoomTimer,
            submitRequest,
            approveRequest,
            rejectRequest,
            clearRequest,
            rollBoardDice,
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
            completeStartupLoanAction,
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
