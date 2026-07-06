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
    serverTimestamp,
    arrayUnion,
    deleteField,
    runTransaction
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { BoardCardLogEntry, BoardCardResult, BoardDeckState, BoardEventLog, BoardQueuedEvent, BoardState, FamilyMilestoneJoinPrompt, GameState, SharedCardPrompt } from '../types';
import { cleanObject, safeAsync } from '../utils/utils';
import { STOCK_SYMBOLS } from '../constants';
import { BOARD_SQUARES, createInitialDeckState, getSquareByIndex } from '../constants/board';
import {
    buildHappinessCardMetaFromSchema,
    buildNewsCardMetaFromSchema,
    buildOpportunityCardMetaFromSchema,
    HAPPINESS_CARDS,
    NEWS_CARDS,
    OPPORTUNITY_CARDS
} from '../constants/cards';
import { getFamilyMilestoneStageByCardId, getFamilyMilestoneStatus } from '../utils/familyMilestones';
import { resolveBoardCardAction, hasIncompleteSharedPrompts } from '../utils/boardCardActions';

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
}

export interface PendingRequest {
    id: string;
    uid: string;
    playerName: string;
    type: 'payday' | 'insurance' | 'happiness' | 'promotion' | 'lifelong' | 'board_share';
    amount: number;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    insuranceType?: 'medical' | 'aircraft';
    happinessLabel?: string;
    promotionType?: string;
    boardCardId?: string;
    shareLabel?: string;
}

export interface Room {
    id: string; // 房間碼 (6位數)
    name?: string; // 房間標題
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    members: RoomMember[];
    createdAt: any;
    maxPlayers: number;
    duration?: number; // 遊戲時長 (分鐘)
    gameTimeLeft?: number; // 剩餘秒數
    isTimerPaused?: boolean; // 計時器是否暫停
    playerStates?: Record<string, GameState>; // 直接存放在房間文件內，確保執行師有權限讀取
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
}

const buildHappinessCardMeta = (cardId: string, playerState?: GameState | null) => {
    return buildHappinessCardMetaFromSchema(cardId, playerState);
};

const buildOpportunityCardMeta = (cardId: string) => {
    return buildOpportunityCardMetaFromSchema(cardId);
};

const buildNewsCardMeta = (cardId: string) => {
    return buildNewsCardMetaFromSchema(cardId);
};

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

export const withPendingStartupUpgradeAction = (
    playerState: GameState,
    payload: { cardId: string; symbol: string }
) => cleanObject({
    ...playerState,
    pendingStartupUpgradeAction: {
        cardId: payload.cardId,
        symbol: payload.symbol
    }
}) as GameState;

export const withoutPendingStartupUpgradeAction = (playerState: GameState) => cleanObject({
    ...playerState,
    pendingStartupUpgradeAction: undefined
}) as GameState;

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

const BOARD_MOVE_INTRO_DELAY_MS = 600;
const BOARD_MOVE_STEP_DURATION_MS = 380;
const BOARD_MOVE_LANDING_DELAY_MS = 600;
const BOARD_DICE_ROLL_ANIMATION_MS = 3500;
const BOARD_MOVE_STALE_BUFFER_MS = 2000;
const BOARD_CARD_LOG_LIMIT = 40;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getBoardMovementSettleMs = (movement: {
    path: unknown[];
    stepDurationMs: number;
    introDelayMs: number;
    landingDelayMs: number;
}) => Math.max(
    BOARD_DICE_ROLL_ANIMATION_MS,
    movement.introDelayMs + movement.path.length * movement.stepDurationMs + movement.landingDelayMs
);

const createInitialBoardState = (members: RoomMember[], playerStates?: Record<string, GameState>): BoardState => {
    const playerMembers = members.filter(member => member.role !== 'coach');
    const turnOrder = playerMembers.map(member => member.uid);
    const positions = Object.fromEntries(turnOrder.map(uid => [uid, 0]));
    const skipTurns = Object.fromEntries(turnOrder.map(uid => [uid, playerStates?.[uid]?.skipTurns || 0]));

    return {
        currentTurnUid: turnOrder[0] || null,
        turnOrder,
        playerPositions: positions,
        skipTurns,
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

const activateBoardQueueEntry = (entry?: BoardQueuedEvent | null) => ({
    currentEvent: entry?.event || null,
    currentCard: entry?.card || null,
    currentCardReveal: entry?.card ? {
        eventId: entry.event.id,
        cardId: entry.card.cardId,
        isRevealed: false
    } : null
});

const buildBoardEventAdvanceState = (roomData: Room) => {
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
                familyMilestoneJoinPrompt: null,
                sharedCardPrompt: null,
                pendingEvents: queue,
                updatedAt: Date.now()
            }
        });
    }

    const nextTurn = getNextTurnUid(boardState);
    const nextTurnUid = nextTurn?.nextUid || boardState.currentTurnUid;
    const nextPlayerStates = { ...(roomData.playerStates || {}) };
    const nextTurnPlayerState = nextTurnUid ? nextPlayerStates[nextTurnUid] : null;

    if (
        nextTurnUid &&
        boardState.currentTurnUid &&
        nextTurnUid !== boardState.currentTurnUid &&
        nextTurnPlayerState?.bankServiceWindowActive
    ) {
        nextPlayerStates[nextTurnUid] = cleanObject({
            ...nextTurnPlayerState,
            bankServiceWindowActive: false,
            bankServiceGrantedAtEventId: undefined
        }) as GameState;
    }

    return cleanObject({
        boardState: {
            ...boardState,
            ...activateBoardQueueEntry(null),
            familyMilestoneJoinPrompt: null,
            sharedCardPrompt: null,
            pendingEvents: [],
            currentTurnUid: nextTurnUid || null,
            skipTurns: nextTurn?.skipTurns || boardState.skipTurns,
            updatedAt: Date.now()
        },
        ...(Object.keys(nextPlayerStates).length > 0 ? { playerStates: nextPlayerStates } : {})
    });
};

const appendBoardCardLog = (
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

    return [nextEntry, ...(boardState.cardLog || [])].slice(0, BOARD_CARD_LOG_LIMIT);
};

const getNextTurnUid = (boardState: BoardState) => {
    if (!boardState.turnOrder.length) return null;
    if (!boardState.currentTurnUid) return boardState.turnOrder[0];

    let index = boardState.turnOrder.indexOf(boardState.currentTurnUid);
    const skipTurns = { ...boardState.skipTurns };

    for (let offset = 1; offset <= boardState.turnOrder.length; offset += 1) {
        const nextUid = boardState.turnOrder[(index + offset) % boardState.turnOrder.length];
        const remainingSkips = skipTurns[nextUid] || 0;
        if (remainingSkips > 0) {
            skipTurns[nextUid] = remainingSkips - 1;
            index = boardState.turnOrder.indexOf(nextUid);
            continue;
        }
        return { nextUid, skipTurns };
    }

    return { nextUid: boardState.currentTurnUid, skipTurns };
};

const buildBoardMovementResolution = (roomData: Room, playerUid: string) => {
    const boardState = roomData.boardState;
    const movement = boardState?.movement;
    if (!boardState || !movement || movement.playerUid !== playerUid) return null;

    const playerState = roomData.playerStates?.[playerUid];
    const nextPosition = movement.path[movement.path.length - 1] ?? movement.startPosition;
    const detailMessages: string[] = [];
    const nextSkipTurns = { ...boardState.skipTurns };
    let passedBankThisTurn = false;
    let passedSchoolThisTurn = false;
    const routeEvents: Array<{ type: 'bank' | 'school' | 'repair'; squareIndex: number; repairRoll?: number; repairFee?: number }> = [];
    const queuedRouteTypes = new Set<'bank' | 'school' | 'repair'>();
    const playerName = roomData.members.find(member => member.uid === playerUid)?.name || '玩家';
    const eventTimestamp = Date.now();

    for (let step = 0; step < movement.path.length; step += 1) {
        const square = getSquareByIndex(movement.path[step]);
        const isLandingStep = step === movement.path.length - 1;

        if (square.type === 'bank') {
            passedBankThisTurn = true;
            if (!queuedRouteTypes.has('bank') && !isLandingStep) {
                queuedRouteTypes.add('bank');
                routeEvents.push({ type: 'bank', squareIndex: movement.path[step] });
            }
            detailMessages.push(`經過${square.label}，請完成月結餘確認`);
        }
        if (square.type === 'school') {
            passedSchoolThisTurn = true;
            if (!queuedRouteTypes.has('school') && !isLandingStep) {
                queuedRouteTypes.add('school');
                routeEvents.push({ type: 'school', squareIndex: movement.path[step] });
            }
            detailMessages.push(`經過${square.label}，可前往升等考試`);
        }
        if (square.type === 'repair' && !isLandingStep && hasCarAsset(playerState)) {
            // 依 docs/gdd/REPAIR_SYSTEM.md：經過維修廠與停留維修廠都必須先擲一次正式事件骰點，
            // 保養費必須走正式財務檢核，不得只顯示文字讓玩家自行登錄。
            const feeRoll = Math.floor(Math.random() * 6) + 1;
            const repairFee = feeRoll * 2000;
            if (!queuedRouteTypes.has('repair')) {
                queuedRouteTypes.add('repair');
                routeEvents.push({ type: 'repair', squareIndex: movement.path[step], repairRoll: feeRoll, repairFee });
            }
            detailMessages.push(`經過維修廠，汽車保養費 ${repairFee}，請完成財務檢核`);
        }
    }

    const landedSquare = getSquareByIndex(nextPosition);
    let deckState = boardState.deckState;
    const queuedEvents: BoardQueuedEvent[] = [];

    routeEvents.forEach((routeEvent, routeIndex) => {
        const isBank = routeEvent.type === 'bank';
        const isRepair = routeEvent.type === 'repair';
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_${routeEvent.type}`,
                playerUid,
                playerName,
                type: routeEvent.type,
                summary: isRepair ? `${playerName} 經過維修廠` : `${playerName} 經過${isBank ? '銀行' : '學校'}`,
                detail: isRepair
                    ? '經過維修廠，保養費 = 點數 x 2000，不停回合'
                    : (isBank
                        ? '先領取月結餘，再決定是否購買保險或定存'
                        : '請完成升等考試'),
                squareIndex: routeEvent.squareIndex,
                timestamp: eventTimestamp + routeIndex,
                rollTotal: movement.rollTotal,
                ...(isRepair ? {
                    repairRoll: routeEvent.repairRoll,
                    repairFee: routeEvent.repairFee,
                    repairHasCar: true
                } : {})
            }
        });
    });

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
                    timestamp: eventTimestamp + routeEvents.length,
                    rollTotal: movement.rollTotal
                },
                card: drawResult.card
            });
        }
    } else if (landedSquare.type === 'hospital') {
        nextSkipTurns[playerUid] = Math.max(nextSkipTurns[playerUid] || 0, landedSquare.pauseTurns || 1);
        detailMessages.push('抵達醫院，請再擲一次骰子決定醫藥費，並暫停一回合');
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_hospital`,
                playerUid,
                playerName,
                type: 'hospital',
                summary: `${playerName} 抵達醫院`,
                detail: '棋子到達後再擲一次骰子，醫藥費 = 點數 x 1000',
                squareIndex: nextPosition,
                timestamp: eventTimestamp + routeEvents.length,
                rollTotal: movement.rollTotal
            }
        });
    } else if (landedSquare.type === 'repair') {
        const repairRoll = Math.floor(Math.random() * 6) + 1;
        const hasCar = hasCarAsset(playerState);
        const repairFee = repairRoll * 2000;
        if (hasCarAsset(playerState)) {
            detailMessages.push(`踩到維修廠，保養費 ${repairFee}，並暫停一回合`);
            nextSkipTurns[playerUid] = Math.max(nextSkipTurns[playerUid] || 0, landedSquare.pauseTurns || 1);
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
                timestamp: eventTimestamp + routeEvents.length,
                rollTotal: movement.rollTotal,
                repairRoll,
                repairFee: hasCar ? repairFee : 0,
                repairHasCar: hasCar
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
                timestamp: eventTimestamp + routeEvents.length,
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
                timestamp: eventTimestamp + routeEvents.length,
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

    const nextPlayerStates = { ...(roomData.playerStates || {}) };
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

    const hasQueuedBoardEvents = !!currentQueueEntry;
    const nextTurn = hasQueuedBoardEvents
        ? null
        : getNextTurnUid({
            ...boardState,
            currentTurnUid: playerUid,
            skipTurns: nextSkipTurns
        });
    const nextTurnUid = nextTurn?.nextUid || playerUid;
    const nextTurnPlayerState = nextTurnUid ? nextPlayerStates[nextTurnUid] : null;

    if (!hasQueuedBoardEvents && nextTurnUid !== playerUid && nextTurnPlayerState?.bankServiceWindowActive) {
        nextPlayerStates[nextTurnUid] = cleanObject({
            ...nextTurnPlayerState,
            bankServiceWindowActive: false,
            bankServiceGrantedAtEventId: undefined
        }) as GameState;
    }

    return cleanObject({
        boardState: {
            ...boardState,
            playerPositions: {
                ...boardState.playerPositions,
                [playerUid]: nextPosition
            },
            skipTurns: hasQueuedBoardEvents ? nextSkipTurns : (nextTurn?.skipTurns || nextSkipTurns),
            currentTurnUid: nextTurn?.nextUid || playerUid,
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
    createRoom: (settings?: { name: string; maxPlayers: number; duration: number; isPractice?: boolean; isBoardGame?: boolean }) => Promise<string>;
    joinRoom: (roomCode: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    startRoomGame: () => Promise<void>;
    finishRoomGame: () => Promise<void>;
    closeRoom: () => Promise<void>;
    updateMarket: (updates: Record<string, number>, code: string, isBubble?: boolean) => Promise<void>;
    updateRoomTimer: (timeLeft: number, isPaused: boolean) => Promise<void>;
    submitRequest: (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>) => Promise<void>;
    approveRequest: (requestId: string) => Promise<void>;
    rejectRequest: (requestId: string) => Promise<void>;
    clearRequest: (requestId: string) => Promise<void>;
    rollBoardDice: (diceCount?: 1 | 2) => Promise<{ position: number; detail: string; skipTurns: number; total: number }>;
    revealBoardCard: (eventId: string, cardId: string) => Promise<void>;
    dismissBoardCard: (eventId: string, cardId: string) => Promise<void>;
    advanceBoardEventQueue: (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup') => Promise<void>;
    drawPostExamHappinessCard: (success: boolean) => Promise<void>;
    drawBoardFollowupCard: (deck: 'happiness' | 'news', summary: string, detail?: string) => Promise<void>;
    openFamilyMilestoneJoinPrompt: (eventId: string, cardId: string) => Promise<void>;
    openSharedCardPrompt: (eventId: string, cardId: string) => Promise<boolean>;
    submitFamilyMilestoneJoinResponse: (payload: {
        promptId: string;
        status: 'passed' | 'failed' | 'declined';
        roll?: number;
        cardId: string;
    }) => Promise<void>;
    clearPendingFamilyMilestoneJoinAction: (promptId: string) => Promise<void>;
    submitSharedCardPromptResponse: (payload: {
        promptId: string;
        status: 'completed' | 'declined' | 'no_effect';
        amount?: number;
        selectedAssetIds?: string[];
        note?: string;
    }) => Promise<boolean>;
    clearSharedCardPrompt: (promptId: string) => Promise<void>;
    setPendingStartupUpgradeAction: (payload: { cardId: string; symbol: string }) => Promise<boolean>;
    clearPendingStartupUpgradeAction: () => Promise<void>;
    applyBoardExpenseToAllPlayers: (payload: {
        amount: number;
        category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
        isIncrease: boolean;
        summary: string;
        detail?: string;
    }) => Promise<void>;
    moveCurrentPlayerToSquare: (payload: {
        squareType: 'school' | 'hospital' | 'bank';
        skipTurns?: number;
        detail?: string;
    }) => Promise<number | null>;
    applyBoardMarketPrices: (updates: Record<string, number>, code: string, isBubble?: boolean) => Promise<void>;
    abandonRealEstateCard: (cardId: string) => Promise<void>;
    buyRealEstateFromMarket: (cardId: string) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [room, setRoom] = useState<Room | null>(null);
    const [isLoadingRoom, setIsLoadingRoom] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerStates, setPlayerStates] = useState<Record<string, GameState>>({});

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
    const executeWithLock = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
        if (isProcessingRef.current) return undefined;
        isProcessingRef.current = true;
        try {
            return await action();
        } finally {
            isProcessingRef.current = false;
        }
    };

    // 監聽房間狀態
    useEffect(() => {
        if (!user) return;

        // 優先從目前 room 狀態拿 ID，若無則從 localStorage 拿
        const targetRoomId = room?.id || localStorage.getItem(`active_room_${user.uid}`);

        if (!targetRoomId) {
            // 如果連 localStorage 都沒 ID，確保 room 狀態也是 null
            if (room) setRoom(null);
            return;
        }

        console.log('開始監聽房間:', targetRoomId);
        const unsubscribe = onSnapshot(doc(db, 'rooms', targetRoomId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Room;
                console.log('房間數據更新:', data.id, '狀態:', data.status, '成員數:', data.members?.length);

                const movement = data.boardState?.movement;
                if (
                    movement?.isActive &&
                    (data.hostId === user.uid || movement.playerUid === user.uid)
                ) {
                    const movementDeadline = movement.startedAt + getBoardMovementSettleMs(movement);

                    if (Date.now() > movementDeadline + BOARD_MOVE_STALE_BUFFER_MS) {
                        const staleResolution = buildBoardMovementResolution(data, movement.playerUid);
                        if (staleResolution) {
                            console.warn('偵測到過期的棋盤移動狀態，自動補完收尾:', data.id, movement.playerUid);
                            safeAsync(updateDoc(doc(db, 'rooms', targetRoomId), staleResolution)).catch(err => {
                                console.error('自動補完棋盤移動失敗:', err);
                            });
                        }
                    }
                }

                // 檢查自己是否還在成員名單中
                const isHost = data.hostId === user.uid;
                const stillMember = data.members?.some(m => m.uid === user.uid);

                if (!stillMember && !isHost) {
                    console.log('檢測到用戶已不在成員名單中，自動清除狀態');
                    setRoom(null);
                    localStorage.removeItem(`active_room_${user.uid}`);
                    return;
                }

                if (data.pendingRequests) {
                    console.log('偵測到待審核請求:', Object.keys(data.pendingRequests).length, '筆');
                }
                setRoom(data);

                // 更新 playerStates (不論是否為房主，只要 data 內有就更新)
                if (data.playerStates) {
                    setPlayerStates(data.playerStates);
                }

                // 儲存目前房間 ID 到 localStorage
                localStorage.setItem(`active_room_${user.uid}`, data.id);
            } else {
                console.log('房間不存在或已被關閉');
                setRoom(null);
                localStorage.removeItem(`active_room_${user.uid}`);
            }
        }, (err) => {
            console.error('監聽房間失敗:', err);
            if (err.code === 'permission-denied') {
                setError('權限不足，請檢查 Firebase Firestore Rules 設定');
            }
            if (err.code === 'not-found') {
                localStorage.removeItem(`active_room_${user.uid}`);
            }
        });

        return () => {
            console.log('停止監聽房間:', targetRoomId);
            unsubscribe();
        };
    }, [user?.uid, room?.id]); // 監聽 room.id 變化，確保切換房間時能重新綁定監聽器

    // 移除舊的獨立監聽器，改為統一由房間狀態驅動

    // 生成 6 位數房間碼
    const generateRoomCode = useCallback(async (): Promise<string> => {
        let code = '';
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            attempts++;
            code = Math.floor(100000 + Math.random() * 900000).toString();
            const roomDoc = await safeAsync(getDoc(doc(db, 'rooms', code)));
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
                createdAt: serverTimestamp(),
                maxPlayers: settings?.maxPlayers || 6,
                duration: settings?.duration || 60,
                gameTimeLeft: (settings?.duration || 60) * 60,
                isTimerPaused: true,
                sessionId: `${roomCode}_${Date.now()}`,
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
                }]) : null,
                ...(settings?.isBoardGame ? { isBoardGame: true } : {}),
                ...(settings?.isPractice ? { isPractice: true } : {})
            };
            const cleanedRoom = cleanObject(newRoom);
            await safeAsync(setDoc(doc(db, 'rooms', roomCode), cleanedRoom));
            setRoom(cleanedRoom);
            return roomCode;
        } catch (err: any) {
            console.error('建立房間失敗:', err);
            const errMsg = err.code === 'permission-denied'
                ? '權限不足，請檢查 Firebase Firestore Rules 設定'
                : (err.message || '建立房間時發生錯誤');
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setIsLoadingRoom(false);
        }
    }, [user, generateRoomCode]);

    const joinRoom = async (roomCode: string) => {
        if (!user) throw new Error('請先登入');
        setIsLoadingRoom(true);
        setError(null);
        try {
            const roomRef = doc(db, 'rooms', roomCode);
            const roomDoc = await safeAsync(getDoc(roomRef));

            if (!roomDoc || !roomDoc.exists()) throw new Error('找不到此房間');

            const roomData = roomDoc.data() as Room;

            // 檢查是否已在房間內或已有存檔（支援斷線重連，不論房間狀態）
            const existingMember = roomData.members.find(m => m.uid === user.uid);
            const hasCloudState = roomData.playerStates && roomData.playerStates[user.uid];
            
            if (existingMember || hasCloudState) {
                // 如果已經在 members 裡面，直接進入
                if (existingMember) {
                    setRoom(roomData);
                    localStorage.setItem(`active_room_${user.uid}`, roomCode);
                    return;
                }
                
                // 如果不在 members 但有 playerStates，表示是中途離開又回來的玩家，允許重新加入
                console.log('偵測到雲端存檔，允許中途重新加入房間');
            } else if (roomData.status !== 'waiting') {
                throw new Error('遊戲已開始或已結束');
            }

            // 檢查人數限制 (排除教練)
            const playerMembers = roomData.members.filter(m => m.role === 'player');
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

            await safeAsync(updateDoc(roomRef, {
                members: arrayUnion(cleanedMember)
            }));

            // 存入 localStorage 並手動更新 room ID 觸發監聽器
            localStorage.setItem(`active_room_${user.uid}`, roomCode);
            setRoom(prev => (prev?.id === roomCode ? prev : { id: roomCode, members: [], hostId: '', status: 'waiting', name: '' } as any));
        } catch (err: any) {
            setError(err.message);
            throw err;
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
            setRoom(null);
            localStorage.removeItem(`active_room_${user.uid}`);

            if (memberToRemove) {
                await safeAsync(updateDoc(roomRef, {
                    members: arrayRemove(memberToRemove)
                }));
            }
        } catch (err: any) {
            console.error('離開房間失敗:', err);
        }
    };

    const startRoomGame = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            const nextBoardState = room.isBoardGame ? createInitialBoardState(room.members, room.playerStates) : null;
            await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
                status: 'playing',
                playerStates: {}, // 清空舊的玩家狀態
                pendingRequests: {}, // 初始化審核請求
                startedAt: Date.now(), // 新增開始時間戳，用來觸發玩家重設狀態
                sessionId: `${room.id}_${Date.now()}`, // 每場遊戲產生新的唯一 sessionId，避免覆蓋上一場紀錄
                boardState: nextBoardState
            }));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const rollBoardDice = async (requestedDiceCount?: 1 | 2) => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
            throw new Error('棋盤房間尚未準備完成');
        }

        const boardState = room.boardState;
        if (boardState.movement?.isActive) {
            throw new Error('目前角色仍在移動中');
        }
        if (boardState.currentTurnUid !== user.uid) {
            throw new Error('還沒輪到你');
        }

        const playerState = room.playerStates?.[user.uid];
        const diceCount = hasCarAsset(playerState)
            ? (requestedDiceCount === 1 ? 1 : 2)
            : 1;
        const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
        const total = dice.reduce((sum, value) => sum + value, 0);
        const startPosition = boardState.playerPositions[user.uid] || 0;
        const pathLength = BOARD_SQUARES.length;
        const path = Array.from({ length: total }, (_, step) => (startPosition + step + 1) % pathLength);
        let nextPosition = startPosition;
        const passedMessages: string[] = [];

        for (let step = 0; step < path.length; step += 1) {
            nextPosition = path[step];
            const square = getSquareByIndex(nextPosition);
            if (square.type === 'bank') {
                passedMessages.push(`經過${square.label}，請完成月結餘確認`);
            }
            if (square.type === 'school') {
                passedMessages.push(`經過${square.label}，可前往升等考試`);
            }
            if (square.type === 'repair' && hasCarAsset(playerState)) {
                const feeRoll = Math.floor(Math.random() * 6) + 1;
                passedMessages.push(`經過維修廠，汽車保養費 ${feeRoll * 2000}，請自行登錄`);
            }
        }

        const rollTimestamp = Date.now();
        const movement = {
            playerUid: user.uid,
            startPosition,
            path,
            rollTotal: total,
            dice,
            startedAt: rollTimestamp,
            stepDurationMs: BOARD_MOVE_STEP_DURATION_MS,
            introDelayMs: BOARD_MOVE_INTRO_DELAY_MS + BOARD_DICE_ROLL_ANIMATION_MS,
            landingDelayMs: BOARD_MOVE_LANDING_DELAY_MS,
            isActive: true
        };
        const settleDelayMs = getBoardMovementSettleMs(movement);

        const updates: Record<string, any> = {
            'boardState.currentTurnUid': user.uid,
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
        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject(updates)));

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

                const resolution = buildBoardMovementResolution(latestRoom, user.uid);
                if (!resolution) return;

                await safeAsync(updateDoc(doc(db, 'rooms', room.id), resolution));
            } catch (err) {
                console.error('棋盤移動結算失敗:', err);
            }
        })();

        return {
            position: nextPosition,
            detail: passedMessages.join('\n'),
            skipTurns: room.playerStates?.[user.uid]?.skipTurns || 0,
            total
        };
    }) as Promise<{ position: number; detail: string; skipTurns: number; total: number }>;

    const finishRoomGame = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
                status: 'finished'
            }));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const closeRoom = async () => {
        if (!room || user?.uid !== room.hostId) return;
        const roomId = room.id;
        try {
            // 先清除本地狀態
            setRoom(null);
            localStorage.removeItem(`active_room_${user.uid}`);

            await safeAsync(deleteDoc(doc(db, 'rooms', roomId)));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const abandonRealEstateCard = async (cardId: string) => {
        if (!room) return;
        const boardState = room.boardState;
        if (!boardState) return;

        const currentMarket = boardState.realEstateMarket || [];
        if (currentMarket.includes(cardId)) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.realEstateMarket': [...currentMarket, cardId],
            'boardState.updatedAt': Date.now()
        }));
    };

    const buyRealEstateFromMarket = async (cardId: string) => {
        if (!room) return;
        const boardState = room.boardState;
        if (!boardState) return;

        const currentMarket = boardState.realEstateMarket || [];
        if (!currentMarket.includes(cardId)) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.realEstateMarket': currentMarket.filter(id => id !== cardId),
            'boardState.updatedAt': Date.now()
        }));
    };

    const updateMarket = async (updates: Record<string, number>, code: string, isBubble: boolean = false) => {
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

    const revealBoardCard = async (eventId: string, cardId: string) => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return;

        const { boardState } = room;
        const isCurrentCard =
            boardState.currentEvent?.id === eventId &&
            boardState.currentCard?.cardId === cardId;

        if (!isCurrentCard) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.currentCardReveal': {
                eventId,
                cardId,
                isRevealed: true,
                revealedAt: Date.now(),
                revealedBy: user.uid
            },
            'boardState.updatedAt': Date.now()
        }));
    });

    const advanceBoardEventQueue = async (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup') => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState) return;

        const { boardState } = room;
        if (expectedType && boardState.currentEvent?.type !== expectedType) return;

        // Event Completion Guard: Ensure no pending shared events
        if (hasIncompleteSharedPrompts(boardState)) {
            alert('還有玩家尚未完成共享事件回覆，請等待所有人完成後再推進事件。');
            return;
        }

        // Use runTransaction to prevent race conditions during deep state updates
        await safeAsync(runTransaction(db, async (transaction) => {
            const roomRef = doc(db, 'rooms', room.id);
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) return;
            const currentRoom = roomDoc.data() as Room;
            const currentBoardState = currentRoom.boardState;
            if (!currentBoardState) return;
            
            // Check again in transaction
            if (expectedType && currentBoardState.currentEvent?.type !== expectedType) return;
            
            // Avoid advancing if same event ID was already advanced
            if (currentBoardState.currentEvent?.id !== boardState.currentEvent?.id) {
                return; // Event already changed
            }

            const nextState = buildBoardEventAdvanceState(currentRoom);
            if (!nextState) return;

            transaction.update(roomRef, cleanObject({
                ...nextState,
                boardState: {
                    ...(nextState.boardState || currentBoardState),
                    cardLog: nextState.boardState?.currentCard
                        ? appendBoardCardLog(currentBoardState, nextState.boardState.currentCard, nextState.boardState.currentEvent)
                        : currentBoardState.cardLog || [],
                    updatedAt: Date.now()
                },
                ...(nextState.playerStates ? { playerStates: nextState.playerStates } : {})
            }));
        }));
    });

    const dismissBoardCard = async (eventId: string, cardId: string) => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState) return;

        const { boardState } = room;
        const isCurrentCard =
            boardState.currentEvent?.id === eventId &&
            boardState.currentCard?.cardId === cardId;

        if (!isCurrentCard) return;

        if (hasIncompleteSharedPrompts(boardState)) return;

        // Use runTransaction to prevent race conditions against concurrent
        // submitFamilyMilestoneJoinResponse / submitSharedCardPromptResponse writes.
        await safeAsync(runTransaction(db, async (transaction) => {
            const roomRef = doc(db, 'rooms', room.id);
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) return;
            const currentRoom = roomDoc.data() as Room;
            const currentBoardState = currentRoom.boardState;
            if (!currentBoardState) return;

            const isStillCurrentCard =
                currentBoardState.currentEvent?.id === eventId &&
                currentBoardState.currentCard?.cardId === cardId;
            if (!isStillCurrentCard) return;

            const nextState = buildBoardEventAdvanceState(currentRoom);
            if (!nextState) return;

            transaction.update(roomRef, cleanObject({
                ...nextState,
                boardState: {
                    ...(nextState.boardState || currentBoardState),
                    cardLog: nextState.boardState?.currentCard
                        ? appendBoardCardLog(currentBoardState, nextState.boardState.currentCard, nextState.boardState.currentEvent)
                        : currentBoardState.cardLog || [],
                    updatedAt: Date.now()
                },
                ...(nextState.playerStates ? { playerStates: nextState.playerStates } : {})
            }));
        }));
    });

    const drawPostExamHappinessCard = async (success: boolean) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return;

        const drawResult = drawBoardCard(room.boardState.deckState, 'happiness', room.playerStates?.[user.uid]);
        if (!drawResult) return;

        const timestamp = Date.now();
        const eventId = `${user.uid}_${timestamp}_exam_happiness`;
        const playerName = room.members.find(member => member.uid === user.uid)?.name || user.name || '玩家';

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
            boardState: {
                ...room.boardState,
                deckState: drawResult.deckState,
                currentCard: drawResult.card,
                currentCardReveal: {
                    eventId,
                    cardId: drawResult.card.cardId,
                    isRevealed: false
                },
                currentEvent: {
                    id: eventId,
                    playerUid: user.uid,
                    playerName,
                    type: 'exam_happiness',
                    summary: `${playerName}${success ? '考完升等考試' : '完成升等考試'}後抽到幸福卡`,
                    detail: `考試結束後抽到幸福卡：${drawResult.card.title}`,
                    squareIndex: room.boardState.playerPositions?.[user.uid] || 0,
                    timestamp,
                    rollTotal: room.boardState.lastRoll?.total || 0
                },
                pendingEvents: room.boardState.pendingEvents || [],
                cardLog: appendBoardCardLog(room.boardState, drawResult.card, {
                    id: eventId,
                    playerUid: user.uid,
                    playerName,
                    type: 'exam_happiness',
                    summary: `${playerName}${success ? '考完升等考試' : '完成升等考試'}後抽到幸福卡`,
                    detail: `考試結束後抽到幸福卡：${drawResult.card.title}`,
                    squareIndex: room.boardState.playerPositions?.[user.uid] || 0,
                    timestamp,
                    rollTotal: room.boardState.lastRoll?.total || 0
                }),
                updatedAt: timestamp
            }
        })));
    };

    const drawBoardFollowupCard = async (deck: 'happiness' | 'news', summary: string, detail?: string) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return;

        const drawResult = drawBoardCard(room.boardState.deckState, deck, room.playerStates?.[user.uid]);
        if (!drawResult) return;

        const timestamp = Date.now();
        const eventId = `${user.uid}_${timestamp}_${deck}_followup`;
        const playerName = room.members.find(member => member.uid === user.uid)?.name || user.name || '玩家';

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
            boardState: {
                ...room.boardState,
                deckState: drawResult.deckState,
                currentCard: drawResult.card,
                currentCardReveal: {
                    eventId,
                    cardId: drawResult.card.cardId,
                    isRevealed: false
                },
                currentEvent: {
                    id: eventId,
                    playerUid: user.uid,
                    playerName,
                    type: 'followup',
                    summary,
                    detail: detail || `接續效果抽到${deck === 'happiness' ? '幸福卡' : '新聞卡'}：${drawResult.card.title}`,
                    squareIndex: room.boardState.playerPositions?.[user.uid] || 0,
                    timestamp,
                    rollTotal: room.boardState.lastRoll?.total || 0
                },
                pendingEvents: room.boardState.pendingEvents || [],
                cardLog: appendBoardCardLog(room.boardState, drawResult.card, {
                    id: eventId,
                    playerUid: user.uid,
                    playerName,
                    type: 'followup',
                    summary,
                    detail: detail || `接續效果抽到${deck === 'happiness' ? '幸福卡' : '新聞卡'}：${drawResult.card.title}`,
                    squareIndex: room.boardState.playerPositions?.[user.uid] || 0,
                    timestamp,
                    rollTotal: room.boardState.lastRoll?.total || 0
                }),
                updatedAt: timestamp
            }
        })));
    };

    const openFamilyMilestoneJoinPrompt = async (eventId: string, cardId: string) => {
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

        const targetPlayerUids = room.members
            .filter(member => member.role !== 'coach' && member.uid !== user.uid)
            .map(member => member.uid)
            .filter(uid => {
                const playerState = room.playerStates?.[uid];
                if (!playerState) return false;
                return getFamilyMilestoneStatus(playerState).currentStageIndex !== -1;
            });

        if (targetPlayerUids.length === 0) return;

        const prompt: FamilyMilestoneJoinPrompt = {
            id: promptId,
            sourceEventId: eventId,
            sourceCardId: cardId,
            sourcePlayerUid: user.uid,
            sourcePlayerName: room.boardState.currentEvent?.playerName || user.name || '玩家',
            requiredRoll: sourceCard.joinDiceMin || 4,
            targetPlayerUids,
            responses: {},
            createdAt: Date.now()
        };

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.familyMilestoneJoinPrompt': prompt,
            'boardState.updatedAt': Date.now()
        }));
    };

    const openSharedCardPrompt = async (eventId: string, cardId: string) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return false;

        const opportunityCard = OPPORTUNITY_CARDS.find(card => card.id === cardId);
        const newsCard = NEWS_CARDS.find(card => card.id === cardId);
        const promptId = `${eventId}_${cardId}_shared`;

        if (room.boardState.sharedCardPrompt?.id === promptId) return true;

        const isCurrentCard =
            room.boardState.currentEvent?.id === eventId &&
            room.boardState.currentCard?.cardId === cardId &&
            room.boardState.currentEvent?.playerUid === user.uid;

        if (!isCurrentCard) return false;

        let kind: SharedCardPrompt['kind'] | null = null;
        if (
            opportunityCard &&
            ['purchase_1room', 'purchase_any_house', 'purchase_store', 'purchase_startup', 'enterprise_acquisition'].includes(opportunityCard.type)
        ) {
            kind = 'asset_sale';
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

        const playerMembers = room.members.filter(member => member.role !== 'coach');
        const targetPlayerUids = playerMembers
            .map(member => member.uid)
            .filter(uid => {
                const playerState = room.playerStates?.[uid];
                if (kind === 'asset_sale') {
                    if (!playerState) return false;
                    const action = resolveBoardCardAction(cardId, playerState);
                    return action.kind === 'asset_sale' && action.items.length > 0;
                }
                if (kind === 'cash_dividend' && newsCard?.type === 'cash_dividend') {
                    return hasEligibleCashDividend(playerState, newsCard.dividendPerShare);
                }
                if (kind === 'stock_dividend' && newsCard?.type === 'stock_dividend') {
                    return hasEligibleStockDividend(playerState, newsCard.dividendRate);
                }
                return true;
            });

        const prompt: SharedCardPrompt = {
            id: promptId,
            kind,
            sourceEventId: eventId,
            sourceCardId: cardId,
            sourcePlayerUid: user.uid,
            sourcePlayerName: room.boardState.currentEvent?.playerName || user.name || '玩家',
            targetPlayerUids,
            responses: {},
            createdAt: Date.now()
        };

        const result = await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.sharedCardPrompt': prompt,
            'boardState.updatedAt': Date.now()
        }), null, err => {
            setError(err?.message || '共享卡片提示建立失敗');
        });

        if (result === null) return false;

        setRoom(prev => {
            if (!prev?.boardState) return prev;
            return {
                ...prev,
                boardState: {
                    ...prev.boardState,
                    sharedCardPrompt: prompt,
                    updatedAt: Date.now()
                }
            };
        });

        return true;
    };

    const submitFamilyMilestoneJoinResponse = async (payload: {
        promptId: string;
        status: 'passed' | 'failed' | 'declined';
        roll?: number;
        cardId: string;
    }) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return;

        const prompt = room.boardState.familyMilestoneJoinPrompt;
        if (!prompt || prompt.id !== payload.promptId) return;
        if (!prompt.targetPlayerUids.includes(user.uid)) return;
        if (prompt.responses?.[user.uid]) return;

        const roomRef = doc(db, 'rooms', room.id);
        const playerState = room.playerStates?.[user.uid];
        const response = cleanObject({
            playerUid: user.uid,
            playerName: room.members.find(member => member.uid === user.uid)?.name || user.name || '玩家',
            status: payload.status,
            roll: payload.roll,
            respondedAt: Date.now()
        });

        const updates: Record<string, any> = {
            [`boardState.familyMilestoneJoinPrompt.responses.${user.uid}`]: response,
            'boardState.updatedAt': Date.now()
        };

        if (payload.status === 'passed' && playerState) {
            updates[`playerStates.${user.uid}`] = cleanObject({
                ...playerState,
                pendingFamilyMilestoneJoinAction: {
                    promptId: payload.promptId,
                    cardId: payload.cardId,
                    sourcePlayerUid: prompt.sourcePlayerUid
                },
                pendingCardAction: `${prompt.sourcePlayerName} 抽到家庭重要歷程，你擲出 ${payload.roll} 點並成功加入。`,
                lastBoardEvent: '家庭重要歷程同步參與'
            });
        }

        await safeAsync(updateDoc(roomRef, updates));
    };

    const clearPendingFamilyMilestoneJoinAction = async (promptId: string) => {
        if (!room?.id || !user) return;

        const currentPending = room.playerStates?.[user.uid]?.pendingFamilyMilestoneJoinAction;
        if (!currentPending || currentPending.promptId !== promptId) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            [`playerStates.${user.uid}.pendingFamilyMilestoneJoinAction`]: deleteField()
        }));
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

        const result = await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            [`boardState.sharedCardPrompt.responses.${user.uid}`]: response,
            'boardState.updatedAt': Date.now()
        }), null, err => {
            setError(err?.message || '共享卡片回覆失敗');
        });

        if (result === null) return false;

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

    const clearSharedCardPrompt = async (promptId: string) => {
        if (!room?.id || !room.boardState?.sharedCardPrompt) return;
        if (room.boardState.sharedCardPrompt.id !== promptId) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.sharedCardPrompt': deleteField(),
            'boardState.updatedAt': Date.now()
        }));
    };

    const setPendingStartupUpgradeAction = async (payload: { cardId: string; symbol: string }): Promise<boolean> => {
        if (!room?.id || !user) return false;

        const currentPlayerState = room.playerStates?.[user.uid];
        if (!currentPlayerState) return false;

        const nextPlayerState = withPendingStartupUpgradeAction(currentPlayerState, payload);

        const result = await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            [`playerStates.${user.uid}`]: nextPlayerState
        }), null, err => {
            setError(err?.message || '建立企業升級等待狀態失敗');
        });

        if (result === null) return false;

        setRoom(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                playerStates: {
                    ...(prev.playerStates || {}),
                    [user.uid]: nextPlayerState
                }
            };
        });

        return true;
    };

    const clearPendingStartupUpgradeAction = async () => {
        if (!room?.id || !user) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            [`playerStates.${user.uid}.pendingStartupUpgradeAction`]: deleteField()
        }), undefined, err => {
            setError(err?.message || '清除企業升級等待狀態失敗');
        });

        setRoom(prev => {
            if (!prev?.playerStates?.[user.uid]) return prev;
            return {
                ...prev,
                playerStates: {
                    ...prev.playerStates,
                    [user.uid]: withoutPendingStartupUpgradeAction(prev.playerStates[user.uid])
                }
            };
        });
    };

    const applyBoardExpenseToAllPlayers = async (payload: {
        amount: number;
        category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
        isIncrease: boolean;
        summary: string;
        detail?: string;
    }) => {
        if (!room?.id || !room.isBoardGame || !room.playerStates) return;

        const nextPlayerStates = Object.fromEntries(
            Object.entries(room.playerStates).map(([uid, state]) => {
                const currentVal = state.expenses?.[payload.category] || 0;
                const nextVal = payload.isIncrease
                    ? currentVal + payload.amount
                    : Math.max(0, currentVal - payload.amount);

                return [uid, cleanObject({
                    ...state,
                    expenses: {
                        ...state.expenses,
                        [payload.category]: nextVal
                    },
                    pendingCardAction: payload.detail || payload.summary,
                    lastBoardEvent: payload.summary
                })];
            })
        );

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
            playerStates: nextPlayerStates
        })));
    };

    const moveCurrentPlayerToSquare = async (payload: {
        squareType: 'school' | 'hospital' | 'bank';
        skipTurns?: number;
        detail?: string;
    }) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return null;

        const currentPosition = room.boardState.playerPositions?.[user.uid] || 0;
        const nextIndex = BOARD_SQUARES.find((square, index) =>
            index !== currentPosition &&
            square.type === payload.squareType &&
            ((index - currentPosition + BOARD_SQUARES.length) % BOARD_SQUARES.length) > 0
        )?.index;

        if (nextIndex === undefined) return null;

        const playerState = room.playerStates?.[user.uid];
        const nextSkipTurns = Math.max(playerState?.skipTurns || 0, payload.skipTurns || 0);
        const timestamp = Date.now();

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
            boardState: {
                ...room.boardState,
                playerPositions: {
                    ...room.boardState.playerPositions,
                    [user.uid]: nextIndex
                },
                skipTurns: {
                    ...(room.boardState.skipTurns || {}),
                    [user.uid]: nextSkipTurns
                },
                updatedAt: timestamp
            },
            playerStates: {
                ...(room.playerStates || {}),
                [user.uid]: cleanObject({
                    ...playerState,
                    boardPosition: nextIndex,
                    skipTurns: nextSkipTurns,
                    lastBoardEvent: payload.detail || `移動到${payload.squareType}`,
                    pendingCardAction: payload.detail,
                    bankServiceWindowActive: false,
                    bankServiceGrantedAtEventId: undefined
                })
            }
        })));

        return nextIndex;
    };

    const applyBoardMarketPrices = async (updates: Record<string, number>, code: string, isBubble: boolean = false) => {
        if (!room || !user) return;
        if (!room.isBoardGame) return;

        const isCurrentTurnPlayer = room.boardState?.currentTurnUid === user.uid;
        const isCurrentBoardEventPlayer =
            room.boardState?.currentEvent?.playerUid === user.uid &&
            !!room.boardState?.currentCard;

        if (!isCurrentTurnPlayer && !isCurrentBoardEventPlayer) return;

        try {
            const roomRef = doc(db, 'rooms', room.id);
            const currentPrices = room.marketPrices || {};
            const nextPrices = normalizeMarketPrices(updates, currentPrices);
            const nextMarketState = {
                marketUpdates: {
                    updates: nextPrices,
                    code,
                    isBubble,
                    timestamp: Date.now()
                },
                previousMarketPrices: currentPrices,
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
            console.error('套用棋盤行情失敗:', err);
            setError(err.message);
            throw err;
        }
    };

    const updateRoomTimer = async (timeLeft: number, isPaused: boolean) => {
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                gameTimeLeft: timeLeft,
                isTimerPaused: isPaused
            }));
        } catch (err: any) {
            console.error('更新計時器失敗:', err);
            setError(err.message);
        }
    };

    const submitRequest = async (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>) => {
        if (!room) return;
        try {
            const requestId = `${request.uid}_${Date.now()}`;
            const newRequest: PendingRequest = {
                ...request,
                id: requestId,
                status: 'pending',
                timestamp: Date.now()
            };
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}`]: newRequest
            }));
        } catch (err: any) {
            console.error('送出審核請求失敗:', err);
            setError(err.message);
        }
    };

    const approveRequest = async (requestId: string) => {
        if (!room || (user?.role !== 'coach' && user?.role !== 'gm')) return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}.status`]: 'approved'
            }));
        } catch (err: any) {
            console.error('核准請求失敗:', err);
            setError(err.message);
        }
    };

    const rejectRequest = async (requestId: string) => {
        if (!room || (user?.role !== 'coach' && user?.role !== 'gm')) return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}.status`]: 'rejected'
            }));
        } catch (err: any) {
            console.error('拒絕請求失敗:', err);
            setError(err.message);
        }
    };

    const clearRequest = async (requestId: string) => {
        if (!room) return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}`]: deleteField()
            }));
        } catch (err: any) {
            console.error('清除請求失敗:', err);
        }
    };

    return (
        <RoomContext.Provider value={{
            room,
            isLoadingRoom,
            error,
            playerStates,
            createRoom,
            joinRoom,
            leaveRoom,
            startRoomGame,
            finishRoomGame,
            closeRoom,
            updateMarket,
            updateRoomTimer,
            submitRequest,
            approveRequest,
            rejectRequest,
            clearRequest,
            rollBoardDice,
            revealBoardCard,
            dismissBoardCard,
            advanceBoardEventQueue,
            drawPostExamHappinessCard,
            drawBoardFollowupCard,
            openFamilyMilestoneJoinPrompt,
            openSharedCardPrompt,
            submitFamilyMilestoneJoinResponse,
            clearPendingFamilyMilestoneJoinAction,
            submitSharedCardPromptResponse,
            clearSharedCardPrompt,
            setPendingStartupUpgradeAction,
            clearPendingStartupUpgradeAction,
            applyBoardExpenseToAllPlayers,
            moveCurrentPlayerToSquare,
            applyBoardMarketPrices,
            abandonRealEstateCard,
            buyRealEstateFromMarket
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
