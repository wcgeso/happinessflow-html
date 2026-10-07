import {isUncertainGameCommandError} from '../game/board/pendingCommand';
import {shouldAcceptBoardSnapshot,mergeRoomSnapshotWithPrivateStates} from '../game/board/roomSnapshot';
import {submitRoomLifecycle} from '../game/board/serverRoomLifecycle';
import {submitRoomMembership} from '../game/board/serverRoomMembership';
import {createInitialBoardState} from '../game/board/initialState';
import {createRoomOnServer,recoverRoomCreationOnServer} from '../game/board/serverRoomCreation';
import {RoomCreationRecovery} from '../components/RoomCreationRecovery';
import {getPersonalFinancialHandler} from '../game/finance/transactionRoute';
import {submitServerGameCommand,callServerGameCommand} from '../game/board/serverPromptCommand';
import {ServerCommandRecovery,RoomLifecycleRecovery} from '../components/ServerCommandRecovery';
import {getNextBoardSquare,buildBoardMovementLegResolution,drawBoardCard,hasCarAsset,resolveBoardDiceCount,buildBoardCardResultById} from '../game/board/movementResolution';
export {buildBoardMovementLegResolution,resolveBoardDiceCount,buildBoardCardResultById} from '../game/board/movementResolution';
import {submitServerBanking} from '../game/finance/serverBankingCommand';
import {finalizeServerPrompt} from '../game/board/serverPromptCommand';
import type {Room, RoomMember, PendingRequest, BoardCardRevealResult} from '../types';
export type {Room, PendingRequest, BoardCardRevealResult} from '../types';
import {buildPendingRequestId, isPendingRequestDocumentId, getPendingRequestExecutionKey, applyApprovedHappinessStory} from '../game/requests/state';
export {buildPendingRequestId, isPendingRequestDocumentId, getPendingRequestExecutionKey, applyApprovedHappinessStory} from '../game/requests/state';
import {getSharedCardTargetPlayerUids, buildSharedPromptResponseFallback, buildBoardCardRevealState, buildStartupLoanPromptMutation, buildSharedAssetSalePromptMutation} from '../game/board/sharedPrompt';
export {getSharedCardTargetPlayerUids, buildSharedPromptResponseFallback, buildBoardCardRevealState, buildStartupLoanPromptMutation, buildSharedAssetSalePromptMutation} from '../game/board/sharedPrompt';
import {activateBoardQueueEntry, splitMovementLeg, buildBoardEventAdvanceState, appendBoardCardLog} from '../game/board/eventQueue';
export {buildBoardEventAdvanceState, appendBoardCardLog} from '../game/board/eventQueue';
import {buildCompletedFamilyTransition} from '../game/board/familyTransition';
import type {BoardFinancialMutationResult} from '../types';
export type {BoardFinancialMutationResult} from '../types';
import {validateFinancialEvent,buildExpenseBroadcast,hasSchoolPromotionFee,buildLifelongLearningSuccessState,buildSchoolPromotionState,buildDirectHappinessCardState,addRealEstateCardToMarket,isCurrentRealEstatePurchase,buildRealEstatePurchaseState,buildStartupLoanState,getPendingStartupUpgradeActions,resolveStartupUpgradeTarget,buildStartupUpgradeState,buildTargetEnterprisePurchaseState,buildSharedInvestmentState,buildVehicleLossState} from '../game/finance/cardState';
export {buildLifelongLearningSuccessState,buildSchoolPromotionState,buildDirectHappinessCardState,addRealEstateCardToMarket,isCurrentRealEstatePurchase,buildRealEstatePurchaseState,buildStartupLoanState,getPendingStartupUpgradeActions,resolveStartupUpgradeTarget,buildStartupUpgradeState,buildTargetEnterprisePurchaseState,buildSharedInvestmentState,buildVehicleLossState} from '../game/finance/cardState';
import {writePrivateFinancialState,financialCommandRef} from '../game/finance/history';
import {buildInsurancePurchaseState,buildDepositPurchaseState,buildStockTradeState,buildLoanBorrowState,buildLoanRepaymentState,buildDepositWithdrawalState,buildCarPurchaseState} from '../game/finance/personalState';
export {buildInsurancePurchaseState,buildDepositPurchaseState,buildStockTradeState,buildLoanBorrowState,buildLoanRepaymentState,buildDepositWithdrawalState,buildCarPurchaseState} from '../game/finance/personalState';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
import { globalGameCoreEngine, CommandGateway, LegacyRoomAdapter } from '../game';
import {
    doc,
    setDoc,
    getDoc,
    getDocFromServer,
    updateDoc,
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
    runTransaction,
    enableNetwork,
    disableNetwork
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
import { db,auth } from '../../services/firebase';
import { realtimeDb } from '../../services/realtime';
import { observeSnapshots, subscribeSubscriptionHealth, getSubscriptionErrors, type SubscriptionHealth } from '../utils/recoveringSnapshot';
const onRoomSnapshot = observeSnapshots('room');
const onRequestSnapshot = observeSnapshots('requests');
const onPlayerSnapshot = observeSnapshots('players');
const onResponseSnapshot = observeSnapshots('responses');
import { useAuth } from './AuthContext';
import { Asset, BoardCardLogEntry, BoardCardResult, BoardDeckState, BoardEventLog, BoardQueuedEvent, BoardState, CoachExpenseCategory, DicePresentationEvent, FamilyMilestoneJoinPrompt, FamilyMilestoneJoinResponse, FinancialAccelerationMultiplier, FinancialAccelerationState, FinancialSubsidyState, GameState, PresenceState, PublicPlayerState, SharedCardPrompt, SharedCardPromptResponse, Transaction, TransactionData } from '../types';
import { cleanObject, safeAsync } from '../utils/utils';
import { reportClientRejection } from '../utils/clientRejection';
import { useStableActions } from '../hooks/useStableActions';
import { runLockedBoardCommand } from '../game/board/commandLock';
import { applyPaidLearningMove, buildApprovedDrawContinuation, buildPaidLearningContinuation, completeLearningContinuation, getContinuationRollResult } from '../game/board/continuation';
import { createInitialMarketPrices, STOCK_SYMBOLS } from '../constants';
import { flowLog } from '../utils/flowLog';
import { trackGameEvent, trackBoardStage } from '../utils/telemetry';
import { serverNow, subscribeServerClock } from '../utils/serverClock';
import { useGameDiagnostics } from '../hooks/useGameDiagnostics';
import { APP_VERSION, BUILD_ID, RULES_HASH } from '../constants/version';
import {getRoomCompatibilityError} from '../game/board/roomCompatibility';
import {usePublicPlayerStates} from '../hooks/usePublicPlayerStates';
import { useSharedPromptResponses } from '../hooks/useSharedPromptResponses';
import { useMovementSettlement } from '../hooks/useMovementSettlement';
import { canSettleMovement, movementCommandId } from '../game/board/movementSettlement';
import { BOARD_SQUARES, getSquareByIndex } from '../constants/board';
import {
    buildHappinessCardMetaFromSchema,
    buildNewsCardMetaFromSchema,
    buildOpportunityCardMetaFromSchema,
    HAPPINESS_CARD_MAP,
    HAPPINESS_CARDS,
    NEWS_CARD_MAP,
    NEWS_CARDS,
    OPPORTUNITY_CARDS,
    OPPORTUNITY_CARD_MAP
} from '../constants/cards';
import { applyFamilyMilestoneStage, getFamilyMilestoneStageByCardId, getFamilyMilestoneStageByProgressId, getFamilyMilestoneStatus, isFamilyMilestoneComplete } from '../utils/familyMilestones';
import { getSharedOpportunityKind, isStandaloneOpportunityCard, resolveBoardCardAction, hasIncompleteSharedPrompts, isBoardPromptForCurrentEvent } from '../utils/boardCardActions';
import { buildMovementEffects, describeMovementEffects } from '../game/board/movementEffects';
import { appendDicePresentation, DICE_PRESENTATION_DURATION_MS, getFamilyDicePresentationReadyAt } from '../game/board/dicePresentation';
import { submitFamilyMilestoneResponse } from '../game/board/familyMilestoneResponse';
import { isRetryableBoardTransactionError, withConfirmationDeadline, runBoardTransactionWithRetry, runRoomBoardMutation as runRoomBoardMutationOnServer, type BoardRoomSnapshot, type RunRoomBoardMutationParams } from '../game/board/runBoardMutation';
import { applyBoardCommand } from '../game/board/boardRevision';
import {
    applyBoardTransaction, applyHappinessAdd, applyHappinessRemove, applyHappinessToggle,
    applyHouseConversion, applyPaydayCollection, createSequentialIdGenerator
} from '../game/finance/applyBoardTransaction';
import { runPrivateFinancialCommand } from '../game/finance/privateCommand';
import { toPublicPlayerState } from '../utils/playerState';
import { extractAssetSymbol, getBusinessAssetLabel, getRealEstateAssetLabel, getStockAssetLabel } from '../utils/assetLabels';
import { canSkipDisconnectedPlayer, mapRealtimePresenceValue } from '../utils/presence';
import { buildNextBoardTurnState, clearBoardFlowState, getNextBoardTurn } from '../utils/experienceState';
import { applyPlayerExpenseAdjustment, applyPlayerLiabilityAdjustment } from '../utils/coachAdjustments';
import { getLiabilityMonthlyPayment, getRemainingCreditCapacity } from '../utils/financialRules';
import { buildMedicalBoardCardState } from '../utils/boardMedical';
import { buildRoomPlayerSlotUpdate, ROOM_PLAYER_SLOT_COUNT, getRoomPlayerSlots } from '../utils/roomPlayerSlots';
import { debugLog, debugWarn } from '../utils/debugLog';

// Presence is ephemeral connection data; Firestore is reserved for game state.
const USE_REALTIME_PRESENCE = true;

// 手機分頁被切到背景（螢幕鎖定、切 App）時，作業系統常會先掛起 Firestore
// 用來監聽房間文件的 gRPC/long-polling 串流，但 Realtime Database 的
// WebSocket 心跳可能還撐著、或是先恢復。這段落差會讓玩家回到前景後，
// 幸福卡／骰子等大螢幕已經送出的棋盤事件卡在舊快照上，要等 Firestore SDK
// 自己的重連 backoff（實測可達一分鐘以上）才會補上。與其乾等，切回前景或
// 網路恢復時主動把 Firestore 的網路關掉再打開一次，強迫 SDK 立刻重建串流、
// 跟伺服器要一份最新快照。
const FIRESTORE_RECONNECT_BOUNCE_MIN_INTERVAL_MS = 5000;

const forceFirestoreReconnect = async (lastBounceAtRef: React.MutableRefObject<number>, reason: string) => {
    const now = serverNow();
    if (now - lastBounceAtRef.current < FIRESTORE_RECONNECT_BOUNCE_MIN_INTERVAL_MS) return;
    lastBounceAtRef.current = now;
    try {
        await disableNetwork(db);
        await enableNetwork(db);
        void trackGameEvent('firestore_reconnect_bounce', { reason }).catch(() => undefined);
    } catch (error) {
        console.error('[RoomContext] 強制重新連線 Firestore 失敗:', error);
    }
};

const getTabClientId = (): string => {
    const key = 'happiness_flow_tab_client_id';
    try {
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const created = typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `${serverNow()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(key, created);
        return created;
    } catch {
        return `${serverNow()}-${Math.random().toString(36).slice(2)}`;
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
    now = serverNow()
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
    // Newest claim wins: the tab the player just opened or returned to is the one they are using.
    // Heartbeats only renew lastSeenAt, so they never move ownership.
    .sort((left, right) => Number(right.claimedAt) - Number(left.claimedAt) || String(left.clientId).localeCompare(String(right.clientId)))[0] || null;

export const shouldClearRoomAfterSnapshotError = (code?: string): boolean => code === 'not-found';

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

export {shouldAcceptBoardSnapshot,mergeRoomSnapshotWithPrivateStates} from '../game/board/roomSnapshot';

const getRoomSessionScope = (room: Pick<Room, 'id' | 'sessionId'>): string =>
    `${room.id}:${room.sessionId || 'no-session'}`;

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

export {createInitialBoardState} from '../game/board/initialState';

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

// 依大富翁式的走法拆段：掃描這段還沒走的步數，找到第一個「經過事件」格
// （銀行/學校/維修廠）就在那裡切一段（legPath），該格之後剩下的步數留到
// 下一段再走（remainingPath）；如果整段都沒有經過事件格，代表這段直接
// 走到真正的終點（remainingPath 為空）。

interface RoomContextValue {
    room: Room | null;
    isLoadingRoom: boolean;
    error: string | null;
    playerStates: Record<string, GameState>;
    playerStatesHydrated: boolean;
    roomSyncState: 'idle' | 'cached' | 'synced' | 'offline' | 'error';
    subscriptionError: string | null;
    connectionState: 'connecting' | 'online' | 'reconnecting' | 'offline';
    isController: boolean;
    presenceStates: Record<string, PresenceState>;
    pendingRequests: Record<string, PendingRequest>;
    createRoom: (settings?: { name: string; maxPlayers: number; duration: number; isPractice?: boolean; isBoardGame?: boolean }) => Promise<string>;
    recoverRoomCreation: (retry?:boolean) => Promise<boolean>;
    setRoomPlayerSlotOpen: (slotIndex: number, isOpen: boolean) => Promise<void>;
    joinRoom: (roomCode: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    leaveToLobby: () => Promise<void>;
    startRoomGame: () => Promise<void>;
    finishRoomGame: () => Promise<void>;
    closeRoom: () => Promise<void>;
    updateMarket: (updates: Record<string, number>, code: string, isBubble?: boolean, commandId?: string) => Promise<void>;
    adjustPlayerCash: (playerUid: string, amount: number, commandId?: string) => Promise<void>;
    adjustPlayerInvestmentIncome: (playerUid: string, amount: number, commandId?: string) => Promise<void>;
    adjustPlayerLiability: (playerUid: string, liabilityId: string, adjustments: { totalOwedDelta: number; monthlyPaymentDelta: number; reason: string }, commandId?: string) => Promise<void>;
    adjustPlayerExpense: (playerUid: string, category: CoachExpenseCategory, amountDelta: number, reason: string, commandId?: string) => Promise<void>;
    updateFinancialAcceleration: (multiplier: FinancialAccelerationMultiplier, commandId?:string) => Promise<void>;
    grantFinancialSubsidyToAllPlayers: (amount: number, commandId?: string) => Promise<void>;
    updateRoomTimer: (timeLeft: number, isPaused: boolean, timerEndsAtMs?: number | null, commandId?:string, mode?:'set'|'pause') => Promise<void>;
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
    advanceBoardEventQueue: (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup', expectedEventId?:string) => Promise<boolean | undefined>;
    endTurn: () => Promise<void>;
    drawPostExamHappinessCard: (success: boolean) => Promise<boolean | void>;
    drawBoardFollowupCard: (deck: 'happiness' | 'news', summary: string, detail?: string) => Promise<boolean>;
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
        status: 'applied' | 'duplicate' | 'requires_funding' | 'waiting' | 'failed';
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
    completeOpportunityCard: (eventId:string,cardId:string,choice:'accept'|'dismiss',payload?:{assetId?:string;fundingLoanAmount?:number;forcedDebtAmount?:number}) => Promise<BoardFinancialMutationResult>;
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
    completeBankEvent: (boardEventId: string) => Promise<BoardFinancialMutationResult>;
    /** 房屋自住／出租切換。 */
    completeHouseConversion: (assetId: string, toSelfUse: boolean, operationId?: string) => Promise<BoardFinancialMutationResult>;
    /** 勾選／取消幸福清單項目。 */
    completeHappinessToggle: (id: string, checked?: boolean, operationId?: string) => Promise<BoardFinancialMutationResult>;
    /** 新增自訂幸福項目。 */
    completeHappinessAdd: (label: string, points: number, operationId?: string) => Promise<BoardFinancialMutationResult>;
    /** 移除幸福項目。 */
    completeHappinessRemove: (id: string, operationId?: string) => Promise<BoardFinancialMutationResult>;
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
    deferStartupUpgrade: (assetId:string,cardId:string) => Promise<boolean>;
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
    buyCurrentRealEstateCard: (eventId: string, cardId: string, txData: TransactionData) => Promise<BoardFinancialMutationResult>;
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
    movementSettlementError: string | null;
    isSettlingMovement: boolean;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);
type RoomStateKeys = 'room' | 'isLoadingRoom' | 'error' | 'playerStates' | 'playerStatesHydrated' | 'roomSyncState' | 'subscriptionError' | 'connectionState' | 'isController' | 'presenceStates' | 'pendingRequests' | 'movementSettlementError' | 'isSettlingMovement';
export type RoomStateValue = Pick<RoomContextValue, RoomStateKeys>;
export type RoomActionsValue = Omit<RoomContextValue, RoomStateKeys>;
const RoomStateContext = createContext<RoomStateValue | undefined>(undefined);
const RoomActionsContext = createContext<RoomActionsValue | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [room, setRoom] = useState<Room | null>(null);
    const [isLoadingRoom, setIsLoadingRoom] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerStates, setPlayerStates] = useState<Record<string, GameState>>({});
    const [playerStatesHydrated, setPlayerStatesHydrated] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<Record<string, PendingRequest>>({});
    const [roomSyncState, setRoomSyncState] = useState<RoomContextValue['roomSyncState']>('idle');
    const subscriptionFailures = useSyncExternalStore(subscribeSubscriptionHealth, getSubscriptionErrors);
    const failedSubscription = (JSON.parse(subscriptionFailures) as SubscriptionHealth[])[0];
    const subscriptionSurface = failedSubscription?.channel.split(':')[0];
    const subscriptionLabel = ({room:'房間',players:'玩家資料',player:'本人資料',requests:'審核',responses:'共享回覆'} as Record<string,string>)[subscriptionSurface || ''] || '遊戲資料';
    const subscriptionError = failedSubscription ? `${subscriptionLabel}同步中斷（${failedSubscription.code || 'unknown'}）` : null;

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
    const lastFirestoreReconnectAtRef = useRef(0);
    const lastRealtimeConnectedValueRef = useRef<boolean | null>(null);

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
            debugLog('[RoomContext] coreRoomAdapter ready:', coreRoomAdapter.isReady());
        }
    }, [coreRoomAdapter]);
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(subscribeServerClock, []);
    // Keep the game function warm while someone is in the lobby or a room, so taps skip the cold start.
    useEffect(() => {
        if (!user?.uid || import.meta.env.VITE_SERVER_GAME_ROOMS !== 'true') return;
        const warm = () => { if (document.visibilityState !== 'hidden') void Promise.resolve().then(() => callServerGameCommand({type:'warmup'})).catch(() => undefined); };
        warm();
        const id = window.setInterval(warm, 10 * 60_000);
        document.addEventListener('visibilitychange', warm);
        return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', warm); };
    }, [user?.uid, room?.id]);
    const isProcessingRef = useRef<boolean>(false);

    const runRoomBoardMutation = async <T, R extends BoardRoomSnapshot>(params: RunRoomBoardMutationParams<T, R>): Promise<T> => {
        const compatibilityError=getRoomCompatibilityError(room);
        if(compatibilityError)throw new Error(compatibilityError);
        if (room?.status === 'playing' && !isController) {
            throw new Error('此帳號已在其他分頁操作，這個分頁目前為唯讀');
        }
        return runRoomBoardMutationOnServer<T, R>({...params, sessionId: room?.sessionId});
    };

    const canMutateCurrentRoom = (): boolean => {
        const compatibilityError=getRoomCompatibilityError(room);
        if(compatibilityError){setError(compatibilityError);return false;}
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

        const sessionId = `${user.uid}:${serverNow()}`;
        const connectionRef = pushRealtime(realtimeRef(realtimeDb, `roomConnections/${room.id}/${user.uid}`));
        const lastOnlineRef = realtimeRef(realtimeDb, `roomLastOnline/${room.id}/${user.uid}`);
        const connectedRef = realtimeRef(realtimeDb, '.info/connected');
        presenceSessionIdRef.current = sessionId;
        presenceConnectionRef.current = connectionRef;
        lastRealtimeConnectedValueRef.current = null;
        setConnectionState('connecting');

        const handleConnection = (snapshot: DataSnapshot) => {
            const isConnected = snapshot.val() === true;
            const wasConnected = lastRealtimeConnectedValueRef.current;
            lastRealtimeConnectedValueRef.current = isConnected;
            if (!isConnected) {
                setConnectionState(current => current === 'online' ? 'reconnecting' : current);
                return;
            }
            setConnectionState('online');
            if (wasConnected === false) {
                // 從斷線恢復（而不是第一次連上）：分頁很可能剛從背景／網路中斷
                // 恢復，Firestore 的房間監聽串流通常比 Realtime Database 心跳
                // 更晚才會發現自己需要重連，主動 bounce 一次網路連線。
                void forceFirestoreReconnect(lastFirestoreReconnectAtRef, 'realtime_presence_recovered');
            }
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

    // 手機切回前景／恢復網路時，Realtime Database 的心跳有時比 Firestore
    // 的房間監聽串流更快恢復，導致上面那段復原判斷來不及觸發。這裡再補一層
    // 直接的訊號：分頁變成可見或瀏覽器回報 online，就主動 bounce 一次
    // Firestore 網路連線，讓幸福卡／骰子等棋盤事件不用乾等 SDK 自己的重連
    // backoff（實測可達一分鐘以上）。
    useEffect(() => {
        if (!user?.uid || !room?.id) return;
        const handleForegroundOrOnline = (reason: string) => () => {
            if (reason === 'visibilitychange' && document.visibilityState !== 'visible') return;
            void forceFirestoreReconnect(lastFirestoreReconnectAtRef, reason);
        };
        const handleVisibilityChange = handleForegroundOrOnline('visibilitychange');
        const handleOnline = handleForegroundOrOnline('window_online');
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
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

    // 同一帳號多分頁使用獨立 claim；最新開啟或回到前景的分頁取得控制權。
    // claim 綁定 onDisconnect，異常關閉分頁後不會把舊控制權留在房間裡。
    useEffect(() => {
        if (!user?.uid || !room?.id) {
            setIsController(true);
            return;
        }
        // This tab is about to write the newest claim, so it owns control immediately;
        // waiting for the RTDB round trip used to leave a reopened phone read-only.
        setIsController(true);
        const controllerRootRef = realtimeRef(realtimeDb, `roomControllers/${room.id}/${user.uid}`);
        const clientId = realtimeClientIdRef.current;
        const controllerRef = realtimeRef(realtimeDb, `roomControllers/${room.id}/${user.uid}/${clientId}`);
        let claim = { clientId, claimedAt: serverNow(), lastSeenAt: serverNow() };
        const writeClaim = () => setRealtime(controllerRef, claim).catch(error => console.error('取得分頁控制權失敗:', error));
        void onRealtimeDisconnect(controllerRef).remove().catch(error => console.error('設定分頁控制權清理失敗:', error));
        void writeClaim();
        const unsubscribe = onRealtimeValue(controllerRootRef, snapshot => {
            const latestClaim = selectActiveControllerClaim(
                Object.values((snapshot.val() || {}) as Record<string, RoomControllerClaim>)
            );
            setIsController(!latestClaim || latestClaim.clientId === clientId);
        }, error => {
            // The server validates every command; a presence outage must not lock the player's buttons.
            console.error('監聽分頁控制權失敗:', error);
            setIsController(true);
        });
        const reclaim = () => {
            if (document.visibilityState === 'hidden') return;
            const now = serverNow();
            claim = { clientId, claimedAt: now, lastSeenAt: now };
            setIsController(true);
            void writeClaim();
        };
        const heartbeatId = window.setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            claim = { ...claim, lastSeenAt: serverNow() };
            void writeClaim();
        }, CONTROLLER_CLAIM_HEARTBEAT_MS);
        document.addEventListener('visibilitychange', reclaim);
        window.addEventListener('pageshow', reclaim);
        window.addEventListener('focus', reclaim);
        return () => {
            unsubscribe();
            window.clearInterval(heartbeatId);
            document.removeEventListener('visibilitychange', reclaim);
            window.removeEventListener('pageshow', reclaim);
            window.removeEventListener('focus', reclaim);
            void removeRealtime(controllerRef).catch(error => console.error('清理分頁控制權失敗:', error));
        };
    }, [room?.id, user?.uid]);
    const lockedCommandsRef = useRef(new Map<string, Promise<unknown>>());
    const executeWithLock = <T,>(action: () => Promise<T>, commandKey: string): Promise<T> => {
        if (room?.status === 'playing' && !isController) {
            const message = '此帳號已在其他分頁操作，這個分頁目前為唯讀';
            reportClientRejection('read-only', commandKey);
            setError(message);
            return Promise.reject(Object.assign(new Error(message), { code: 'read-only' }));
        }
        return runLockedBoardCommand(lockedCommandsRef.current, commandKey, async () => {
            isProcessingRef.current = true;
            try { return await action(); }
            finally { isProcessingRef.current = false; }
        });
    };

    const finalizeSubcollectionSharedPrompt = useCallback(async (roomId: string, promptId: string) => {
        if (room?.promptCompletionAuthority === 'server-prompts-v1') {
            await finalizeServerPrompt(room, promptId);
            return;
        }
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
    }, [room?.id, room?.sessionId, room?.promptCompletionAuthority, room?.boardState?.currentEvent?.id]);


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

                debugWarn('偵測到玩家不在棋盤 turnOrder 內，自動補齊:', missingUids);
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
                readPromptResponses: !!completedFamilyPrompt,
                onDuplicate: () => false,
                mutate: (latestRoom, latestBoard) => {
                    const latestFamilyPrompt = latestBoard.familyMilestoneJoinPrompt;
                    const latestSharedPrompt = latestBoard.sharedCardPrompt;
                    const shouldCompleteFamily = latestRoom.promptCompletionAuthority !== 'server-prompts-v1' && !!latestFamilyPrompt &&
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
                            updatedAt: serverNow()
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
        return () => {
            cancelled = true;
            // StrictMode can cancel a restore before it resolves. The next mount
            // must be able to try again with the same authenticated user.
            if (restoreAttemptedUidRef.current === user.uid) restoreAttemptedUidRef.current = null;
        };
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
            if (restoreAttemptedUidRef.current !== user.uid) localStorage.removeItem(`active_room_${user.uid}`);
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
        debugLog('開始監聽房間:', targetRoomId);
        const unsubscribe = onRoomSnapshot(doc(db, 'rooms', targetRoomId), { includeMetadataChanges: true }, (snapshot) => {
            if (roomListenerTokenRef.current !== targetRoomId) return;
            const serverConfirmed = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
            setRoomSyncState(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites ? 'cached' : 'synced');
            if (snapshot.exists()) {
                const data = snapshot.data() as Room;
                lastObservedRoomStatusRef.current = data.status;
                const snapshotHash = JSON.stringify(data);
                const isSameSnapshot = lastRoomSnapshotHashRef.current === snapshotHash;
                lastRoomSnapshotHashRef.current = snapshotHash;
                debugLog('房間數據更新:', data.id, '狀態:', data.status, '成員數:', data.members?.length);

                const boardUpdatedAt = Number(data.boardState?.updatedAt);
                const boardSnapshotKey = `${data.boardState?.revision ?? 'none'}:${boardUpdatedAt || 'none'}`;
                trackBoardStage('received', targetRoomId, data.boardState, { surface: 'room', from_cache: snapshot.metadata.fromCache, pending_writes: snapshot.metadata.hasPendingWrites });
                const snapshotTraceId = `${targetRoomId}:${data.boardState?.revision || 0}:${boardUpdatedAt || 0}`;
                const turnHandoff = lastObservedTurnUidRef.current !== null
                    && data.boardState?.currentTurnUid !== lastObservedTurnUidRef.current;
                if (serverConfirmed && Number.isFinite(boardUpdatedAt) && boardUpdatedAt > 0 && lastMeasuredBoardSnapshotRef.current !== boardSnapshotKey) {
                    lastMeasuredBoardSnapshotRef.current = boardSnapshotKey;
                    void trackGameEvent('board_listener_sync', {
                        apparent_lag_ms: Math.round(serverNow() - boardUpdatedAt),
                        clock_error_ms: -1,
                        turn_handoff: turnHandoff,
                        revision: data.boardState?.revision || 0,
                        movement_active: !!data.boardState?.movement?.isActive,
                        from_cache: snapshot.metadata.fromCache,
                        pending_writes: snapshot.metadata.hasPendingWrites,
                        // Size sampling re-serializes the whole room; measure every 20th revision only.
                        ...((data.boardState?.revision || 0) % 20 === 0 ? {
                            room_bytes: snapshotHash.length,
                            board_bytes: JSON.stringify(data.boardState || null).length,
                        } : {}),
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

                // 檢查自己是否還在成員名單中
                const isHost = data.hostId === user.uid;
                const stillMember = data.members?.some(m => m.uid === user.uid);

                if (serverConfirmed && !stillMember && !isHost) {
                    debugLog('檢測到用戶已不在成員名單中，自動清除狀態');
                    activeRoomScopeRef.current = null;
                    setRoom(null);
                    localStorage.removeItem(`active_room_${user.uid}`);
                    localStorage.removeItem('hf_practice_mode');
                    return;
                }

                if (data.pendingRequests) {
                    debugLog('偵測到待審核請求:', Object.keys(data.pendingRequests).length, '筆');
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
                        void trackGameEvent('board_state_scheduled', {
                            trace_id: snapshotTraceId,
                            ui_ready_ms: Math.max(0, Math.round(performance.now() - listenerReceivedAt)),
                            revision: data.boardState?.revision || 0,
                            room_bytes: snapshotHash.length
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
                    // Server-prompt rooms finalize prompts on the backend and Rules reject client prompt
                    // edits, so a client cleanup could only fail and retry on the coach's device.
                    if (data.promptCompletionAuthority !== 'server-prompts-v1') healStaleBoardPrompts(data).catch(err => {
                        console.error('自動清理過期共享事件失敗:', err);
                    });
                }

                // 儲存目前房間 ID 到 localStorage
                localStorage.setItem(`active_room_${user.uid}`, data.id);
            } else if (serverConfirmed) {
                // 房主在結算後關閉（刪除）房間時，玩家仍停留在遊戲評分頁，
                // 由玩家自己按「離開遊戲」回大廳；下次登入時房間已不存在，會直接進大廳。
                if (lastObservedRoomStatusRef.current === 'finished' && !isClosingRoomRef.current) {
                    debugLog('房間已被房主關閉，保留結算畫面直到玩家自行離開');
                    return;
                }
                debugLog('房間不存在或已被關閉');
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
            debugLog('停止監聽房間:', targetRoomId);
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

        return onRequestSnapshot(requestsQuery, { includeMetadataChanges: true }, snapshot => {
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
    }, [room?.id, room?.sessionId, room?.hostId, room?.memberUids?.join('|'), room?.members?.map(member=>member.uid).join('|'), roomSyncState, user?.role, user?.uid]);

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
            return onPlayerSnapshot(statesRef, { includeMetadataChanges: true }, snapshot => {
                applyStates(Object.fromEntries(
                    snapshot.docs.map(playerDoc => [playerDoc.id, playerDoc.data() as GameState])
                ));
            }, error => {
                console.error('監聽玩家私有狀態失敗:', error);
                setPlayerStatesHydrated(false);
            });
        }

        return onPlayerSnapshot(doc(db, 'rooms', targetRoomId, 'players', user.uid), { includeMetadataChanges: true }, snapshot => {
            applyStates(snapshot.exists() ? { [user.uid]: snapshot.data() as GameState } : {});
        }, error => {
            console.error('監聽自己的玩家狀態失敗:', error);
            setPlayerStatesHydrated(false);
        });
    }, [room?.id, room?.sessionId, room?.startedAt, room?.status, room?.hostId, user?.role, user?.uid]);

    usePublicPlayerStates(room,!!user&&roomSyncState==='synced',setRoom,setError);
    useSharedPromptResponses({ room, user, setRoom, setError, finalize: finalizeSubcollectionSharedPrompt });

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

    const adoptCreatedRoom = useCallback((createdRoom:Room) => {
        resumeSuppressedRoomRef.current=null;
        roomListenerTokenRef.current=createdRoom.id;
        activeRoomScopeRef.current=getRoomSessionScope(createdRoom);
        localStorage.setItem(`active_room_${createdRoom.hostId}`,createdRoom.id);
        setRoom(createdRoom);
    },[]);

    const recoverRoomCreation = useCallback(async (retry=false):Promise<boolean> => {
        if(!user?.uid)return false;
        const recovered=await recoverRoomCreationOnServer(retry);
        if(!recovered)return false;
        if(recovered.room.hostId!==user.uid)throw new Error('登入帳號已變更，請登入原帳號恢復房間。');
        if(room?.id&&room.id!==recovered.roomId&&room.status!=='finished')throw new Error('請先處理目前房間，再恢復原開房操作。');
        adoptCreatedRoom(recovered.room);setError(null);return true;
    },[user?.uid,room?.id,room?.status,adoptCreatedRoom]);

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

            if(settings?.isBoardGame&&!settings.isPractice&&import.meta.env.VITE_SERVER_GAME_ROOMS==='true'){
                const created=await createRoomOnServer({name:settings.name,maxPlayers:settings.maxPlayers,duration:settings.duration});
                if(created.room.hostId!==user.uid)throw new Error('登入帳號已變更，請登入原帳號恢復房間。');
                adoptCreatedRoom(created.room);
                return created.roomId;
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
                sessionId: `${roomCode}_${serverNow()}`,
                ...(settings?.isBoardGame ? { syncSchemaVersion: 2, flowSchemaVersion: 1, financialHistoryStorage: 'subcollection' } : {}),
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
                activeGame: { roomId: roomCode, joinedAt: serverNow() }
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
    }, [room, user, generateRoomCode,adoptCreatedRoom]);

    const setRoomPlayerSlotOpen = async (slotIndex: number, isOpen: boolean) => {
        if (!room?.id || !user) throw new Error('請先進入房間');
        const compatibilityError=getRoomCompatibilityError(room);
        if(compatibilityError){setError(compatibilityError);throw new Error(compatibilityError);}
        if(room.bankingAuthority==='server-banking-v1'){
            try{await submitRoomMembership(room,user.uid,{type:'setRoomSlot',slotIndex,isOpen});setError(null);}
            catch(error){setError((error as Error).message);throw error;}
            return;
        }
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
            const initial=await getDocFromServer(doc(db,'rooms',roomCode));
            if(!initial.exists())throw new Error('此房間不存在');
            const candidate=initial.data() as Room,compatibilityError=getRoomCompatibilityError(candidate);
            if(compatibilityError)throw new Error(compatibilityError);
            if(candidate.bankingAuthority==='server-banking-v1'){
                if(auth.currentUser?.uid!==user.uid)throw new Error('登入帳號已變更，請重新確認房間。');
                if(!candidate.members.some(member=>member.uid===user.uid&&!member.isLeft))await submitRoomMembership(candidate,user.uid,{type:'joinRoom'});
                const latest=await getDocFromServer(doc(db,'rooms',roomCode)),joined=latest.data() as Room;
                if(auth.currentUser?.uid!==user.uid||!latest.exists()||joined.sessionId!==candidate.sessionId||!joined.members.some(member=>member.uid===user.uid&&!member.isLeft))throw new Error('加入結果尚待確認，請沿用原房號重試。');
                resumeSuppressedRoomRef.current=null;
                roomListenerTokenRef.current=roomCode;
                activeRoomScopeRef.current=getRoomSessionScope(joined);
                localStorage.setItem(`active_room_${user.uid}`,roomCode);setRoom(joined);
                return;
            }
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
                activeGame: { roomId: roomCode, joinedAt: serverNow() }
            });

            // 存入 localStorage 並手動更新 room ID 觸發監聽器
            resumeSuppressedRoomRef.current = null;
            roomListenerTokenRef.current = roomCode;
            activeRoomScopeRef.current = getRoomSessionScope(joinedRoom);
            localStorage.setItem(`active_room_${user.uid}`, roomCode);
            setRoom(joinedRoom);
        } catch (err: any) {
            const message = err?.code === 'permission-denied'
                ? '目前無法讀取此房間，請核對房號、是否已開始，以及登入帳號資格'
                : err?.message || '加入房間失敗';
            setError(message);
            throw new Error(message);
        } finally {
            setIsLoadingRoom(false);
        }
    };

    const leaveRoom = async () => {
        if (!user || !room) return;
        const compatibilityError=getRoomCompatibilityError(room);
        if(compatibilityError){setError(compatibilityError);throw new Error(compatibilityError);}
        if(room.bankingAuthority==='server-banking-v1'){
            try{if(room.status!=='playing')await submitRoomMembership(room,user.uid,{type:'leaveRoom'});}
            catch(error){setError((error as Error).message);throw error;}
            // During a game, leaving the screen retains the seat and confirmed workflow.
            resumeSuppressedRoomRef.current=room.id;setRoom(null);localStorage.removeItem(`active_room_${user.uid}`);return;
        }
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
        const compatibilityError=getRoomCompatibilityError(room);
        if(compatibilityError){setError(compatibilityError);return;}
        if(room.bankingAuthority==='server-banking-v1'){
            try{
                const result=await submitServerGameCommand<any>({type:'startRoom',roomId:room.id,sessionId:room.sessionId,commandId:`start:${room.sessionId}:${user.uid}`});
                if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'開始遊戲尚待確認，請查核原操作。');
                setError(null);
            }catch(error){setError((error as Error).message||'開始遊戲失敗，請查核原操作。');}
            return;
        }
        const targetRoomId = room.id;
        const requestedStartedAt = serverNow();
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
        if(room.movementAuthority==='server-movement-v1') {
            const result=await submitServerGameCommand<any>({type:'rollBoard',roomId:room.id,sessionId:room.sessionId,commandId:`roll:${user.uid}:${boardState.revision||0}`,revision:boardState.revision||0,...(requestedDiceCount?{diceCount:requestedDiceCount}:{})});
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.message||'擲骰結果尚待確認');
            return result;
        }
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

        const rollTimestamp = serverNow();
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
            readPromptResponses: false,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            expectedRevision: boardState.revision || 0,
            onDuplicate: latestRoom => ({
                timestamp: latestRoom.boardState?.lastRoll?.timestamp || rollTimestamp,
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
                        timestamp: rollTimestamp,
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
    }, `roll:${room?.id}:${room?.boardState?.currentTurnUid}:${room?.boardState?.hasRolledThisTurn}`) as Promise<{ position: number; detail: string; skipTurns: number; total: number; dice: number[] }>;

    const rollRepairFee = async (eventId: string): Promise<{ roll: number; fee: number }> => {
        if (!room?.id || !user) throw new Error('維修廠事件尚未準備完成');
        if(room.bankingAuthority==='server-banking-v1')return submitServerGameCommand({type:'rollService',roomId:room.id,sessionId:room.sessionId,eventId,kind:'repair',commandId:`repair-roll:${eventId}:${user.uid}`});
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
                        updatedAt: serverNow()
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
                        timestamp: serverNow()
                    }),
                    result: { roll: candidateRoll, fee }
                };
            }
        });
        return result;
    };

    const rollHospitalFee = async (eventId: string): Promise<{ roll: number; fee: number }> => {
        if (!room?.id || !room.isBoardGame || !user) throw new Error('醫院事件尚未準備完成');
        if(room.bankingAuthority==='server-banking-v1')return submitServerGameCommand({type:'rollService',roomId:room.id,sessionId:room.sessionId,eventId,kind:'hospital',commandId:`hospital-roll:${eventId}:${user.uid}`});
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
                const timestamp = serverNow();
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
        if(room.bankingAuthority==='server-banking-v1') {
            if(!canMutateCurrentRoom()||!payload.sourceEventId)throw new Error('學習事件尚未準備完成');
            const result=await submitServerGameCommand<BoardDiceRollResult & {status:string}>({type:payload.kind==='normal'?'rollSchool':'rollLearning',roomId:room.id,sessionId:room.sessionId,eventId:payload.sourceEventId,commandId:`skill-roll:${room.sessionId}:${user.uid}:${payload.kind}:${payload.sourceEventId}`});
            if(!['applied','duplicate'].includes(result.status))throw new Error('學習結果尚待確認');
            return result;
        }
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
                const saved = getContinuationRollResult(latestRoom.boardState?.pendingContinuation, user.uid, payload.kind, payload.sourceEventId);
                if (saved) return { ...saved, dice: [saved.roll], total: saved.roll, presentationDurationMs: 0 };
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
                const continuation = latestBoard.pendingContinuation;
                const saved = getContinuationRollResult(continuation, user.uid, payload.kind, payload.sourceEventId);
                if (saved) return { boardState: latestBoard, commit: false, result: { ...saved, dice: [saved.roll], total: saved.roll, presentationDurationMs: 0 } };
                if (payload.sourceEventId && latestBoard.currentEvent?.id !== payload.sourceEventId) throw new Error('升等事件已更新');
                if (latestRoom.flowSchemaVersion === 1 && payload.kind !== 'normal' && (
                    !continuation || continuation.kind !== 'lifelong-learning' || continuation.phase !== 'awaiting_roll' ||
                    continuation.playerUid !== user.uid || continuation.learningType !== payload.kind ||
                    continuation.sourceEventId !== payload.sourceEventId || continuation.sessionId !== latestRoom.sessionId
                )) throw new Error('尚未完成終身學習付款，或判定事件已更新');
                const latestState = latestRoom.playerStates?.[user.uid];
                if (!latestState) throw new Error('玩家資料尚未同步完成，請重新整理後再試');
                if (payload.kind === 'normal' && (
                    latestBoard.currentEvent?.type !== 'school' ||
                    latestBoard.currentEvent.playerUid !== user.uid
                )) {
                    throw new Error('目前沒有可執行的升等考試');
                }

                const level = latestState.currentRankLevel || 1;
                const target = payload.kind === 'normal' ? level + 1
                    : continuation?.kind === 'lifelong-learning' ? continuation.requiredRoll
                    : payload.kind === 'stock_ability' || payload.kind === 'real_estate_ability' ? 4 : 2;
                const success = candidateRoll >= target;
                const timestamp = serverNow();
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
                } else {
                    nextPlayerState = success ? buildLifelongLearningSuccessState(latestState, payload.kind, commandId, timestamp) : latestState;
                    if (!success) nextPlayerState = { ...latestState, history: [{
                        id: commandId, timestamp, name: '終身學習判定未達標', amount: 0,
                        sourceLabel: '事件', usageLabel: '學習結果', cashChange: 0, balance: latestState.cash,
                        details: JSON.stringify({kind: payload.kind, roll: candidateRoll, target, success}), flowType: '其它'
                    }, ...(latestState.history || [])] };
                }
                const resultLabel = success
                    ? (payload.kind === 'normal' ? '考試通過' : '學習成功')
                    : '未達標';
                const nextBoardState = { ...latestBoard, updatedAt: timestamp };
                const resultBonus = normalOutcome?.bonus || 0;
                const resultTitle = normalOutcome?.newTitle || latestState.currentRankTitle || '';
                return {
                    boardState: appendDicePresentation({ ...nextBoardState, pendingContinuation: payload.kind === 'normal' ? continuation : completeLearningContinuation(continuation, user.uid, payload.kind, payload.sourceEventId, { roll: candidateRoll, target, success, bonus: resultBonus, newTitle: resultTitle }) }, {
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
        if (!canMutateCurrentRoom()) throw new Error('此分頁目前無法結束遊戲');
        if (!room || user?.uid !== room.hostId) throw new Error('只有本場執行師可以結束遊戲');
        try {
            if(room.bankingAuthority==='server-banking-v1'){
                await submitRoomLifecycle(room,user.uid,'finishRoom');
                setError(null);
                return;
            }
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
            throw err;
        }
    };

    const closeRoom = async () => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁目前無法關閉房間');
        if (!room || user?.uid !== room.hostId) throw new Error('只有本場執行師可以關閉房間');
        const roomId = room.id;
        isClosingRoomRef.current = true;
        try {
            if(room.bankingAuthority==='server-banking-v1'){
                await submitRoomLifecycle(room,user.uid,'closeRoom');
                resumeSuppressedRoomRef.current=roomId;
                if(roomListenerTokenRef.current===roomId)roomListenerTokenRef.current=null;
                setRoom(current=>current?.id===roomId&&current.sessionId===room.sessionId?null:current);
                if(localStorage.getItem(`active_room_${user.uid}`)===roomId)localStorage.removeItem(`active_room_${user.uid}`);
                setError(null);
                return;
            }
            const roomRef = doc(db,'rooms',roomId);
            const [snapshot,diagnostics,requests] = await Promise.all([getDoc(roomRef),
                getDocs(collection(db,'rooms',roomId,'diagnostics')),getDocs(collection(db,'rooms',roomId,'pendingRequests'))]);
            if (!snapshot.exists()) throw new Error('房間不存在，無法完成關房封存');
            const latest=snapshot.data() as Room;
            const available=diagnostics.docs.map(item=>item.data());
            const expected=latest.members.filter(member=>!member.isLeft).map(member=>member.uid);
            await setDoc(doc(db,'room_archives',latest.sessionId || roomId),cleanObject({
                roomId,sessionId:latest.sessionId || roomId,hostId:latest.hostId,archivedAt:serverTimestamp(),appVersion:APP_VERSION,buildId:BUILD_ID,rulesHash:RULES_HASH,
                boardState:latest.boardState || null,pendingRequests:requests.docs.map(item=>item.data()),diagnostics:available,
                missingDiagnosticUids:expected.filter(uid=>!available.some(item=>item.uid===uid)),
                projectionDiagnosticsMissing:!available.some(item=>item.screen==='projection'),
            }));
            const batch = writeBatch(db);
            room.members.forEach(member => batch.set(
                doc(db, 'users', member.uid),
                { activeGame: deleteField() },
                { merge: true }
            ));
            await batch.commit();
            await deleteDoc(doc(db, 'rooms', roomId));
            roomListenerTokenRef.current = null;
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

    const buyCurrentRealEstateCard = async (eventId: string, cardId: string, txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return {status:'failed',message:'此分頁目前為唯讀'};
        if (!room?.id || !user) return {status:'failed',message:'房間或登入資料尚未完成'};
        const commandId = `card-purchase:${eventId}:${user.uid}:${cardId}`;
        if(room.bankingAuthority==='server-banking-v1')return submitServerBanking(room,user.uid,commandId,{type:'purchaseRealEstate',source:'current',eventId,cardId,toSelfUse:txData.assetDetails?.isSelfUse===true,...(txData.fundingLoanAmount?{fundingLoanAmount:txData.fundingLoanAmount}:{})});
        try { return await runRoomBoardMutation<BoardFinancialMutationResult,Room>({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            onDuplicate: () => ({status:'duplicate'}),
            mutate: (latestRoom, latestBoard) => {
                if (
                    latestBoard.currentEvent?.id !== eventId ||
                    latestBoard.currentEvent.playerUid !== user.uid ||
                    latestBoard.currentCard?.cardId !== cardId ||
                    latestBoard.currentCard.deck !== 'news'
                ) throw new Error('不動產卡片事件已更新');
                if (!isCurrentRealEstatePurchase(cardId,txData)) {
                    throw new Error('不動產交易資料已更新，請重新確認卡片');
                }

                const currentState = latestRoom.playerStates?.[user.uid];
                if (!currentState) throw new Error('玩家資料尚未同步完成');
                const shortfall=Math.max(0,-(currentState.cash+txData.cashChange));
                if (shortfall>0 && !txData.fundingLoanAmount) return {boardState:latestBoard,commit:false,result:{status:'requires_funding',shortfall,message:'現金不足，請先周轉頭期款'}};
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
                    result: {status:'applied'}
                };
            }
        }); } catch(error:any) {
            const message=error?.message || '不動產交易尚未確認，請沿用原操作安全重試';
            setError(message);
            return {status:error?.code==='waiting-confirmation'?'waiting':'failed',code:error?.code,message};
        }
    };

    const buyRealEstateFromMarket = async (
        cardId: string,
        attemptId: string,
        txData: TransactionData
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room || !user) return { status: 'failed', message: '目前沒有可用的房間連線' };

        const commandId = `market-purchase:${room.id}:${user.uid}:${cardId}:${attemptId}`;
        if(room.bankingAuthority==='server-banking-v1')return submitServerBanking(room,user.uid,commandId,{type:'purchaseRealEstate',source:'market',cardId,toSelfUse:txData.assetDetails?.isSelfUse===true,...(txData.fundingLoanAmount?{fundingLoanAmount:txData.fundingLoanAmount}:{})});
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

                    const now = serverNow();
                    const currentState = latestRoom.playerStates?.[user.uid];
                    if (!currentState) throw new Error('房市購買資料尚未準備完成');
                    const shortfall = Math.max(0, -(Number(currentState.cash) + txData.cashChange));
                    if (shortfall > 0 && !txData.fundingLoanAmount) {
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

        if(room.bankingAuthority==='server-banking-v1')return completeOpportunityCard(eventId,cardId,'accept',assetId?{assetId}:{});
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

    const completeOpportunityCard = async (eventId:string,cardId:string,choice:'accept'|'dismiss',payload:{assetId?:string;fundingLoanAmount?:number;forcedDebtAmount?:number}={}):Promise<BoardFinancialMutationResult> => {
        if(!room?.id||!user||!canMutateCurrentRoom()||room.bankingAuthority!=='server-banking-v1')return {status:'failed',message:'目前分頁或房間無法提交機運卡'};
        try{return await submitServerGameCommand<BoardFinancialMutationResult>({type:'opportunityCard',roomId:room.id,sessionId:room.sessionId,eventId,cardId,choice,commandId:`opportunity:${room.sessionId}:${eventId}:${choice}`,...payload});}
        catch(error:any){return {status:isUncertainGameCommandError(error)?'waiting':'failed',message:error?.message||'機運卡尚待確認'};}
    };

    const submitMedicalCardOperation = async (data:{type:'payMedicalCard'|'finishMedicalCard'|'claimMedical';commandId:string;eventId?:string;cardId?:string;claimId?:string;fundingLoanAmount?:number;forcedDebtAmount?:number}):Promise<BoardFinancialMutationResult> => {
        if(!room?.id||!user||!canMutateCurrentRoom())return {status:'failed',message:'目前分頁或房間無法提交'};
        try{return await submitServerGameCommand<BoardFinancialMutationResult>({...data,roomId:room.id,sessionId:room.sessionId});}
        catch(error:any){const status=isUncertainGameCommandError(error)?'waiting':'failed';setError(error?.message||'醫療事件尚待確認');return {status,message:error?.message||'醫療事件尚待確認'};}
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

        if(room.bankingAuthority==='server-banking-v1'){
            const sourceEventId=txData.boardSourceEventId||eventId,sourceCardId=txData.boardSourceCardId||cardId;
            return submitMedicalCardOperation({type:'payMedicalCard',eventId:sourceEventId,cardId:sourceCardId,commandId:`medical-pay:${room.sessionId}:${sourceEventId}`,...(txData.fundingLoanAmount?{fundingLoanAmount:txData.fundingLoanAmount}:{}),...(txData.forcedDebtAmount?{forcedDebtAmount:txData.forcedDebtAmount}:{})});
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

    const updateMarket = async (updates: Record<string, number>, code: string, isBubble: boolean = false, originalCommandId?: string) => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁無法提交，請確認遊戲版本及操作控制權');
        if (!room || user?.role !== 'coach') throw new Error('只有執行師可以發布行情');
        try {
            const roomRef = doc(db, 'rooms', room.id);
            const commandId = originalCommandId || `coach-market:${user.uid}:${crypto.randomUUID()}`;
            if(room.bankingAuthority==='server-banking-v1')return submitCoachFinancialCommand(commandId,{type:'coachMarket',code});
            const timestamp = serverNow();
            const sessionId = room.sessionId;
            const nextMarketState = await executeWithLock(() => runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const snapshot = await transaction.get(roomRef);
                if (!snapshot.exists()) throw new Error('房間不存在');
                const latest = snapshot.data() as Room;
                if (latest.sessionId !== sessionId || latest.status !== 'playing') throw new Error('場次已變更或尚未開始');
                const effectRef = doc(db, 'rooms', room.id, 'financialEffects', encodeURIComponent(commandId));
                if (latest.flowSchemaVersion === 1) {
                    const previous = await transaction.get(effectRef);
                    if (previous.exists()) return {marketUpdates: previous.data().payload, marketPrices: previous.data().payload.updates, previousMarketPrices: latest.previousMarketPrices};
                }
                const currentPrices = latest.marketPrices || {};
                const nextPrices = normalizeMarketPrices(updates, currentPrices);
                const patch = {marketUpdates: {updates: nextPrices, code, isBubble, timestamp}, previousMarketPrices: currentPrices, marketPrices: nextPrices};
                transaction.update(roomRef, patch);
                if (latest.flowSchemaVersion === 1) transaction.set(effectRef, {id: commandId, sessionId, kind: 'market', timestamp,
                    sourcePlayerUid: user.uid, payload: patch.marketUpdates});
                return patch;
            })), commandId);

            if(activeRoomScopeRef.current!==getRoomSessionScope(room))return;
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
        return executeWithLock(async () => {
            if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
                throw new Error('棋盤房間尚未準備完成');
            }
            if(room.promptCompletionAuthority==='server-prompts-v1') {
                if(!canMutateCurrentRoom())throw new Error('此分頁目前無法提交翻牌');
                return submitServerGameCommand<BoardCardRevealResult>({type:'revealCard',roomId:room.id,sessionId:room.sessionId,eventId,cardId,commandId:`reveal:${eventId}:${cardId}:atomic`});
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
                readPromptResponses: false,
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
        }, `reveal:${room?.id}:${eventId}:${cardId}`);
    };

    const advanceBoardEventQueue = async (expectedType?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup', expectedEventId?:string) => executeWithLock(async () => {
        if(room?.bankingAuthority==='server-banking-v1'&&(expectedType==='hospital'||expectedType==='repair')) {
            if(!user||!canMutateCurrentRoom()||(!expectedEventId&&room.boardState?.currentEvent?.type!==expectedType))return false;
            const eventId=expectedEventId||room.boardState!.currentEvent!.id;
            try {const result=await submitServerGameCommand<{status:string;message?:string}>({type:'finishService',roomId:room.id,sessionId:room.sessionId,eventId,kind:expectedType,commandId:`service-finish:${room.sessionId}:${eventId}`});if(!['applied','duplicate'].includes(result.status)){setError(result.message||'格子事件尚未完成');return false;}return true;}
            catch(error:any){setError(error?.message||'格子事件尚未確認');return false;}
        }
        if(room?.bankingAuthority==='server-banking-v1'&&expectedType==='school') {
            if(!user||!canMutateCurrentRoom()||!room.boardState?.currentEvent)return false;
            const eventId=room.boardState.currentEvent.id;
            try {
                const result=await submitServerGameCommand<{status:string;message?:string}>({type:'skipSchool',roomId:room.id,sessionId:room.sessionId,eventId,commandId:`school-skip:${room.sessionId}:${eventId}`});
                if(!['applied','duplicate'].includes(result.status)){setError(result.message||'學校流程尚未完成');return false;}
                return true;
            } catch(error:any){setError(error?.message||'學校流程尚未完成');return false;}
        }

        if (!room?.id || !room.isBoardGame || !room.boardState) return false;

        const { boardState } = room;
        if(expectedEventId&&boardState.currentEvent?.id!==expectedEventId)return false;
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
                updatedAt: serverNow()
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

    }, `advance:${room?.id}:${room?.boardState?.currentEvent?.id}:${expectedType || 'event'}`);

    // 回合不再於事件結算後自動切換，玩家必須自己確認所有動作都完成後按下
    // 「結束回合」才會真正換到下一位，比照大富翁的回合節奏。
    const endTurn = async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
            throw new Error('棋盤房間尚未同步完成');
        }
        const commandId = `turn-end:${user.uid}:${room.boardState.revision || 0}`;
        if(room.movementAuthority==='server-movement-v1') {
            const result=await submitServerGameCommand<any>({type:'endTurn',roomId:room.id,sessionId:room.sessionId,commandId,revision:room.boardState.revision||0});
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.message||'回合尚未完成');
            return;
        }


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

        if(room.bankingAuthority==='server-banking-v1'&&HAPPINESS_CARD_MAP[cardId]?.requiresStorySharing) {
            const approved=Object.values(pendingRequests).some(r=>r.type==='happiness'&&r.boardEventId===eventId&&r.status==='approved');
            const type=approved?'finishStory':'declineStory';
            return submitSharingOperation({type,eventId,cardId,commandId:`${type}:${room.sessionId}:${eventId}`});
        }
        const happiness=HAPPINESS_CARD_MAP[cardId];
        if(room.bankingAuthority==='server-banking-v1'&&happiness&&(happiness.category!=='家庭重要歷程'||!boardState.familyMilestoneJoinPrompt)&&!happiness.requiresStorySharing){
            const result=await submitHappinessCardOperation(eventId,cardId,'dismiss');return ['applied','duplicate'].includes(result.status);
        }
        if(room.bankingAuthority==='server-banking-v1'&&OPPORTUNITY_CARD_MAP[cardId]?.type==='medical'){
            const result=await submitMedicalCardOperation({type:'finishMedicalCard',eventId,cardId,commandId:`medical-finish:${room.sessionId}:${eventId}`});return ['applied','duplicate'].includes(result.status);
        }
        if(room.bankingAuthority==='server-banking-v1'&&isStandaloneOpportunityCard(cardId)){const result=await completeOpportunityCard(eventId,cardId,'dismiss');return ['applied','duplicate'].includes(result.status);}
        if(room.bankingAuthority==='server-banking-v1'&&cardId==='C054')return submitSharingOperation({type:'declineFollowup',cardId,eventId,commandId:`followup-decline:${room.sessionId}:${eventId}`});
        if (!isCurrentCard) return false;
        if(room.bankingAuthority==='server-banking-v1'&&boardState.currentCard?.deck==='news'&&NEWS_CARD_MAP[cardId]?.type==='real_estate'){
            if(!user||!canMutateCurrentRoom())return false;
            const result=await submitServerBanking(room,user.uid,`real-estate-decline:${room.sessionId}:${eventId}`,{type:'declineRealEstate',eventId,cardId});
            if(!['applied','duplicate'].includes(result.status)){setError(result.message||'不動產卡片尚未結案');return false;}return true;
        }
        if(room.bankingAuthority==='server-banking-v1'&&boardState.currentCard?.deck==='news'&&NEWS_CARD_MAP[cardId]?.type==='stock_price'){
            if(!user||!canMutateCurrentRoom())return false;
            try{
                const result=await submitServerGameCommand<{status:string;message?:string}>({type:'finishMarket',roomId:room.id,sessionId:room.sessionId,eventId,cardId,commandId:`market-finish:${room.sessionId}:${eventId}`});
                if(!['applied','duplicate'].includes(result.status)){setError(result.message||'股市事件尚未結案');return false;}return true;
            }catch(error:any){setError(error?.message||'股市事件尚未結案');return false;}
        }
        if(room.bankingAuthority==='server-banking-v1'&&cardId==='C056')return submitSharingOperation({type:'declineFollowup',eventId,commandId:`followup-decline:${room.sessionId}:${eventId}`});
        if(room.bankingAuthority==='server-banking-v1'&&boardState.currentCard?.deck==='opportunity'&&['ability_profession','ability_stock','ability_realestate'].includes(OPPORTUNITY_CARD_MAP[cardId]?.type)) {
            const type=boardState.pendingContinuation?.kind==='lifelong-learning'?'finishLearning':'declineLearning';
            try {
                const result=await submitServerGameCommand<{status:string;message?:string}>({type,roomId:room.id,sessionId:room.sessionId,eventId,commandId:`${type}:${room.sessionId}:${eventId}`});
                if(!['applied','duplicate'].includes(result.status)){setError(result.message||'學習卡尚未完成');return false;}
                return true;
            }catch(error:any){setError(error?.message||'學習卡尚未完成');return false;}
        }

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

                if (currentBoardState.pendingContinuation && currentBoardState.pendingContinuation.phase !== 'completed') {
                    return { boardState: currentBoardState, commit: false, result: false };
                }
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
                    updatedAt: serverNow()
                }, commandId).boardState;
                const { boardState: _nextBoard, playerStates, ...roomPatch } = nextState as Room;
                return {
                    boardState: { ...committedBoard, pendingContinuation: currentBoardState.pendingContinuation?.phase === 'completed' ? null : currentBoardState.pendingContinuation },
                    roomPatch: {
                        ...roomPatch,
                        ...(playerStates ? { playerStates } : {})
                    },
                    result: true
                };
            }
        });
    }, `dismiss:${room?.id}:${eventId}:${cardId}`)) ?? false;

    const drawPostExamHappinessCard = async (success: boolean) => {
        if(room?.bankingAuthority==='server-banking-v1') {
            if(!user||!canMutateCurrentRoom()||!room.boardState?.currentEvent)return false;
            const eventId=room.boardState.currentEvent.id;
            const result=await submitServerGameCommand<{status:string;message?:string}>({type:'finishSchool',roomId:room.id,sessionId:room.sessionId,eventId,commandId:`school-finish:${room.sessionId}:${eventId}`});
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.message||'考試接續尚未完成');
            return true;
        }

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

            const timestamp = serverNow();
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

    const drawBoardFollowupCard = async (deck: 'happiness' | 'news', summary: string, detail?: string): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room?.id || !room.isBoardGame || !user) return false;
        const pending = room.boardState?.pendingContinuation;
        const sourceEventId = pending?.kind === 'followup-card' ? pending.sourceEventId : room.boardState?.currentEvent?.id;
        const commandId = `draw-followup:${sourceEventId || 'none'}:${deck}`;
        if(room.bankingAuthority==='server-banking-v1'&&pending?.cardId==='C056')return submitSharingOperation({type:'drawFollowup',eventId:sourceEventId,commandId});

        // H1：同 drawPostExamHappinessCard，改用交易避免用過期的本地 deckState
        // 快照覆寫掉並發寫入的 boardState，或抽到已經被抽走的卡片。
        try { return await runRoomBoardMutation({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            onDuplicate: () => true,
            mutate: (currentRoom, currentBoardState) => {
                const continuation = currentBoardState.pendingContinuation;
                if (continuation?.kind === 'followup-card' && continuation.commandId === commandId && continuation.phase === 'completed') return {boardState:currentBoardState,commit:false,result:true};
                if (currentBoardState.currentEvent?.id !== sourceEventId || currentBoardState.currentTurnUid !== user.uid || currentBoardState.currentEvent.playerUid !== user.uid) throw new Error('後續抽卡事件已更新');
                if (currentRoom.flowSchemaVersion === 1 && currentBoardState.currentCard?.cardId === 'C056' && continuation?.kind !== 'followup-card') throw new Error('分享尚未核准，待抽卡未建立');
                if (continuation?.kind === 'followup-card' && (continuation.deck !== deck || continuation.playerUid !== user.uid || continuation.sessionId !== currentRoom.sessionId)) throw new Error('待抽卡資料不符');
                const drawResult = drawBoardCard(currentBoardState.deckState, deck, currentRoom.playerStates?.[user.uid]);
                if (!drawResult) throw new Error('找不到可抽的後續卡片，待辦已保留');

            const timestamp = serverNow();
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
                pendingContinuation: continuation?.kind === 'followup-card' ? {...continuation,phase:'completed' as const,result:{eventId,cardId:drawResult.card.cardId}} : continuation,
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
                return { boardState: nextBoard, result: true };
            }
        }); } catch (error: any) { setError(error?.message || '後續抽卡失敗，待辦已保留'); return false; }
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
                    createdAt: serverNow()
                };
                return {
                    boardState: { ...latestBoard, familyMilestoneJoinPrompt: prompt, updatedAt: serverNow() },
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
                        createdAt: serverNow()
                    };
                    return {
                        boardState: { ...latestBoard, sharedCardPrompt: prompt, updatedAt: serverNow() },
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

const finalizeFamilyMilestoneJoinPrompt = useCallback(async (promptId: string) => {
        if (room?.promptCompletionAuthority === 'server-prompts-v1') {
            const result = await safeAsync(finalizeServerPrompt(room, promptId), null);
            return result?.status === 'applied' || result?.status === 'duplicate';
        }
        if (!room?.id || !user) return false;
        if (room.hostId !== user.uid && user.role !== 'coach' && user.role !== 'gm') return false;

        const result = await safeAsync(runRoomBoardMutation<boolean, Room>({
            db,
            roomId: room.id,
            commandId: `prompt:family:finalize:${promptId}:${user.uid}`,
            readPromptResponses: true,
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
}, [room?.id, room?.hostId, room?.sessionId, room?.promptCompletionAuthority, room?.boardState?.currentEvent?.id, user?.uid, user?.role]);

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
                    const delay = Math.max(0, presentationReadyAt - serverNow()) + 50;
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
            ? onResponseSnapshot(responsesRef, snapshot => {
                handleResponses(Object.fromEntries(
                    snapshot.docs.map(responseDoc => [responseDoc.id, responseDoc.data() as FamilyMilestoneJoinResponse])
                ));
            }, handleError)
            : onResponseSnapshot(doc(db, 'rooms', room.id, 'events', prompt.id, 'responses', user.uid), snapshot => {
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

        if(room.promptCompletionAuthority==='server-prompts-v1') {
            try {
                const result=await submitServerGameCommand<{response:FamilyMilestoneJoinResponse}>({type:'familyRespond',roomId:room.id,sessionId:room.sessionId,eventId:prompt.sourceEventId,promptId:prompt.id,commandId:`family-response:${prompt.id}:${user.uid}`,choice:payload.status==='declined'?'decline':'roll'});
                return result.response;
            } catch(error:any) {familyJoinSubmitErrorRef.current=error?.message||'家庭回覆未確認';setError(familyJoinSubmitErrorRef.current);return false;}
        }
        let shouldFinalizeFamilyPrompt = false;
        familyJoinSubmitErrorRef.current = '';
        let result: FamilyMilestoneJoinResponse | false;
        if (room.syncSchemaVersion === 2 && prompt.responseStorage === 'subcollection') {
            try {
                const submitted = await submitFamilyMilestoneResponse({
                    db,
                    roomId: room.id,
                    promptId: payload.promptId,
                    uid: user.uid,
                    playerName: user.name || '玩家',
                    cardId: payload.cardId,
                    status: payload.status,
                    roll: payload.roll
                });
                result = submitted.response;
                if (submitted.prompt?.id === payload.promptId) {
                    const nextPrompt = {
                        ...submitted.prompt,
                        responses: { ...(submitted.prompt.responses || {}), [user.uid]: result }
                    };
                    shouldFinalizeFamilyPrompt = nextPrompt.sourceActionCompleted === true &&
                        !hasIncompleteSharedPrompts({ ...room.boardState, familyMilestoneJoinPrompt: nextPrompt });
                }
            } catch (err: any) {
                familyJoinSubmitErrorRef.current = err?.code ? `${err.code}: ${err.message || ''}` : (err?.message || '');
                setError(err?.message || '家庭重要歷程回覆失敗');
                return false;
            }
        } else {
            result = await safeAsync(runRoomBoardMutation<FamilyMilestoneJoinResponse | false, Room>({
            db,
            roomId: room.id,
            commandId: `prompt:family:response:${payload.promptId}:${user.uid}`,
            playerStateUids: payload.status === 'passed' ? [user.uid] : [],
            responseReadUid: prompt.responseStorage === 'subcollection' ? user.uid : undefined,
            forcePrivatePlayerStates: payload.status === 'passed',
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
                const responseTimestamp = serverNow();
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
        }
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
        if(room.promptCompletionAuthority==='server-prompts-v1') {
            const response=await submitFamilyMilestoneJoinResponse({promptId,cardId,status:'failed'});
            if(!response || response.roll===undefined || !['passed','failed'].includes(response.status))throw new Error(familyJoinSubmitErrorRef.current||'家庭骰點尚未確認');
            return {roll:response.roll,status:response.status as 'passed'|'failed',presentationReadyAt:response.presentationReadyAt||getFamilyDicePresentationReadyAt(response.respondedAt)};
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
            presentationReadyAt: submitted.presentationReadyAt || getFamilyDicePresentationReadyAt(submitted.respondedAt || serverNow())
        };
    };

    const confirmServerFamilyAction = async (promptId:string):Promise<boolean> => {
        if(!room || !user)return false;
        try {
            const result=await submitServerGameCommand<{status:string;message?:string}>({type:'familyConfirm',roomId:room.id,sessionId:room.sessionId,eventId:promptId,promptId,commandId:`family-confirm:${promptId}:${user.uid}`});
            if(result.status==='waiting'){setError(result.message||'家庭歷程結果尚待確認');return false;}
            return result.status==='duplicate';
        } catch(error:any){setError(error?.message||'家庭歷程結果尚待確認');return false;}
    };

    const clearPendingFamilyMilestoneJoinAction = async (promptId: string) => {
        if(room?.promptCompletionAuthority==='server-prompts-v1')return confirmServerFamilyAction(promptId);
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
            retryOnPermissionDenied: false,
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
                        updatedAt: serverNow()
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
        if(room?.promptCompletionAuthority==='server-prompts-v1')return confirmServerFamilyAction(promptId);
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
                    boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: serverNow() },
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

        if(room.promptCompletionAuthority==='server-prompts-v1') {
            const prompt=room.boardState?.familyMilestoneJoinPrompt;
            if(!prompt || prompt.id!==payload.promptId)return failedResult('家庭歷程事件已更新');
            try {return await submitServerGameCommand<{status:'applied'|'duplicate'|'requires_funding'|'waiting'|'failed';shortfall?:number;message?:string}>({type:'familyAction',roomId:room.id,sessionId:room.sessionId,eventId:prompt.sourceEventId,...payload,commandId:`family-action:${prompt.id}:${user.uid}:${payload.accepted?'accept':'decline'}`});}
            catch(error:any){return {status:isUncertainGameCommandError(error)?'waiting' as const:'failed' as const,message:error?.message||'家庭歷程結果尚待確認'};}
        }

        try {
            const result = await runRoomBoardMutation<{
                status: 'applied' | 'duplicate' | 'requires_funding' | 'waiting' | 'failed';
                shortfall?: number;
                message?: string;
                finalizeSource?: boolean;
            }, Room>({
                db,
                roomId: room.id,
                commandId: `family-action:${payload.promptId}:${user.uid}:${payload.accepted ? 'accept' : 'decline'}`,
                writeBoardState: !(room.boardState?.familyMilestoneJoinPrompt?.responseStorage === 'subcollection' && room.boardState.familyMilestoneJoinPrompt.sourcePlayerUid !== user.uid && room.financialHistoryStorage === 'subcollection'),
                playerStateUids: [user.uid],
                responseReadUid: room.boardState?.familyMilestoneJoinPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
                forcePrivatePlayerStates: true,
                retryOnPermissionDenied: false,
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
                            serverNow(),
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

                    // v2 參與者只入帳並完成自己的回覆，房主讀齊回覆後結案。
                    if (!isSource && prompt.responseStorage === 'subcollection' && latestRoom.financialHistoryStorage === 'subcollection') {
                        return { boardState: latestBoard, roomPatch,
                            sharedResponse: { uid: user.uid, response: nextPrompt.responses[user.uid] }, result: { status } };
                    }

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
                        boardState: { ...latestBoard, familyMilestoneJoinPrompt: nextPrompt, updatedAt: serverNow() },
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
                retryOnPermissionDenied: false,
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

    const submitServerSharedAction = async (promptId:string,choice:'accept'|'decline'|'no_effect',selection:Record<string,unknown>={}):Promise<BoardFinancialMutationResult> => {
        if(!room||!user||!canMutateCurrentRoom())return {status:'failed',message:'目前分頁無法提交共享操作'};
        const prompt=room.boardState?.sharedCardPrompt;
        if(prompt?.id!==promptId)return {status:'failed',message:'共享事件已更新，請核對最新狀態'};
        try {
            return await submitServerGameCommand<BoardFinancialMutationResult>({type:'sharedAction',roomId:room.id,sessionId:room.sessionId,eventId:prompt.sourceEventId,promptId,commandId:`shared:${room.sessionId}:${promptId}:${user.uid}`,choice,...selection});
        }catch(error:any){const message=error?.message||'共享操作尚未確認，請保留原選擇重試',code=String(error?.code||'internal').replace(/^functions\//,'');setError(message);return {status:isUncertainGameCommandError(error)?'waiting':'failed',code,message};}
    };

    const submitSharedCardPromptResponse = async (payload: {
        promptId: string;
        status: 'completed' | 'declined' | 'no_effect';
        amount?: number;
        selectedAssetIds?: string[];
        note?: string;
    }): Promise<boolean> => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return false;
        if(room.promptCompletionAuthority==='server-prompts-v1') {
            if(payload.status==='completed'){setError('共享財務尚未確認，請從本人財務檢核完成');return false;}
            const result=await submitServerSharedAction(payload.promptId,payload.status==='declined'?'decline':'no_effect');
            return result.status==='applied'||result.status==='duplicate';
        }

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
            respondedAt: serverNow()
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
                    // Rules validate the active prompt and membership atomically at commit.
                    // Reading the room here makes unrelated responses contend with event finalization.
                    const responseSnapshot = await transaction.get(responseRef);
                    if (responseSnapshot.exists()) return;

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
            retryOnPermissionDenied: false,
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
                        boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: serverNow() },
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
                        boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: serverNow() },
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
                        updatedAt: serverNow()
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
                    updatedAt: serverNow()
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
        if(room.promptCompletionAuthority==='server-prompts-v1')return submitServerSharedAction(promptId,'accept',{amount:txData.amount,...(txData.fundingLoanAmount?{fundingLoanAmount:txData.fundingLoanAmount}:{}),...(txData.forcedDebtAmount?{forcedDebtAmount:txData.forcedDebtAmount}:{})});
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
                    respondedAt: serverNow(), commandId
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
                if (result.status === 'applied' && result.state) writePrivateFinancialState(transaction,db,room.id,user.uid,playerSnapshot.data() as GameState,result.state,latestRoom,commandId,{status:"applied"});
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

    const completeManualFinancialTransaction = (txData:TransactionData):Promise<BoardFinancialMutationResult> => {
        const handler=getPersonalFinancialHandler(txData);
        const handlers={completeTargetEnterprisePurchase,completeDreamPurchase,completeAssetSale,completeInsurancePurchase,completeDepositPurchase,completeStockTrade,completeLoanBorrow,completeLoanRepayment,completeDepositWithdrawal,completeCarPurchase};
        return handler?handlers[handler](txData):Promise.resolve({status:'failed',code:'unsupported-server-operation',message:'此交易尚未有受驗證的後端處理，未提交入帳'});
    };

    const completePlayerOnlyTransaction = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if(room?.bankingAuthority==='server-banking-v1')return completeManualFinancialTransaction(txData);
        const operationId=txData.boardEventId || txData.commandId;
        if(!operationId) return {status:'failed',message:'交易缺少識別碼，請重新操作'};
        const commandId=`fin-player:${room?.sessionId || room?.id}:${user?.uid}:${operationId}`;
        return runPersonalFinance(commandId,(state,latestRoom)=>{
            const result=applyBoardTransaction(state,{...txData,boardEventId:operationId},{now:serverNow(),generateId:createSequentialIdGenerator(commandId),financialAcceleration:latestRoom.financialAcceleration});
            if(result.status==='error') return result.code==='insufficient_cash' ? {status:'requires_funding',shortfall:result.shortfall,message:result.message} : {status:'failed',message:result.message};
            return result.status==='duplicate' ? {status:'duplicate'} : {status:'applied',state:result.state};
        });
    };

    const completeSharedTransactionAction = async (
        promptId: string,
        txData: TransactionData,
        responseMeta: { status: 'completed' | 'no_effect'; amount?: number; note?: string }
    ): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };

        const commandId = `shared-tx:${promptId}:${user.uid}`;
        if(room.promptCompletionAuthority==='server-prompts-v1')return submitServerSharedAction(promptId,'accept',{...(txData.fundingLoanAmount?{fundingLoanAmount:txData.fundingLoanAmount}:{}),...(txData.forcedDebtAmount?{forcedDebtAmount:txData.forcedDebtAmount}:{})});
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
                        now: serverNow(),
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
                    respondedAt: serverNow(), commandId
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
                if (result.status === 'applied') writePrivateFinancialState(transaction,db,room.id,user.uid,playerSnapshot.data() as GameState,result.state,latestRoom,commandId,{status:"applied"});
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
        if(room.promptCompletionAuthority==='server-prompts-v1'){const result=await submitServerSharedAction(promptId,'accept');return result.status==='applied'||result.status==='duplicate';}
        if (room.syncSchemaVersion === 2 && room.boardState?.sharedCardPrompt?.responseStorage === 'subcollection') {
            try {
                return await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                    const roomRef = doc(db, 'rooms', room.id);
                    const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
                    const responseRef = doc(db, 'rooms', room.id, 'events', promptId, 'responses', user.uid);
                    const [roomSnapshot, playerSnapshot, responseSnapshot] = await Promise.all([
                        transaction.get(roomRef), transaction.get(playerRef), transaction.get(responseRef)
                    ]);
                    if (!roomSnapshot.exists()) return false;

                    const latestRoom = roomSnapshot.data() as Room;
                    const prompt = latestRoom.boardState?.sharedCardPrompt;
                    if (responseSnapshot.exists() || prompt?.responses?.[user.uid]) return true;
                    if (latestRoom.status !== 'playing' || latestRoom.sessionId !== room.sessionId ||
                        !latestRoom.boardState || !prompt || prompt.id !== promptId ||
                        prompt.kind !== 'startup_loan' || !prompt.targetPlayerUids.includes(user.uid)) {
                        return false;
                    }
                    if (!playerSnapshot.exists()) throw new Error('玩家資料尚未同步完成');

                    const mutation = buildStartupLoanPromptMutation(
                        {
                            ...latestRoom,
                            playerStates: { ...(latestRoom.playerStates || {}), [user.uid]: playerSnapshot.data() as GameState }
                        },
                        latestRoom.boardState,
                        promptId,
                        user.uid,
                        user.name || '玩家',
                        commandId
                    );
                    const nextPlayerState = mutation.roomPatch?.playerStates?.[user.uid];
                    const response = mutation.sharedResponse?.response;
                    if (mutation.result !== true || !nextPlayerState || !response) return false;

                    writePrivateFinancialState(transaction,db,room.id,user.uid,playerSnapshot.data() as GameState,nextPlayerState,latestRoom,commandId,true);
                    transaction.set(responseRef, cleanObject({ ...response, promptId, commandId }));
                    return true;
                }));
            } catch (err: any) {
                setError(err?.message || '創業貸款同步失敗');
                return false;
            }
        }

        const result = await safeAsync(runRoomBoardMutation<boolean, Room>({
            db,
            roomId: room.id,
            commandId,
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            // Players may only read their own v2 response document.
            responseReadUid: room.boardState?.sharedCardPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
            retryOnPermissionDenied: false,
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
        if(room.promptCompletionAuthority==='server-prompts-v1')return submitServerSharedAction(promptId,'accept',{selectedAssetIds});
        try {
            if (room.syncSchemaVersion === 2 && room.boardState?.sharedCardPrompt?.responseStorage === 'subcollection') {
                return await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                    const roomRef = doc(db, 'rooms', room.id);
                    const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
                    const responseRef = doc(db, 'rooms', room.id, 'events', promptId, 'responses', user.uid);
                    const [roomSnapshot, playerSnapshot, responseSnapshot] = await Promise.all([
                        transaction.get(roomRef), transaction.get(playerRef), transaction.get(responseRef)
                    ]);
                    if (!roomSnapshot.exists()) return { status: 'failed' as const, message: '房間不存在或已關閉' };

                    const latestRoom = roomSnapshot.data() as Room;
                    const prompt = latestRoom.boardState?.sharedCardPrompt;
                    if (responseSnapshot.exists() || prompt?.responses?.[user.uid]) return { status: 'duplicate' as const };
                    if (latestRoom.status !== 'playing' || latestRoom.sessionId !== room.sessionId ||
                        !latestRoom.boardState || !prompt || prompt.id !== promptId || prompt.kind !== 'asset_sale' ||
                        !prompt.targetPlayerUids.includes(user.uid)) {
                        return { status: 'failed' as const, message: '共享出售事件已更新，請重新開啟卡片' };
                    }
                    if (!playerSnapshot.exists()) return { status: 'failed' as const, message: '玩家資料尚未同步完成' };

                    const mutation = buildSharedAssetSalePromptMutation(
                        {
                            ...latestRoom,
                            playerStates: { ...(latestRoom.playerStates || {}), [user.uid]: playerSnapshot.data() as GameState }
                        },
                        latestRoom.boardState,
                        promptId,
                        user.uid,
                        user.name || '玩家',
                        selectedAssetIds,
                        commandId
                    );
                    const nextPlayerState = mutation.roomPatch?.playerStates?.[user.uid];
                    const response = mutation.sharedResponse?.response;
                    if (mutation.result.status !== 'applied' || !nextPlayerState || !response) return mutation.result;

                    writePrivateFinancialState(transaction,db,room.id,user.uid,playerSnapshot.data() as GameState,nextPlayerState,latestRoom,commandId,true);
                    transaction.set(responseRef, cleanObject({ ...response, promptId, commandId }));
                    return mutation.result;
                }));
            }

            return await runRoomBoardMutation<BoardFinancialMutationResult, Room>({
                db,
                roomId: room.id,
                commandId,
                playerStateUids: [user.uid],
                responseReadUid: room.boardState?.sharedCardPrompt?.responseStorage === 'subcollection' ? user.uid : undefined,
                retryOnPermissionDenied: false,
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
        const commandId = data.commandId || data.boardEventId || `target-enterprise:${room.sessionId || room.id}:${user.uid}:${enterpriseId}`;
        if(room.bankingAuthority==='server-banking-v1')return submitServerBanking(room,user.uid,commandId,{type:'purchaseEnterprise',enterpriseId,fundingLoanAmount:data.fundingLoanAmount,forcedDebtAmount:data.forcedDebtAmount});
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

    const submitHappinessCardOperation = async (eventId:string,cardId:string,choice:'accept'|'dismiss',fundingLoanAmount?:number):Promise<BoardFinancialMutationResult> => {
        if(!room?.id||!user||!canMutateCurrentRoom())return {status:'failed',message:'目前分頁或房間無法提交'};
        try{return await submitServerGameCommand<BoardFinancialMutationResult>({type:'happinessCard',roomId:room.id,sessionId:room.sessionId,eventId,cardId,choice,commandId:`happiness:${room.sessionId}:${eventId}:${choice}`,...(fundingLoanAmount?{fundingLoanAmount}:{})});}
        catch(error:any){const status=isUncertainGameCommandError(error)?'waiting':'failed';setError(error?.message||'幸福卡尚待確認');return {status,message:error?.message||'幸福卡尚待確認'};}
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

        if(room.bankingAuthority==='server-banking-v1')return submitHappinessCardOperation(eventId,cardId,'accept');
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

    const runPersonalFinance = (commandId: string, apply: (state: GameState, latestRoom: Room) => BoardFinancialMutationResult & {state?:GameState}) => {
        if (!canMutateCurrentRoom() || !room?.id || !user) return Promise.resolve({status:'failed' as const,message:'目前分頁或房間無法提交'});
        if(room.bankingAuthority==='server-banking-v1')return Promise.resolve({status:'failed' as const,code:'unsupported-server-operation',message:'這項財務操作尚未移轉後端，未提交本機交易'});
        return runPrivateFinancialCommand<Room>({db,roomId:room.id,uid:user.uid,commandId,sessionId:room.sessionId,apply});
    };

    const completeInsurancePurchase = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        const operationId = txData.commandId || txData.boardEventId;
        if (!operationId) return {status:'failed',message:'保險交易缺少操作識別碼'};
        const commandId = `insurance:${room?.sessionId || room?.id}:${user?.uid}:${operationId}`;
        if(room?.bankingAuthority==='server-banking-v1'){
            if(!user||!canMutateCurrentRoom())return {status:'failed',message:'目前無法提交保險交易'};
            return submitServerBanking(room,user.uid,commandId,{type:'purchaseInsurance',insuranceType:txData.insuranceType as 'medical'|'house'|'aircraft',...(txData.insuranceType==='house'?{targetAssetIds:txData.insurancePayload?.targetAssetIds}: {})});
        }
        return runPersonalFinance(commandId, (state, latestRoom) => {
            if (!state.bankServiceWindowActive && !isCurrentPlayerBankEvent(latestRoom.boardState!,user!.uid)) return {status:'failed',message:'請先經過銀行以辦理保險'};
            return {status:'applied',state:buildInsurancePurchaseState(state,txData,commandId)};
        });
    };

    const completeDepositPurchase = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        const operationId = txData.commandId || txData.boardEventId;
        if (!operationId) return {status:'failed',message:'定存交易缺少操作識別碼'};
        const commandId = `deposit:${room?.sessionId || room?.id}:${user?.uid}:${operationId}`;
        if(room?.bankingAuthority==='server-banking-v1'){
            if(!user||!canMutateCurrentRoom())return {status:'failed',message:'目前無法提交定存交易'};
            return submitServerBanking(room,user.uid,commandId,{type:'purchaseDeposit',amount:Number(txData.amount)});
        }
        return runPersonalFinance(commandId, (state, latestRoom) => {
            if (!state.bankServiceWindowActive && !isCurrentPlayerBankEvent(latestRoom.boardState!,user!.uid)) return {status:'failed',message:'請先經過銀行以辦理定存'};
            if (state.cash+txData.cashChange<0) return {status:'requires_funding',shortfall:Math.abs(state.cash+txData.cashChange),message:'現金不足，無法辦理定存'};
            return {status:'applied',state:buildDepositPurchaseState(state,txData,commandId)};
        });
    };

    const completeDreamPurchase = async (txData:TransactionData):Promise<BoardFinancialMutationResult> => {
        if(!room||!user||!canMutateCurrentRoom()||(!txData.commandId&&!txData.boardEventId))return {status:'failed',message:'夢想付款缺少操作識別碼或資格'};
        const dreamId=room.playerStates?.[user.uid]?.selectedDream?.id;
        if(!dreamId)return {status:'failed',message:'夢想選擇尚未同步，請保留操作'};
        return submitServerBanking(room,user.uid,`dream:${room.sessionId||room.id}:${user.uid}:${txData.commandId||txData.boardEventId}`,{type:'purchaseDream',dreamId});
    };

    const completeAssetSale = async (txData:TransactionData):Promise<BoardFinancialMutationResult> => {
        if(!room||!user||!canMutateCurrentRoom()||(!txData.commandId&&!txData.boardEventId))return {status:'failed',message:'資產出售缺少操作識別碼或資格'};
        const commandId=`asset-sale:${room.sessionId||room.id}:${user.uid}:${txData.commandId||txData.boardEventId}`;
        return submitServerBanking(room,user.uid,commandId,{type:'sellAssets',sales:txData.batchSellList?.map(item=>({assetId:item.asset.id,price:item.price}))});
    };

    const completeStockTrade = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!txData.commandId && !txData.boardEventId) return {status:'failed',message:'股票交易缺少操作識別碼'};
        const commandId=`stock:${room?.sessionId || room?.id}:${user?.uid}:${txData.commandId || txData.boardEventId}`;
        if(room?.bankingAuthority==='server-banking-v1'){
            if(!user||!canMutateCurrentRoom())return {status:'failed',message:'目前無法提交股票交易'};
            if(!['asset','cash'].includes(txData.usage))return {status:'failed',message:'股票買賣方向無效'};
            return submitServerBanking(room,user.uid,commandId,{type:'tradeStock',mode:txData.usage==='asset'?'buy':'sell',trades:txData.stockList?.map(t=>({symbol:t.symbol,qty:t.qty,expectedPrice:t.price}))});
        }
        return runPersonalFinance(commandId,state=>({status:'applied',state:buildStockTradeState(state,txData,commandId)}));
    };

    const runPlayerFinancialCommand = async (params: {
        commandId: string;
        failureLabel: string;
        apply: (
            state: GameState,
            latestRoom: Room
        ) => { status: 'applied'; state: GameState; boardState?: BoardState }
            | { status: 'duplicate' }
            | { status: 'requires_funding'; shortfall?: number; message?: string }
            | { status: 'failed'; message: string };
    }): Promise<BoardFinancialMutationResult> => {
        if (!canMutateCurrentRoom()) return { status: 'failed', message: '此分頁目前為唯讀' };
        if (!room?.id || !room.isBoardGame || !user) return { status: 'failed', message: '目前沒有可用的棋盤房間' };
        if(room.bankingAuthority==='server-banking-v1')return {status:'failed',code:'unsupported-server-operation',message:'這項財務操作尚未移轉後端'};

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
                            boardState: outcome.boardState || latestBoard,
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
            return { status: error?.code==='waiting-confirmation' ? 'waiting' : 'failed', code:error?.code, message };
        }
    };

    const completePaydayCollection = async (boardEventId: string): Promise<BoardFinancialMutationResult> => {
        const commandId = `fin-payday:${room?.sessionId || room?.id}:${user?.uid}:${boardEventId}`;
        if(room?.bankingAuthority==='server-banking-v1') {
            if(!user || !canMutateCurrentRoom() || !boardEventId.endsWith('_bank'))return {status:'failed',message:'目前無法提交銀行領款'};
            return submitServerBanking(room,user.uid,commandId,{type:'collectPayday',eventId:boardEventId.slice(0,-5)});
        }
        return runPersonalFinance(commandId,
            (state, latestRoom) => {
                const result = applyPaydayCollection(
                    state,
                    latestRoom.financialAcceleration,
                    boardEventId,
                    { now: serverNow(), generateId: createSequentialIdGenerator(commandId) }
                );
                if (result.status === 'duplicate') return { status: 'duplicate' };
                return { status: 'applied', state: result.state };
            }
        );
    };

    const completeBankEvent = async (boardEventId:string):Promise<BoardFinancialMutationResult> => {
        if(!room || !user || !canMutateCurrentRoom())return {status:'failed',message:'目前無法提交銀行結案'};
        if(room.bankingAuthority!=='server-banking-v1')return (await advanceBoardEventQueue('bank'))?{status:'applied'}:{status:'failed',message:'銀行事件尚未完成'};
        return submitServerBanking(room,user.uid,`bank-finish:${room.sessionId}:${boardEventId}`,{type:'finishBank',eventId:boardEventId});
    };

    const completeHouseConversion = async (assetId: string, toSelfUse: boolean, operationId?: string): Promise<BoardFinancialMutationResult> => {
        const commandId = operationId || `house-conv:${room?.sessionId || room?.id}:${user?.uid}:${assetId}:${serverNow()}`;
        if(room?.bankingAuthority==='server-banking-v1'){
            if(!user||!canMutateCurrentRoom())return {status:'failed',message:'目前無法提交房屋用途轉換'};
            return submitServerBanking(room,user.uid,commandId,{type:'convertHouse',assetId,toSelfUse});
        }
        return runPersonalFinance(commandId,
            (state) => {
                const result = applyHouseConversion(state, assetId, toSelfUse);
                if (result.status === 'error') return { status: 'failed', message: result.message };
                return { status: 'applied', state: result.state };
            }
        );
    };

    const submitPersonalHappiness = async (commandId:string,data:{action:'toggle'|'add'|'remove';itemId?:string;checked?:boolean;label?:string;points?:number}):Promise<BoardFinancialMutationResult> => {
        if(!room||!user||!canMutateCurrentRoom())return {status:'failed',message:'目前無法提交幸福清單操作'};
        try{return await submitServerGameCommand<BoardFinancialMutationResult>({type:'personalHappiness',roomId:room.id,sessionId:room.sessionId,commandId,...data});}
        catch(error:any){const code=String(error?.code||'internal').replace(/^functions\//,'');return {status:isUncertainGameCommandError(error)?'waiting':'failed',code,message:error?.message||'幸福清單操作尚待確認'};}
    };

    const completeHappinessToggle = async (id: string, checked?: boolean, operationId?: string): Promise<BoardFinancialMutationResult> => {
        const commandId = operationId || `happiness-toggle:${room?.sessionId || room?.id}:${user?.uid}:${id}:${serverNow()}`;
        if(room?.bankingAuthority==='server-banking-v1'){if(typeof checked!=='boolean')return {status:'failed',message:'請明確指定幸福項目狀態'};return submitPersonalHappiness(commandId,{action:'toggle',itemId:id,checked});}
        return runPersonalFinance(commandId,
            (state) => ({ status: 'applied', state: applyHappinessToggle(state, id, checked) })
        );
    };

    const completeHappinessAdd = async (label: string, points: number, operationId?: string): Promise<BoardFinancialMutationResult> => {
        const commandId = operationId || `happiness-add:${room?.sessionId || room?.id}:${user?.uid}:${serverNow()}`;
        if(room?.bankingAuthority==='server-banking-v1')return submitPersonalHappiness(commandId,{action:'add',label,points});
        return runPersonalFinance(commandId,
            (state) => ({
                status: 'applied',
                state: applyHappinessAdd(state, label, points, { now: serverNow(), generateId: createSequentialIdGenerator(commandId) })
            })
        );
    };

    const completeHappinessRemove = async (id: string, operationId?: string): Promise<BoardFinancialMutationResult> => {
        const commandId = operationId || `happiness-remove:${room?.sessionId || room?.id}:${user?.uid}:${id}:${serverNow()}`;
        if(room?.bankingAuthority==='server-banking-v1')return submitPersonalHappiness(commandId,{action:'remove',itemId:id});
        return runPersonalFinance(commandId,
            (state) => ({ status: 'applied', state: applyHappinessRemove(state, id) })
        );
    };

    const completeBoardTransaction = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if(room?.bankingAuthority==='server-banking-v1'&&txData.boardFlow==='manual-bank')return completeManualFinancialTransaction(txData);
        const operationId = txData.boardEventId || txData.commandId;
        if (!operationId) return { status: 'failed', message: '交易缺少識別碼，請重新操作' };
        const commandId = `fin:${room?.sessionId || room?.id}:${user?.uid}:${operationId}`;
        if(room?.bankingAuthority==='server-banking-v1'&&txData.boardFlow==='insurance-claim'&&txData.medicalClaimId)return submitMedicalCardOperation({type:'claimMedical',claimId:txData.medicalClaimId,commandId});
        if(room?.bankingAuthority==='server-banking-v1'&&(txData.boardFlow==='hospital'||txData.boardFlow==='repair')) {
            if(!user||!canMutateCurrentRoom()||!txData.boardSourceEventId)return {status:'failed',message:'格子付款缺少來源事件，請重新開啟財務檢核'};
            try {return await submitServerGameCommand<BoardFinancialMutationResult>({type:'payService',roomId:room.id,sessionId:room.sessionId,eventId:txData.boardSourceEventId,kind:txData.boardFlow,commandId,...(txData.fundingLoanAmount?{fundingLoanAmount:txData.fundingLoanAmount}:{}),...(txData.forcedDebtAmount?{forcedDebtAmount:txData.forcedDebtAmount}:{})});}
            catch(error:any){return {status:isUncertainGameCommandError(error)?'waiting':'failed',message:error?.message||'格子付款尚待確認'};}
        }
        if(room?.bankingAuthority==='server-banking-v1'&&(txData.usage==='lifelong_learning'||(room.boardState?.currentEvent?.type==='school'&&txData.name==='升等考試報名費'))) {
            if(!user||!canMutateCurrentRoom()||!room.boardState?.currentEvent?.id)return {status:'failed',message:'學習事件尚未準備完成'};
            try {return await submitServerGameCommand<BoardFinancialMutationResult>({type:txData.usage==='lifelong_learning'?'payLearning':'paySchool',roomId:room.id,sessionId:room.sessionId,eventId:room.boardState.currentEvent.id,commandId,fundingLoanAmount:txData.fundingLoanAmount,forcedDebtAmount:txData.forcedDebtAmount});}
            catch(error:any){return {status:isUncertainGameCommandError(error)?'waiting':'failed',message:error?.message||'學習付款尚待確認'};}
        }
        if(room?.bankingAuthority==='server-banking-v1'&&txData.boardFlow==='board-card'&&txData.usage==='happiness_event'){
            const cardId=txData.boardSourceCardId||txData.happinessEventPayload?.sourceCardId,eventId=txData.boardSourceEventId;
            if(!cardId||!eventId)return {status:'failed',message:'幸福卡付款缺少來源事件，請重新開啟財務檢核'};
            return submitHappinessCardOperation(eventId,cardId,'accept',txData.fundingLoanAmount);
        }
        if(room?.bankingAuthority==='server-banking-v1'&&txData.boardFlow==='board-card'&&isStandaloneOpportunityCard(txData.boardSourceCardId||'')){
            if(!txData.boardSourceEventId||!txData.boardSourceCardId)return {status:'failed',message:'機運卡付款缺少來源事件'};
            return completeOpportunityCard(txData.boardSourceEventId,txData.boardSourceCardId,'accept',{...(txData.fundingLoanAmount?{fundingLoanAmount:txData.fundingLoanAmount}:{}),...(txData.forcedDebtAmount?{forcedDebtAmount:txData.forcedDebtAmount}:{})});
        }
        if(room?.bankingAuthority==='server-banking-v1'&&txData.boardFlow==='board-card'&&txData.boardSourceCardId==='C054'){
            if(!user||!canMutateCurrentRoom()||!txData.boardSourceEventId)return {status:'failed',message:'分享財務檢核缺少来源事件'};
            try{return await submitServerGameCommand<BoardFinancialMutationResult>({type:'applyFollowup',cardId:'C054',roomId:room.id,sessionId:room.sessionId,eventId:txData.boardSourceEventId,commandId});}
            catch(error:any){return {status:isUncertainGameCommandError(error)?'waiting':'failed',message:error?.message||'分享財務尚待確認'};}
        }
        const apply: Parameters<typeof runPlayerFinancialCommand>[0]['apply'] = (state, latestRoom) => {
                const eventError=validateFinancialEvent(latestRoom.boardState!,txData,user!.uid);
                if(eventError)return {status:'failed',message:eventError};
                const broadcast=latestRoom.flowSchemaVersion===1 ? buildExpenseBroadcast(latestRoom.boardState!,state,txData,user!.uid,commandId,serverNow()) : undefined;
                const result = applyBoardTransaction(state, txData, {
                    now: serverNow(),
                    generateId: createSequentialIdGenerator(commandId),
                    financialAcceleration: latestRoom.financialAcceleration
                });
                if (result.status === 'error') {
                    return result.code === 'insufficient_cash'
                        ? { status: 'requires_funding', shortfall: result.shortfall, message: result.message }
                        : { status: 'failed', message: result.message };
                }
                if (result.status === 'duplicate') return { status: 'duplicate' };
                const pending = buildPaidLearningContinuation(latestRoom, user!.uid, txData, commandId, serverNow());
                if (pending) return { status:'applied', ...applyPaidLearningMove(latestRoom.boardState!, result.state, pending) };
                return { status: 'applied', state: result.state, ...(broadcast ? {boardState:broadcast} : {}) };
        };
        // A banking form changes the player's finances; event closure is a separate command.
        if(txData.boardFlow==='manual-bank')return runPersonalFinance(commandId,apply);
        return runPlayerFinancialCommand({commandId,failureLabel:'財務交易',apply});
    };

    const completeLoanBorrow = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!txData.commandId && !txData.boardEventId) return {status:'failed',message:'信用貸款缺少操作識別碼'};
        const commandId=`loan:${room?.sessionId || room?.id}:${user?.uid}:${txData.commandId || txData.boardEventId}`;
        if(room?.bankingAuthority==='server-banking-v1') {
            if(!user || !canMutateCurrentRoom())return {status:'failed',message:'目前無法提交借款'};
            return submitServerBanking(room,user.uid,commandId,{type:'borrowLoan',amount:Number(txData.amount)});
        }
        return runPersonalFinance(commandId,state=>{
            const amount=Number(txData.amount);
            const remaining=getRemainingCreditCapacity(state.profession?.salary || 0,state.liabilities || [],state.loans || 0);
            if(amount>remaining) return {status:'failed',message:`超過信貸上限，剩餘可借 ${remaining.toLocaleString()}`};
            return {status:'applied',state:buildLoanBorrowState(state,txData,commandId)};
        });
    };

    const completeLoanRepayment = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!txData.commandId && !txData.boardEventId) return {status:'failed',message:'還款缺少操作識別碼'};
        const commandId=`repay:${room?.sessionId || room?.id}:${user?.uid}:${txData.commandId || txData.boardEventId}`;
        if(room?.bankingAuthority==='server-banking-v1') {
            if(!user || !canMutateCurrentRoom())return {status:'failed',message:'目前無法提交還款'};
            return submitServerBanking(room,user.uid,commandId,{type:'repayLoan',amount:Number(txData.amount),liabilityId:txData.liabilityId});
        }
        return runPersonalFinance(commandId,state=>({status:'applied',state:buildLoanRepaymentState(state,txData,commandId)}));
    };

    const completeDepositWithdrawal = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if(room?.bankingAuthority==='server-banking-v1'&&!txData.commandId&&!txData.boardEventId)return {status:'failed',message:'定存解約缺少操作識別碼'};
        const commandId=`deposit-withdrawal:${room?.sessionId || room?.id}:${user?.uid}:${txData.commandId || `${txData.relatedAssetId}:${txData.amount}`}`;
        if(room?.bankingAuthority==='server-banking-v1'){
            if(!user||!canMutateCurrentRoom())return {status:'failed',message:'目前無法提交解約交易'};
            return submitServerBanking(room,user.uid,commandId,{type:'withdrawDeposit',amount:Number(txData.amount),assetId:txData.relatedAssetId});
        }
        return runPersonalFinance(commandId,state=>({status:'applied',state:buildDepositWithdrawalState(state,txData,commandId)}));
    };

    const completeCarPurchase = async (txData: TransactionData): Promise<BoardFinancialMutationResult> => {
        if (!txData.commandId && !txData.boardEventId) return {status:'failed',message:'汽車交易缺少操作識別碼'};
        const commandId=`car-purchase:${room?.sessionId || room?.id}:${user?.uid}:${txData.commandId || txData.boardEventId}`;
        if(room?.bankingAuthority==='server-banking-v1'){
            if(!user||!canMutateCurrentRoom())return {status:'failed',message:'目前無法提交汽車交易'};
            return submitServerBanking(room,user.uid,commandId,{type:'purchaseCar',cashContribution:Number(txData.assetDetails?.downPayment)});
        }
        return runPersonalFinance(commandId,state=>({status:'applied',state:buildCarPurchaseState(state,txData,commandId)}));
    };

    const rollStartupUpgradeDice = async (payload: {
        assetId: string;
        cardId: string;
        stage: 1 | 2;
        sourceEventId?: string;
    }): Promise<{ roll: number; eligible?: boolean; presentationDurationMs?: number }> => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) throw new Error('企業升級骰子尚未準備完成');
        if(room.bankingAuthority==='server-banking-v1') {
            const eventId=room.boardState.currentEvent?.id;
            const result=await submitServerBanking(room,user.uid,`startup-roll:${room.sessionId}:${eventId}:${payload.assetId}:${payload.stage}`,{type:'rollStartup',assetId:payload.assetId,cardId:payload.cardId,stage:payload.stage,eventId}) as import('../game/finance/privateCommand').FinancialCommandResult & {roll?:number;eligible?:boolean};
            if(!['applied','duplicate'].includes(result.status) || !result.roll)throw new Error(result.message||'企業升級骰點尚待確認');
            return {roll:result.roll,eligible:result.eligible,presentationDurationMs:DICE_PRESENTATION_DURATION_MS};
        }
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
                const timestamp = serverNow();
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

    const deferStartupUpgrade = async (assetId:string,cardId:string):Promise<boolean> => {
        if(room?.bankingAuthority!=='server-banking-v1')return true;
        if(!user || !canMutateCurrentRoom())return false;
        const eventId=room.boardState?.currentEvent?.id;
        const result=await submitServerBanking(room,user.uid,`startup-defer:${room.sessionId}:${eventId}:${assetId}`,{type:'deferStartup',assetId,cardId,eventId});
        if(!['applied','duplicate'].includes(result.status)){setError(result.message||'企業升級選擇尚待確認');return false;}
        return true;
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
        if(room.bankingAuthority==='server-banking-v1')return submitServerBanking(room,user.uid,commandId,{type:'upgradeStartup',assetId:payload.assetId,cardId:payload.cardId,eventId:room.boardState?.currentEvent?.id});
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
                        boardState: { ...latestBoard, updatedAt: serverNow() },
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
                    boardState: { ...latestBoard, sharedCardPrompt: undefined, updatedAt: serverNow() },
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
                const syncedAt = serverNow();
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
            playerStateUids: [user.uid],
            forcePrivatePlayerStates: true,
            onDuplicate: latestRoom => latestRoom.boardState?.playerPositions[user.uid] ?? null,
            mutate: (currentRoom, currentBoardState) => {
                if (currentBoardState.currentTurnUid !== user.uid) throw new Error('還沒輪到你');
                const currentPosition = currentBoardState.playerPositions?.[user.uid] || 0;
                // 找「順時針方向最近」的目標格，不是陣列裡第一個同類型格——
                // 原本的寫法 (index - currentPosition + N) % N > 0 對任何
                // index !== currentPosition 恆為真，等於沒有真正比較距離。
                const nextSquare = getNextBoardSquare(currentPosition,payload.squareType);

                const playerState = currentRoom.playerStates?.[user.uid];
                if (!playerState) throw new Error('玩家資料尚未同步，已付款事件可安全接續，請勿建立新付款');
                const nextSkipTurns = Math.max(currentBoardState.skipTurns?.[user.uid] || 0, payload.skipTurns || 0);
                const timestamp = serverNow();
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
        if(room?.bankingAuthority==='server-banking-v1'){
            if(room.boardState?.currentCard?.cardId!==code||!room.boardState.currentCardReveal?.isRevealed||room.marketUpdates?.code!==code)throw new Error('等待後端確認股市事件');
            return;
        }

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
                            timestamp: serverNow()
                        },
                        previousMarketPrices: currentPrices,
                        marketPrices: nextPrices
                    };
                    return {
                        boardState: { ...latestBoard, updatedAt: serverNow() },
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

    const submitCoachFinancialCommand = async (commandId:string,data:{playerUid:string;action:'cash'|'income'|'liability'|'expense';amount?:number;liabilityId?:string;totalOwedDelta?:number;monthlyPaymentDelta?:number;category?:CoachExpenseCategory;reason?:string}|{type:'coachSubsidy';amount:number}|{type:'coachMarket';code:string}|{type:'coachAcceleration';multiplier:FinancialAccelerationMultiplier}|{type:'setTimer';seconds:number;paused:boolean;mode?:'set'|'pause'}):Promise<void> => {
        if(!room||!user||!canMutateCurrentRoom())throw new Error('目前無法提交執行師調整');
        try{const result=await submitServerGameCommand<BoardFinancialMutationResult>({type:'coachAdjustment',roomId:room.id,sessionId:room.sessionId,commandId,...data});if(!['applied','duplicate'].includes(result.status))throw Object.assign(new Error(result.message||'調整尚待確認，請查核原命令'),{code:'waiting-confirmation'});}
        catch(error:any){setError(error?.message||'調整尚待確認');if(typeof error?.code==='string')error.code=error.code.replace(/^functions\//,'');throw error;}
    };

    const adjustPlayerCash = async (playerUid: string, amount: number, originalCommandId?: string) => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁無法提交，請確認遊戲版本及操作控制權');
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整玩家現金');
        }

        const delta = Math.trunc(Number(amount));
        if (!Number.isFinite(delta) || delta === 0) throw new Error('請輸入有效的現金調整金額');

        const playerRef = doc(db, 'rooms', room.id, 'players', playerUid);
        const operationId = originalCommandId || `coach-cash:${room.sessionId || room.id}:${user.uid}:${playerUid}:${serverNow()}:${crypto.randomUUID()}`;
        if(room.bankingAuthority==='server-banking-v1')return submitCoachFinancialCommand(operationId,{action:'cash',playerUid,amount:delta});
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomSnapshot=await transaction.get(doc(db,'rooms',room.id));
                if(!roomSnapshot.exists() || roomSnapshot.data().sessionId!==room.sessionId) throw new Error('目前場次已更新');
                const latestRoom=roomSnapshot.data() as Room;
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                if(latestRoom.financialHistoryStorage==='subcollection' && latestRoom.sessionId &&
                    (await transaction.get(financialCommandRef(db,room.id,playerUid,latestRoom.sessionId,operationId))).exists())return currentState;
                const currentCash = Number(currentState.cash) || 0;
                const nextCash = currentCash + delta;
                if (nextCash < 0) throw new Error('玩家現金不足，無法扣除這麼多');

                const transactionRecord: Transaction = {
                    id: operationId,
                    name: delta > 0 ? '執行師增加現金' : '執行師扣除現金',
                    amount: Math.abs(delta),
                    sourceLabel: '執行師調整',
                    usageLabel: '現金調整',
                    cashChange: delta,
                    balance: nextCash,
                    timestamp: serverNow(),
                    details: '由執行師端手動調整',
                    flowType: '其它'
                };
                const updatedState = cleanObject({
                    ...currentState,
                    cash: nextCash,
                    history: [...(currentState.history || []), transactionRecord]
                }) as GameState;

                const savedState=writePrivateFinancialState(transaction,db,room.id,playerUid,currentState,updatedState,latestRoom,transactionRecord.id,{status:"applied"});
                return savedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家現金調整失敗');
            throw err;
        }

        if(activeRoomScopeRef.current!==getRoomSessionScope(room))return;
        setPlayerStates(prev => ({ ...prev, [playerUid]: nextState }));
        setRoom(prev => prev ? {
            ...prev,
            playerStates: { ...(prev.playerStates || {}), [playerUid]: nextState }
        } : prev);
    };

    const adjustPlayerInvestmentIncome = async (playerUid: string, amount: number, originalCommandId?: string) => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁無法提交，請確認遊戲版本及操作控制權');
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整玩家理財收入');
        }

        const delta = Math.trunc(Number(amount));
        if (!Number.isFinite(delta) || delta === 0) throw new Error('請輸入有效的理財收入調整金額');

        const playerRef = doc(db, 'rooms', room.id, 'players', playerUid);
        const operationId = originalCommandId || `coach-investment-income:${room.sessionId || room.id}:${user.uid}:${playerUid}:${serverNow()}:${crypto.randomUUID()}`;
        if(room.bankingAuthority==='server-banking-v1')return submitCoachFinancialCommand(operationId,{action:'income',playerUid,amount:delta});
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomSnapshot=await transaction.get(doc(db,'rooms',room.id));
                if(!roomSnapshot.exists() || roomSnapshot.data().sessionId!==room.sessionId) throw new Error('目前場次已更新');
                const latestRoom=roomSnapshot.data() as Room;
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                if(latestRoom.financialHistoryStorage==='subcollection' && latestRoom.sessionId &&
                    (await transaction.get(financialCommandRef(db,room.id,playerUid,latestRoom.sessionId,operationId))).exists())return currentState;
                const currentIncome = Number(currentState.income?.investment) || 0;
                const nextIncome = currentIncome + delta;
                if (nextIncome < 0) throw new Error('玩家理財收入不足，無法扣除這麼多');

                const now = serverNow();
                const transactionRecord: Transaction = {
                    id: operationId,
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
                const savedState=writePrivateFinancialState(transaction,db,room.id,playerUid,currentState,updatedState,latestRoom,transactionRecord.id,{status:"applied"});
                return savedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家理財收入調整失敗');
            throw err;
        }

        if(activeRoomScopeRef.current!==getRoomSessionScope(room))return;
        setPlayerStates(prev => ({ ...prev, [playerUid]: nextState }));
        setRoom(prev => prev ? {
            ...prev,
            playerStates: { ...(prev.playerStates || {}), [playerUid]: nextState }
        } : prev);
    };

    const adjustPlayerLiability = async (
        playerUid: string,
        liabilityId: string,
        adjustments: { totalOwedDelta: number; monthlyPaymentDelta: number; reason: string },
        originalCommandId?: string
    ) => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁無法提交，請確認遊戲版本及操作控制權');
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整玩家負債');
        }
        const reason = adjustments.reason.trim();
        if (!reason) throw new Error('請填寫負債調整原因');

        const playerRef = doc(db, 'rooms', room.id, 'players', playerUid);
        const operationId = originalCommandId || `coach-liability:${user.uid}:${playerUid}:${crypto.randomUUID()}`;
        if(room.bankingAuthority==='server-banking-v1')return submitCoachFinancialCommand(operationId,{action:'liability',playerUid,liabilityId,totalOwedDelta:adjustments.totalOwedDelta,monthlyPaymentDelta:adjustments.monthlyPaymentDelta,reason});
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomSnapshot=await transaction.get(doc(db,'rooms',room.id));
                if(!roomSnapshot.exists() || roomSnapshot.data().sessionId!==room.sessionId) throw new Error('目前場次已更新');
                const latestRoom=roomSnapshot.data() as Room;
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                if(latestRoom.financialHistoryStorage==='subcollection' && latestRoom.sessionId &&
                    (await transaction.get(financialCommandRef(db,room.id,playerUid,latestRoom.sessionId,operationId))).exists())return currentState;
                const result = applyPlayerLiabilityAdjustment(
                    currentState,
                    liabilityId,
                    adjustments.totalOwedDelta,
                    adjustments.monthlyPaymentDelta
                );
                const now = serverNow();
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
                const savedState=writePrivateFinancialState(transaction,db,room.id,playerUid,currentState,updatedState,latestRoom,transactionRecord.id,{status:"applied"});
                return savedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家負債調整失敗');
            throw err;
        }

        if(activeRoomScopeRef.current!==getRoomSessionScope(room))return;
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
        reason: string,
        originalCommandId?: string
    ) => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁無法提交，請確認遊戲版本及操作控制權');
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
        const operationId = originalCommandId || `coach-expense:${user.uid}:${playerUid}:${category}:${serverNow()}`;
        if(room.bankingAuthority==='server-banking-v1')return submitCoachFinancialCommand(operationId,{action:'expense',playerUid,category,amount:amountDelta,reason:trimmedReason});
        let nextState: GameState;
        try {
            nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomSnapshot=await transaction.get(doc(db,'rooms',room.id));
                if(!roomSnapshot.exists() || roomSnapshot.data().sessionId!==room.sessionId) throw new Error('目前場次已更新');
                const latestRoom=roomSnapshot.data() as Room;
                const playerSnapshot = await transaction.get(playerRef);
                if (!playerSnapshot.exists()) throw new Error('找不到玩家資料');

                const currentState = playerSnapshot.data() as GameState;
                if(latestRoom.financialHistoryStorage==='subcollection' && latestRoom.sessionId &&
                    (await transaction.get(financialCommandRef(db,room.id,playerUid,latestRoom.sessionId,operationId))).exists())return currentState;
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
                    timestamp: serverNow(),
                    details: `執行師 ${user.name || user.uid}；原因：${trimmedReason}；${categoryLabels[category]} ${result.before.toLocaleString()} → ${result.after.toLocaleString()} / 月`,
                    flowType: '生活'
                };
                const updatedState = cleanObject({
                    ...result.state,
                    history: [...(currentState.history || []), transactionRecord]
                }) as GameState;
                const savedState=writePrivateFinancialState(transaction,db,room.id,playerUid,currentState,updatedState,latestRoom,transactionRecord.id,{status:"applied"});
                return savedState;
            }));
        } catch (err: any) {
            setError(err?.message || '玩家每月支出調整失敗');
            throw err;
        }

        if(activeRoomScopeRef.current!==getRoomSessionScope(room))return;
        setPlayerStates(prev => ({ ...prev, [playerUid]: nextState }));
        setRoom(prev => prev ? {
            ...prev,
            playerStates: { ...(prev.playerStates || {}), [playerUid]: nextState }
        } : prev);
    };

    const updateFinancialAcceleration = async (multiplier: FinancialAccelerationMultiplier, originalCommandId?:string) => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁無法提交，請確認遊戲版本及操作控制權');
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以調整全局財務加速器');
        }
        if(room.bankingAuthority==='server-banking-v1')return submitCoachFinancialCommand(originalCommandId||`coach-acceleration:${crypto.randomUUID()}`,{type:'coachAcceleration',multiplier});

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
                    updatedAt: serverNow(),
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

    const grantFinancialSubsidyToAllPlayers = async (amount: number, originalCommandId?: string) => {
        if (!canMutateCurrentRoom()) throw new Error('此分頁無法提交，請確認遊戲版本及操作控制權');
        if (!room?.id || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以發放全體補助');
        }

        const subsidyAmount = Math.trunc(Number(amount));
        if (!Number.isFinite(subsidyAmount) || subsidyAmount <= 0) throw new Error('補助金額必須大於 0');

        const roomRef = doc(db, 'rooms', room.id);
        const grantId = originalCommandId || `financial-subsidy:${room.sessionId || room.id}:${crypto.randomUUID()}`;
        if(room.bankingAuthority==='server-banking-v1')return submitCoachFinancialCommand(grantId,{type:'coachSubsidy',amount:subsidyAmount});
        let result: { subsidy: FinancialSubsidyState; states: Record<string, GameState> };
        try {
            result = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) throw new Error('房間不存在');
                const latestRoom = roomSnapshot.data() as Room;
                if (latestRoom.sessionId !== room.sessionId) throw new Error('目前場次已更新');
                const receiptRef=doc(db,'rooms',room.id,'coachCommands',encodeURIComponent(grantId));
                if(latestRoom.flowSchemaVersion===1) {
                    const receipt=await transaction.get(receiptRef);
                    if(receipt.exists())return {subsidy:latestRoom.financialSubsidy || receipt.data().result,states:{}};
                }
                if (latestRoom.status === 'finished') throw new Error('遊戲已結束，無法發放全體補助');
                const playerUids = latestRoom.members
                    .filter(member => member.uid !== latestRoom.hostId && !member.isLeft)
                    .map(member => member.uid);
                if (playerUids.length === 0) throw new Error('目前沒有可發放補助的玩家');

                const playerRefs = playerUids.map(uid => doc(db, 'rooms', room.id, 'players', uid));
                const snapshots = await Promise.all(playerRefs.map(playerRef => transaction.get(playerRef)));
                const grantedAt = serverNow();
                const sequence = (Number(latestRoom.financialSubsidy?.sequence) || 0) + 1;
                const firstExisting = snapshots.findIndex(snapshot => snapshot.exists());
                if (snapshots.some(snapshot => !snapshot.exists())) throw new Error('有玩家財務資料尚未同步，尚未發放補助');
                if (latestRoom.financialHistoryStorage === 'subcollection') {
                    const receipt = await transaction.get(financialCommandRef(db, room.id, playerUids[firstExisting], latestRoom.sessionId!, grantId));
                    if (receipt.exists()) return { subsidy: receipt.data().result.subsidy, states: Object.fromEntries(snapshots.flatMap((snapshot,index) => snapshot.exists() ? [[playerUids[index], snapshot.data() as GameState]] : [])) };
                }
                const subsidy: FinancialSubsidyState = {
                    sequence, amount: subsidyAmount, grantedAt, grantedByUid: user.uid,
                    grantedByName: user.name, playerUids: playerUids.filter((_,index) => snapshots[index].exists())
                };
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
                    writePrivateFinancialState(transaction,db,room.id,playerUids[index],snapshots[index].data() as GameState,nextState,latestRoom,transactionRecord.id,{status:"applied",subsidy});
                });

                if(latestRoom.flowSchemaVersion===1)transaction.set(receiptRef,{commandId:grantId,sessionId:latestRoom.sessionId,coachUid:user.uid,kind:'subsidy',result:subsidy});
                transaction.update(roomRef, { financialSubsidy: subsidy });
                return { subsidy, states };
            }));
        } catch (err: any) {
            setError(err?.message || '全體補助發放失敗');
            throw err;
        }

        if(activeRoomScopeRef.current!==getRoomSessionScope(room))return;
        setPlayerStates(prev => ({ ...prev, ...result.states }));
        setRoom(prev => prev ? {
            ...prev,
            financialSubsidy: result.subsidy,
            playerStates: { ...(prev.playerStates || {}), ...result.states }
        } : prev);
    };

    const updateRoomTimer = async (timeLeft: number, isPaused: boolean, timerEndsAtMs: number | null = null, originalCommandId?:string, mode?:'set'|'pause') => {
        if (!canMutateCurrentRoom())throw new Error('此分頁無法提交計時器操作');
        if (!room || user?.role !== 'coach')throw new Error('只有執行師可以控制計時器');
        if(room.movementAuthority==='server-movement-v1') {
            return submitCoachFinancialCommand(originalCommandId||`timer:${crypto.randomUUID()}`,{type:'setTimer',seconds:timeLeft,paused:isPaused,...(mode?{mode}:{})});
        }
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
        const snapshot = await withConfirmationDeadline(() => getDocFromServer(doc(db, 'rooms', room.id)));
        if (!snapshot.exists()) throw new Error('房間不存在或已關閉');
        setRoom({...snapshot.data(),id:room.id} as Room);
        window.dispatchEvent(new Event('hf-reconnect'));
        setError(null);
    };

    const settlementMovement = room?.boardState?.movement;
    const settlementScope = `${room?.id}:${room?.sessionId}:${settlementMovement?.playerUid}:${settlementMovement?.startedAt}`;
    const settleCurrentMovement = async () => {
        if (!room?.id || !settlementMovement?.isActive || !user) return;
        const movement = settlementMovement;
        if(room.movementAuthority==='server-movement-v1') {
            const command={type:'settleMovement',roomId:room.id,sessionId:room.sessionId,commandId:movementCommandId(movement),playerUid:movement.playerUid,startedAt:movement.startedAt};
            let result=await submitServerGameCommand<any>(command);
            // A slightly early request (clock estimate) gets 'waiting': wait for the server's deadline once.
            if(result.status==='waiting'&&Number(result.retryAt)-serverNow()<5000){
                await new Promise(resolve=>window.setTimeout(resolve,Math.max(0,Number(result.retryAt)-serverNow())+150));
                result=await submitServerGameCommand<any>(command);
            }
            if(!['applied','duplicate','stale'].includes(result.status))throw new Error(result.message||'等待後端移動結算');
            return;
        }
        await runRoomBoardMutation({
            db, roomId: room.id, commandId: movementCommandId(movement),
            readPromptResponses: false, playerStateUids: [movement.playerUid], forcePrivatePlayerStates: true,
            onDuplicate: () => undefined,
            mutate: (latestRoom, latestBoard) => {
                if (latestRoom.sessionId !== room.sessionId || latestRoom.status !== 'playing') {
                    return { boardState: latestBoard, commit: false, result: undefined };
                }
                if (!canSettleMovement(latestBoard, movement, user.uid, latestRoom.hostId || '', serverNow())) {
                    if (latestBoard.movement?.isActive && latestBoard.movement.startedAt === movement.startedAt) {
                        throw new Error('移動尚未到結算時間，或已不是本回合');
                    }
                    return { boardState: latestBoard, commit: false, result: undefined };
                }
                const resolution = buildBoardMovementLegResolution(latestRoom as Room, movement.playerUid);
                if (!resolution?.boardState) throw new Error('棋盤移動無法結算');
                return { boardState: resolution.boardState,
                    roomPatch: resolution.playerStates ? { playerStates: resolution.playerStates } : undefined,
                    result: undefined };
            }
        });
    };
    const movementSettlement = useMovementSettlement({
        scope: settlementScope, movement: settlementMovement, actorUid: user?.uid || '', hostUid: room?.hostId || '',
        enabled: !!user && isController && room?.status === 'playing'
            && (room.hostId === user.uid || settlementMovement?.playerUid === user.uid),
        settle: settleCurrentMovement,
        serverAuthority: room?.movementAuthority === 'server-movement-v1',
    });
    const retryStaleBoardMovement = movementSettlement.retry;
    useGameDiagnostics({roomId:room?.id,sessionId:room?.sessionId,uid:user?.uid,
        surface:room?.hostId===user?.uid?'coach':'player',controller:isController});

    const submitSharingOperation = async (data:Record<string,unknown>):Promise<boolean> => {
        if(!room||!user||!canMutateCurrentRoom())return false;
        try {
            const result=await submitServerGameCommand<{status:string;message?:string}>({...data,roomId:room.id,sessionId:room.sessionId});
            if(!['applied','duplicate'].includes(result.status)){setError(result.message||'分享與接續尚未完成');return false;}
            return true;
        }catch(error:any){setError(error?.message||'分享與接續尚未確認，請沿用原操作重試');return false;}
    };

    const submitRequest = async (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>): Promise<boolean> => {
        if(room?.bankingAuthority==='server-banking-v1'&&request.type==='board_share'&&['C054','C056'].includes(request.boardCardId||'')) {
            const marker=user?room.playerStates?.[user.uid]?.followupApproval:undefined;
            const attempt=marker?.sessionId===room.sessionId&&marker.eventId===request.boardEventId?(marker.status==='rejected'?marker.attempt+1:marker.attempt):1;
            return submitSharingOperation({type:'submitFollowup',...(request.boardCardId==='C054'?{cardId:'C054'}:{}),eventId:request.boardEventId,commandId:`followup-submit:${request.boardEventId}:${attempt}`});
        }
        if(room?.bankingAuthority==='server-banking-v1'&&request.type==='happiness') {
            const previous=Object.values(pendingRequests).find(r=>r.type==='happiness'&&r.uid===user?.uid&&r.boardEventId===request.boardEventId);
            const approval=user?room.playerStates?.[user.uid]?.storyApproval:undefined;
            const last=approval?.sessionId===room.sessionId&&approval.eventId===request.boardEventId?approval:previous;
            const attempt=last?.status==='rejected'?(last.attempt||0)+1:last?.attempt||1;
            return submitSharingOperation({type:'submitStory',eventId:request.boardEventId,cardId:request.boardCardId,commandId:`story-submit:${request.boardEventId}:${attempt}`});
        }

        if (!canMutateCurrentRoom()) return false;
        if (!room) return false;
        try {
            const requestId = buildPendingRequestId(request, room.sessionId);
            const newRequest: PendingRequest = {
                ...request,
                id: requestId,
                status: 'pending',
                timestamp: serverNow(),
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

    const approveRequestOperation = async (requestId: string): Promise<boolean> => {
        if (!canMutateCurrentRoom()) return false;
        if (!room || (user?.role !== 'coach' && user?.role !== 'gm')) return false;
        try {
            const request = pendingRequests[requestId] || room.pendingRequests?.[requestId];
            if(room.bankingAuthority==='server-banking-v1'&&request?.type==='board_share'&&['C054','C056'].includes(request.boardCardId||''))return submitSharingOperation({type:'approveFollowup',...(request.boardCardId==='C054'?{cardId:'C054'}:{}),eventId:request.boardEventId,requestId,attempt:request.attempt,commandId:`followup-approve:${requestId}:${request.attempt}`});
            if(room.bankingAuthority==='server-banking-v1'&&request?.type==='happiness')return submitSharingOperation({type:'approveStory',eventId:request.boardEventId,requestId,attempt:request.attempt,commandId:`story-approve:${requestId}:${request.attempt}`});

            if (isPendingRequestDocumentId(requestId)) {
                if (!request) throw new Error('這筆審核請求不存在，請重新整理');
                const requestRef = doc(db, 'rooms', room.id, 'pendingRequests', requestId);
                if (request.type === 'happiness') {
                    const result = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                        const roomRef = doc(db, 'rooms', room.id);
                        const playerRef = doc(db, 'rooms', room.id, 'players', request.uid);
                        const [requestSnapshot, roomSnapshot, playerSnapshot] = await Promise.all([
                            transaction.get(requestRef),
                            transaction.get(roomRef),
                            transaction.get(playerRef)
                        ]);
                        if (!requestSnapshot.exists()) {
                            if(roomSnapshot.exists() && roomSnapshot.data().financialHistoryStorage==='subcollection' &&
                              (await transaction.get(financialCommandRef(db,room.id,request.uid,roomSnapshot.data().sessionId,`approve-happiness:${requestId}`))).exists())return;
                            throw new Error('這筆幸福分享已處理或不存在');
                        }
                        const latestRequest = requestSnapshot.data() as PendingRequest;
                        if (latestRequest.status === 'approved') return;
                        if (latestRequest.type !== 'happiness' || latestRequest.status !== 'pending') {
                            throw new Error('這筆幸福分享已處理或不存在');
                        }
                        const latestRoom = roomSnapshot.data() as Room;
                        if (latestRoom.financialHistoryStorage === 'subcollection' && latestRoom.sessionId &&
                            (await transaction.get(financialCommandRef(db, room.id, latestRequest.uid, latestRoom.sessionId, `approve-happiness:${requestId}`))).exists()) return;
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
                            writePrivateFinancialState(transaction,db,room.id,latestRequest.uid,playerSnapshot.data() as GameState,applied.state,latestRoom,`approve-happiness:${requestId}`,true);
                        }
                        transaction.update(requestRef, { status: 'approved' });
                    })).catch(async error => {
                        // A concurrent approval can hit immutable receipt Rules before SDK conflict retry.
                        // Confirm the original command on the server; never re-grant on a denial.
                        const receipt = room.financialHistoryStorage === 'subcollection' && room.sessionId
                            ? await withConfirmationDeadline(() => getDocFromServer(financialCommandRef(db, room.id, request.uid, room.sessionId!, `approve-happiness:${requestId}`))).catch(() => null)
                            : null;
                        if (receipt?.exists() && receipt.data().status === 'applied') return;
                        throw error;
                    });
                    if (result === 'stale') {
                        setError('這筆分享請求對應的卡片事件已結束，已自動清除');
                        return false;
                    }
                    return result !== null;
                }
                if (request.type === 'board_share') {
                    await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                        const roomRef = doc(db, 'rooms', room.id);
                        const [rs, qs] = await Promise.all([transaction.get(roomRef), transaction.get(requestRef)]);
                        if (!rs.exists() || !qs.exists()) throw new Error('分享請求或房間不存在');
                        const latest = qs.data() as PendingRequest;
                        if (latest.status === 'approved') return;
                        if (latest.status !== 'pending') throw new Error('分享請求已處理');
                        const pending = buildApprovedDrawContinuation(rs.data() as Room, latest, serverNow());
                        if (pending) transaction.update(roomRef, {'boardState.pendingContinuation': pending});
                        transaction.update(requestRef, {status:'approved'});
                    }));
                    return true;
                }
                await updateDoc(requestRef, { status: 'approved' });
                return true;
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

    const approveRequest = (requestId:string):Promise<boolean> => executeWithLock(()=>approveRequestOperation(requestId),`approve:${requestId}`).catch(err=>{setError(err?.message || '審核尚未完成');return false;});

    const rejectRequest = async (requestId: string): Promise<boolean> => {
        const story=pendingRequests[requestId]||room?.pendingRequests?.[requestId];
        if(room?.bankingAuthority==='server-banking-v1'&&story?.type==='happiness')return submitSharingOperation({type:'rejectStory',eventId:story.boardEventId,requestId,attempt:story.attempt,commandId:`story-rejectStory:${requestId}:${story.attempt}`});
        if(room?.bankingAuthority==='server-banking-v1'&&story?.type==='board_share'&&['C054','C056'].includes(story.boardCardId||''))return submitSharingOperation({type:'rejectFollowup',...(story.boardCardId==='C054'?{cardId:'C054'}:{}),eventId:story.boardEventId,requestId,attempt:story.attempt,commandId:`followup-reject:${requestId}:${story.attempt}`});

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
        const story=pendingRequests[requestId]||room?.pendingRequests?.[requestId];
        if(room?.bankingAuthority==='server-banking-v1'&&story?.type==='happiness')return submitSharingOperation({type:'clearStory',eventId:story.boardEventId,requestId,attempt:story.attempt,commandId:`story-clearStory:${requestId}:${story.attempt}`});
        if(room?.bankingAuthority==='server-banking-v1'&&story?.type==='board_share'&&['C054','C056'].includes(story.boardCardId||''))return submitSharingOperation({type:'clearFollowup',...(story.boardCardId==='C054'?{cardId:'C054'}:{}),eventId:story.boardEventId,requestId,attempt:story.attempt,commandId:`followup-clear:${requestId}:${story.attempt}`});

        if (!canMutateCurrentRoom()) return false;
        if (!room) return false;
        try {
            if (isPendingRequestDocumentId(requestId)) {
                await deleteDoc(doc(db, 'rooms', room.id, 'pendingRequests', requestId));
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
        if(room?.movementAuthority==='server-movement-v1'){
            if(!canMutateCurrentRoom()||!user||!room.boardState)throw new Error('此分頁目前無法處理離線回合');
            const commandId=`coach-offline-turn:${room.sessionId}:${playerUid}:${room.boardState.revision||0}`;
            const result=await executeWithLock(()=>submitServerGameCommand<{status:string;reason?:string}>({type:'skipDisconnectedTurn',roomId:room.id,sessionId:room.sessionId,commandId,playerUid,revision:room.boardState!.revision||0}),commandId);
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'離線回合處理尚待確認，請查核原操作');
            return;
        }
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
            const timestamp = serverNow();
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
        if(room?.promptCompletionAuthority==='server-prompts-v1'){
            const prompt=room.boardState?.sharedCardPrompt;
            if(!canMutateCurrentRoom()||!user||!prompt)throw new Error('共享事件尚未準備完成或此分頁為唯讀');
            const commandId=`coach-offline-shared:${room.sessionId}:${prompt.id}:${playerUid}`;
            const result=await executeWithLock(()=>submitServerGameCommand<{status:string;reason?:string}>({type:'skipDisconnectedSharedTarget',roomId:room.id,sessionId:room.sessionId,commandId,playerUid,promptId:prompt.id,eventId:prompt.sourceEventId}),commandId);
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'離線回覆處理尚待確認，請查核原操作');
            return;
        }
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
            readPromptResponses: true,
            retryOnPermissionDenied: false,
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
                    respondedAt: serverNow()
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
                        boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: serverNow() },
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
                    boardState: { ...advanced.boardState, cardLog: currentCardLog, updatedAt: serverNow() },
                    sharedResponse: { uid: playerUid, response },
                    result: undefined
                };
            }
        });
    };

    const coachTriggerBoardCard = async (playerUid: string, cardId: string) => {
        if(room?.movementAuthority==='server-movement-v1'){
            if(!canMutateCurrentRoom()||!user||!room.boardState)throw new Error('此分頁目前無法發送測試卡片');
            const commandId=`coach-card-test:${room.sessionId}:${playerUid}:${cardId}:${room.boardState.revision||0}`;
            const result=await executeWithLock(()=>submitServerGameCommand<{status:string;reason?:string}>({type:'coachTestCard',roomId:room.id,sessionId:room.sessionId,commandId,playerUid,cardId,revision:room.boardState!.revision||0}),commandId);
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'測試發卡尚待確認，請查核原操作');
            return;
        }
        if (!room?.id || !room.isBoardGame || !room.boardState || !user || (user.role !== 'coach' && user.role !== 'gm')) {
            throw new Error('只有執行師可以觸發測試卡片');
        }
        if (!room.boardState.turnOrder.includes(playerUid)) throw new Error('找不到這位玩家');

        const commandId = `coach-card-test:${cardId}:${playerUid}:${serverNow()}:${Math.random().toString(36).slice(2, 8)}`;
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

                const timestamp = serverNow();
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
        if(room?.movementAuthority==='server-movement-v1'){
            if(!canMutateCurrentRoom()||!user||!room.boardState?.currentEvent)throw new Error('目前沒有可重新顯示的事件');
            const event=room.boardState.currentEvent,commandId=`coach-repeat:${room.sessionId}:${event.id}:${room.boardState.revision||0}`;
            const result=await executeWithLock(()=>submitServerGameCommand<{status:string;reason?:string}>({type:'coachReplayEvent',roomId:room.id,sessionId:room.sessionId,commandId,playerUid:event.playerUid,eventId:event.id,revision:room.boardState!.revision||0}),commandId);
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'事件重新顯示尚待確認，請查核原操作');
            return;
        }
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
                const timestamp = serverNow();
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
        if(room?.movementAuthority==='server-movement-v1'){
            if(!canMutateCurrentRoom()||!user||!room.boardState)throw new Error('此分頁目前無法指定下一回合');
            const commandId=`coach-turn:${room.sessionId}:${playerUid}:${room.boardState.revision||0}`;
            const result=await executeWithLock(()=>submitServerGameCommand<{status:string;reason?:string}>({type:'setCoachNextTurn',roomId:room.id,sessionId:room.sessionId,commandId,playerUid,revision:room.boardState!.revision||0}),commandId);
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'回合指定尚待確認，請查核原操作');
            return;
        }
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
                        updatedAt: serverNow()
                    },
                    result: undefined
                };
            }
        });
    };

    const runCoachBoardRecovery = async (mode: 'clear_event' | 'force_end') => {
        if(room?.movementAuthority==='server-movement-v1'){
            if(!canMutateCurrentRoom()||!user||!room.boardState?.currentTurnUid)throw new Error('此分頁目前無法復原回合');
            const board=room.boardState,commandId=`coach-${mode}:${room.sessionId}:${board.currentTurnUid}:${board.revision||0}`;
            const result=await executeWithLock(()=>submitServerGameCommand<{status:string;reason?:string}>({type:mode==='clear_event'?'coachClearEvent':'coachForceEnd',roomId:room.id,sessionId:room.sessionId,commandId,playerUid:board.currentTurnUid!,eventId:board.currentEvent?.id||'none',revision:board.revision||0}),commandId);
            if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'回合復原尚待確認，請查核原操作');
            return;
        }
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
                const timestamp = serverNow();
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

    // State changes re-render consumers; actions keep one identity for the provider's lifetime,
    // so components that only call actions (memoized children, effect deps) are not re-rendered.
    const roomActions = useStableActions({
        createRoom,
        recoverRoomCreation,
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
        completeOpportunityCard,
        completeMedicalBoardCardAction,
        completeDirectHappinessCard,
        completeInsurancePurchase,
        completeDepositPurchase,
        completeStockTrade,
        completeLoanBorrow,
        completeBoardTransaction,
        completePaydayCollection,
        completeBankEvent,
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
        deferStartupUpgrade,
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
        retryStaleBoardMovement,
    });
    const roomState = useMemo(() => ({
        room,
        isLoadingRoom,
        error,
        playerStates,
        playerStatesHydrated,
        roomSyncState,
        subscriptionError,
        connectionState,
        isController,
        presenceStates,
        pendingRequests,
        movementSettlementError: movementSettlement.error,
        isSettlingMovement: movementSettlement.busy
    }), [room, isLoadingRoom, error, playerStates, playerStatesHydrated, roomSyncState, subscriptionError, connectionState, isController, presenceStates, pendingRequests, movementSettlement.error, movementSettlement.busy]);
    const contextValue = useMemo<RoomContextValue>(() => ({...roomState, ...roomActions}), [roomState, roomActions]);

    return (
        <RoomActionsContext.Provider value={roomActions}>
        <RoomStateContext.Provider value={roomState}>
        <RoomContext.Provider value={contextValue}>
            {children}
            {user&&!room?.id&&<RoomLifecycleRecovery key={`lifecycle:${user.uid}`} uid={user.uid}/>}
            {user&&!room?.id&&<RoomCreationRecovery key={user.uid} uid={user.uid} recover={recoverRoomCreation}/> }
            {user&&room?.sessionId&&(room.promptCompletionAuthority==='server-prompts-v1'||room.bankingAuthority==='server-banking-v1'||room.movementAuthority==='server-movement-v1')&&<ServerCommandRecovery key={`${user.uid}:${room.id}:${room.sessionId}`} uid={user.uid} roomId={room.id} sessionId={room.sessionId} canRetry={isController&&!getRoomCompatibilityError(room)}/>}
        </RoomContext.Provider>
        </RoomStateContext.Provider>
        </RoomActionsContext.Provider>
    );
};

export const useRoom = () => {
    const context = useContext(RoomContext);
    if (!context) throw new Error('useRoom must be used within a RoomProvider');
    return context;
};

/** Actions only: identity never changes, so callers do not re-render on room updates. */
export const useRoomActions = () => {
    const context = useContext(RoomActionsContext);
    if (!context) throw new Error('useRoomActions must be used within a RoomProvider');
    return context;
};

/** Room data and sync status without the action functions. */
export const useRoomState = () => {
    const context = useContext(RoomStateContext);
    if (!context) throw new Error('useRoomState must be used within a RoomProvider');
    return context;
};
