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
// 分段移動（大富翁式）：在「經過事件」停靠後，繼續走剩下步數前的短暫停頓，
// 不需要再等第一次擲骰的骰子動畫時間。
const BOARD_MOVE_CONTINUE_DELAY_MS = 500;
const BOARD_CARD_LOG_LIMIT = 40;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const createInitialBoardState = (members: RoomMember[], hostId: string, playerStates?: Record<string, GameState>): BoardState => {
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

    // 事件佇列清空後，檢查這位玩家是不是還有上一段「經過事件」停靠後
    // 剩下的步數要繼續走（大富翁式的分段移動）；有的話直接接續下一段動畫，
    // 沒有的話回合改由玩家自己按「結束回合」才真正切換，currentTurnUid 維持不變。
    const pendingMovement = boardState.movement;
    if (pendingMovement && !pendingMovement.isActive && pendingMovement.path.length > 0) {
        const movingPlayerState = roomData.playerStates?.[pendingMovement.playerUid];
        const { legPath, remainingPath } = splitMovementLeg(pendingMovement.path, movingPlayerState);

        return cleanObject({
            boardState: {
                ...boardState,
                ...activateBoardQueueEntry(null),
                familyMilestoneJoinPrompt: null,
                sharedCardPrompt: null,
                pendingEvents: [],
                movement: {
                    ...pendingMovement,
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
            familyMilestoneJoinPrompt: null,
            sharedCardPrompt: null,
            pendingEvents: [],
            movement: null,
            updatedAt: Date.now()
        }
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
    if (!boardState.currentTurnUid) return { nextUid: boardState.turnOrder[0], skipTurns: boardState.skipTurns };

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

// 依大富翁式的走法拆段：掃描這段還沒走的步數，找到第一個「經過事件」格
// （銀行/學校/維修廠）就在那裡切一段（legPath），該格之後剩下的步數留到
// 下一段再走（remainingPath）；如果整段都沒有經過事件格，代表這段直接
// 走到真正的終點（remainingPath 為空）。
const splitMovementLeg = (
    steps: number[],
    playerState: GameState | undefined
): { legPath: number[]; remainingPath: number[] } => {
    for (let i = 0; i < steps.length - 1; i += 1) {
        const square = getSquareByIndex(steps[i]);
        if (
            square.type === 'bank' ||
            square.type === 'school' ||
            (square.type === 'repair' && hasCarAsset(playerState))
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
            const repairRoll = Math.floor(Math.random() * 6) + 1;
            const repairFee = repairRoll * 2000;
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
        // 依 docs/gdd/HOSPITAL_SYSTEM.md 完成規則：停回合必須在醫療費正式成立後才寫入，
        // 此處只記錄應停回合數（hospitalSkipTurns），實際寫入 skipTurns 交由
        // advanceBoardEventQueue('hospital') 在財務檢核完成後處理（見 RM-07）。
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
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                hospitalSkipTurns: landedSquare.pauseTurns || 1
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
                timestamp: eventTimestamp,
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
    endTurn: () => Promise<void>;
    drawPostExamHappinessCard: (success: boolean) => Promise<void>;
    drawBoardFollowupCard: (deck: 'happiness' | 'news', summary: string, detail?: string) => Promise<void>;
    openFamilyMilestoneJoinPrompt: (eventId: string, cardId: string) => Promise<void>;
    openSharedCardPrompt: (eventId: string, cardId: string) => Promise<'opened' | 'no_target' | false>;
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

    // 補救措施：即使開始遊戲時已改用 transaction 讀最新 room.members，仍有極小
    // 機率因為加入房間的玩家端寫入還沒真正落地到 Firestore（樂觀本地更新先於
    // 真正 write 完成）而錯過。這裡由房主端持續監看，只要偵測到 room.members
    // 裡有玩家不在 boardState.turnOrder 內，就自動補寫，避免棋盤永久漏人。
    const isHealingTurnOrderRef = useRef<boolean>(false);
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
                        const staleResolution = buildBoardMovementLegResolution(data, movement.playerUid);
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

                // 房主端自動修復：偵測到有玩家漏在 turnOrder 之外就補齊
                if (data.hostId === user.uid) {
                    healMissingTurnOrderPlayers(data).catch(err => {
                        console.error('自動補齊 turnOrder 失敗:', err);
                    });
                }

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
                }], user.uid) : null,
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
            // 讀取本地 room 快照有可能落後於 Firestore 最新狀態（例如玩家剛加入、
            // 監聽尚未同步回房主端），若直接拿本地 room.members 建立 turnOrder，
            // 會漏掉剛加入但還沒同步到的玩家，導致棋盤永久少人。改用 transaction
            // 內即時讀取最新的房間文件，確保 turnOrder 以 Firestore 當下的真實
            // members 為準。
            await safeAsync(runTransaction(db, async (transaction) => {
                const roomRef = doc(db, 'rooms', room.id);
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;
                const currentRoom = roomDoc.data() as Room;
                if (currentRoom.hostId !== user.uid) return;

                const nextBoardState = currentRoom.isBoardGame
                    ? createInitialBoardState(currentRoom.members, currentRoom.hostId, currentRoom.playerStates)
                    : null;

                transaction.update(roomRef, {
                    status: 'playing',
                    playerStates: {}, // 清空舊的玩家狀態
                    pendingRequests: {}, // 初始化審核請求
                    startedAt: Date.now(), // 新增開始時間戳，用來觸發玩家重設狀態
                    sessionId: `${room.id}_${Date.now()}`, // 每場遊戲產生新的唯一 sessionId，避免覆蓋上一場紀錄
                    boardState: nextBoardState
                });
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
        if (boardState.hasRolledThisTurn) {
            throw new Error('這回合已經擲過骰子了，請先按「結束回合」再換下一位');
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

        // 大富翁式分段移動：這次擲骰只先走到第一個「經過事件」格（或直接走到終點，
        // 若中途沒有經過事件格），剩下的步數留到事件結案後再繼續走。
        const { legPath: firstLegPath, remainingPath: firstLegRemaining } = splitMovementLeg(path, playerState);

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
            isActive: true
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

                const resolution = buildBoardMovementLegResolution(latestRoom, user.uid);
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

        // 若這次推進事件後又接續了下一段分段移動動畫，記下來，交易成功後再排程
        // 等待動畫結束、觸發下一段的正式結算（比照 rollBoardDice 的做法）。
        let resumedMovement: { playerUid: string; startedAt: number; settleDelayMs: number } | null = null;

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

            // 依 docs/gdd/HOSPITAL_SYSTEM.md：停回合必須在醫療費正式成立（財務檢核完成，
            // 即呼叫 advanceBoardEventQueue('hospital')）之後才寫入，不得提前於棋子抵達時生效。
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

            const nextState = buildBoardEventAdvanceState(roomForAdvance);
            if (!nextState) return;

            const nextMovement = nextState.boardState?.movement;
            if (nextMovement?.isActive) {
                resumedMovement = {
                    playerUid: nextMovement.playerUid,
                    startedAt: nextMovement.startedAt,
                    settleDelayMs: getBoardMovementSettleMs(nextMovement)
                };
            }

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

                    const legResolution = buildBoardMovementLegResolution(latestRoom, playerUid);
                    if (!legResolution) return;

                    await safeAsync(updateDoc(doc(db, 'rooms', room.id), legResolution));
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

        if (boardState.currentEvent || (boardState.pendingEvents && boardState.pendingEvents.length > 0)) {
            alert('請先完成目前的棋盤事件，才能結束回合。');
            return;
        }

        if (hasIncompleteSharedPrompts(boardState)) {
            alert('還有玩家尚未完成共享事件回覆，請等待所有人完成後再結束回合。');
            return;
        }

        await safeAsync(runTransaction(db, async (transaction) => {
            const roomRef = doc(db, 'rooms', room.id);
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) return;
            const currentRoom = roomDoc.data() as Room;
            const currentBoardState = currentRoom.boardState;
            if (!currentBoardState) return;

            // Transaction 內重新檢查，避免競態下重複結束回合或跳過尚未完成的事件。
            if (currentBoardState.currentTurnUid !== user.uid) return;
            if (currentBoardState.movement) return;
            if (currentBoardState.currentEvent || (currentBoardState.pendingEvents && currentBoardState.pendingEvents.length > 0)) return;
            if (hasIncompleteSharedPrompts(currentBoardState)) return;

            const nextTurn = getNextTurnUid(currentBoardState);
            const nextTurnUid = nextTurn?.nextUid || user.uid;
            const nextPlayerStates = { ...(currentRoom.playerStates || {}) };
            const nextTurnPlayerState = nextTurnUid ? nextPlayerStates[nextTurnUid] : null;

            // 銀行服務窗口只在「輪回窗口持有者自己」時才關閉，不因為中間別人的
            // 回合開始而提前關閉（維持既有規則語意）。
            if (nextTurnUid !== user.uid && nextTurnPlayerState?.bankServiceWindowActive) {
                nextPlayerStates[nextTurnUid] = cleanObject({
                    ...nextTurnPlayerState,
                    bankServiceWindowActive: false,
                    bankServiceGrantedAtEventId: undefined
                }) as GameState;
            }

            transaction.update(roomRef, cleanObject({
                boardState: {
                    ...currentBoardState,
                    currentTurnUid: nextTurnUid,
                    hasRolledThisTurn: false,
                    skipTurns: nextTurn?.skipTurns || currentBoardState.skipTurns,
                    updatedAt: Date.now()
                },
                ...(Object.keys(nextPlayerStates).length > 0 ? { playerStates: nextPlayerStates } : {})
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
            .filter(member => member.uid !== room.hostId && member.uid !== user.uid)
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

    const openSharedCardPrompt = async (eventId: string, cardId: string): Promise<'opened' | 'no_target' | false> => {
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

        const playerMembers = room.members.filter(member => member.uid !== room.hostId);
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

        // 若沒有任何玩家（含抽卡者）符合此共享卡片的資格，就不建立等待中的共享提示——
        // 否則會產生一個沒有人看得到、也沒有人能回覆的提示，導致這張卡永遠卡在未處理狀態。
        // 比照家庭卡「沒有其他符合資格玩家」的邊界處理：直接視為本次無效果。
        if (targetPlayerUids.length === 0) return 'no_target';

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

        return 'opened';
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
        if (!room?.id || !room.isBoardGame || !room.playerStates || !user) return;

        // 共享效果的正式來源是 room.playerStates，每位玩家的本地 gameState 都必須
        // 依 sharedExpenseSyncedAt 這個時間戳把此次共享支出回灌，避免本地防抖同步
        // 用舊資料覆寫掉這次的正式共享結果（見 P0-02）。
        //
        // 抽卡者自己（user.uid）已經透過一般單人交易流程（handleTransactionSubmit）
        // 在本地正確套用過這筆支出，這裡只補一個新的 lastBoardEvent 讓其他寫入不會
        // 遺失既有欄位，但不重新計算 expenses、也不更新 lastSharedExpenseSyncedAt，
        // 避免抽卡者的本地正確結果被 GameContext 的回灌監聽用（落後的）room 舊值覆寫，
        // 造成支出被重複套用兩次。
        const syncedAt = Date.now();

        const nextPlayerStates = Object.fromEntries(
            Object.entries(room.playerStates).map(([uid, state]) => {
                if (uid === user.uid) {
                    return [uid, cleanObject({
                        ...state,
                        pendingCardAction: payload.detail || payload.summary,
                        lastBoardEvent: payload.summary
                    })];
                }

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
                    lastBoardEvent: payload.summary,
                    lastSharedExpenseSyncedAt: syncedAt
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
            endTurn,
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
