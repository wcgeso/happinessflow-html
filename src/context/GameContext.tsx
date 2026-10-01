import {observeSnapshots} from '../utils/recoveringSnapshot';
import {usePublicFinancialEffects} from '../hooks/usePublicFinancialEffects';
import {withAutomaticHappiness} from '../game/finance/automaticHappiness';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    doc,
    updateDoc,
    getDocs,
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    documentId,
    setDoc,
    runTransaction,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { NEWS_CARD_MAP } from '../constants/cards';
import { FinancialAccelerationState, GameState, GameRecord, FinancialSummary, SharedExpenseEffect } from '../types';
import { calculateFinancialSummary, calculateScoreResult } from '../utils/gameUtils';
import { cleanObject, safeAsync } from '../utils/utils';
import { hasPublicPlayerStateChanged, toPublicPlayerState } from '../utils/playerState';
import { globalGameCoreEngine, CommandGateway, LegacyGameAdapter } from '../game';
import { runBoardTransactionWithRetry } from '../game/board/runBoardMutation';
import { createDefaultGameState, normalizeGameState } from '../utils/gameState';
import { trackGameEvent } from '../utils/telemetry';
import { debugLog } from '../utils/debugLog';

export { createDefaultGameState, normalizeGameState } from '../utils/gameState';

export const HISTORY_PAGE_SIZE = 20;

interface GameContextValue {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    completePlayerSetup: (state: GameState) => Promise<void>;
    gameHistory: GameRecord[];
    setGameHistory: React.Dispatch<React.SetStateAction<GameRecord[]>>;
    summary: FinancialSummary;
    financialAcceleration: FinancialAccelerationState;
    scoreResult: { totalScore: number; details: any[] };
    alertInfo: { message: string; type: 'info' | 'error' | 'success'; persist?: boolean } | null;
    showAlert: (message: string, type?: 'info' | 'error' | 'success', persist?: boolean) => void;
    hideAlert: () => void;
    saveGameRecord: (record: GameRecord) => Promise<void>;
    requestImmediatePlayerSync: () => void;
    updateMarketPrices: (updates: Record<string, number>, code: string) => void;
    bubbleBurst: (code: string) => void;
    sessionId: string | null;
    financialSyncError: {code:string;message:string} | null;
    retryFinancialSync: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

// 玩家端只同步自己擁有的設定與財務資料；棋盤位置、目前事件及待處理
// prompt 由 RoomContext/交易 transaction 維護，避免舊畫面快照反寫回房間。
const PLAYER_STATE_SYNC_FIELDS: Array<keyof GameState> = [
    'profession', 'selectedEnterprise', 'selectedDream', 'expenses', 'income',
    'currentRankTitle', 'currentRankLevel', 'cash', 'children', 'medicalInsuranceCount',
    'assets', 'liabilities', 'loans', 'isSetup', 'selectionStep', 'selectionDraft',
    'history', 'happiness', 'happinessTotal', 'marketPrices', 'previousMarketPrices',
    'marketPriceHistory', 'lastPublishedCode', 'lastMarketUpdateTimestamp',
    'lastSharedExpenseSyncedAt', 'lastSharedExpenseEventId', 'boardGameStartedAt',
    'abilities', 'completedHappinessEvents', 'appliedBoardFinancialEventIds', 'pendingMedicalClaims',
    'hasShownWinAnimation', 'playerName', 'reportName', 'sessionId'
];

const pickPlayerStateForSync = (state: GameState): Partial<GameState> => cleanObject(
    Object.fromEntries(PLAYER_STATE_SYNC_FIELDS.map(field => [field, state[field]]))
) as Partial<GameState>;

export const limitPlayerSyncHistory = (state: Partial<GameState>): Partial<GameState> => cleanObject({
    ...state,
    history: Array.isArray(state.history) ? state.history.slice(-100) : state.history,
    appliedBoardFinancialEventIds: Array.isArray(state.appliedBoardFinancialEventIds)
        ? state.appliedBoardFinancialEventIds.slice(-200)
        : state.appliedBoardFinancialEventIds,
    marketPriceHistory: state.marketPriceHistory
        ? Object.fromEntries(Object.entries(state.marketPriceHistory).map(([symbol, points]) => [
            symbol,
            Array.isArray(points) ? points.slice(-100) : points
        ]))
        : state.marketPriceHistory
}) as Partial<GameState>;

const serializedValue = (value: unknown) => JSON.stringify(value);

export const getChangedPlayerStateFields = (
    baseline: Partial<GameState> | null | undefined,
    desired: Partial<GameState>
): Partial<GameState> => Object.fromEntries(
    PLAYER_STATE_SYNC_FIELDS
        .filter(field => serializedValue(baseline?.[field]) !== serializedValue(desired[field]))
        .map(field => [field, desired[field]])
) as Partial<GameState>;

/**
 * Keep authoritative transaction results when a delayed local snapshot tries
 * to write an older value back to the private player document.
 */
export const getSafePlayerStatePatch = (
    baseline: Partial<GameState> | null | undefined,
    latest: Partial<GameState>,
    desired: Partial<GameState>
): Partial<GameState> => {
    const localPatch = getChangedPlayerStateFields(baseline, desired);
    return Object.fromEntries(
        Object.entries(localPatch).filter(([field]) =>
            serializedValue(latest[field as keyof GameState]) === serializedValue(baseline?.[field as keyof GameState])
        )
    ) as Partial<GameState>;
};

export const mergeAuthoritativePlayerState = (previous: GameState, remote: GameState): GameState => normalizeGameState({
    ...previous,
    ...remote,
    lastMarketUpdateTimestamp: Math.max(
        previous.lastMarketUpdateTimestamp || 0,
        remote.lastMarketUpdateTimestamp || 0
    ),
    pendingFamilyMilestoneJoinAction: remote.pendingFamilyMilestoneJoinAction,
    pendingMedicalClaims: Array.isArray(remote.pendingMedicalClaims) ? remote.pendingMedicalClaims : (previous.pendingMedicalClaims || []),
    assets: Array.isArray(remote.assets) ? remote.assets : (previous.assets || []),
    liabilities: Array.isArray(remote.liabilities) ? remote.liabilities : (previous.liabilities || []),
    history: Array.isArray(remote.history) ? remote.history : (previous.history || []),
    happiness: Array.isArray(remote.happiness) ? remote.happiness : (previous.happiness || [])
});

export const isPlayerStateForBoardGame = (
    state: GameState | null | undefined,
    startedAt: number | null | undefined
) => !!state && (!startedAt || state.boardGameStartedAt === startedAt);

/**
 * A board command owns the room transition while a card/movement is active.
 * Delay the legacy private-state bridge until that command has settled so a
 * stale local snapshot cannot compete with the board transaction.
 */
export const shouldDeferPlayerStateSync = (room: {
    isBoardGame?: boolean;
    status?: string;
    boardState?: {
        movement?: { isActive?: boolean } | null;
        currentEvent?: unknown;
        currentCard?: unknown;
        currentCardReveal?: unknown;
        pendingEvents?: unknown[];
        familyMilestoneJoinPrompt?: unknown;
        sharedCardPrompt?: unknown;
    } | null;
} | null | undefined) => {
    if (!room?.isBoardGame || room.status !== 'playing') return false;
    const boardState = room.boardState;
    return !!boardState?.movement?.isActive ||
        !!boardState?.currentEvent ||
        !!boardState?.currentCard ||
        !!boardState?.currentCardReveal ||
        (boardState?.pendingEvents?.length || 0) > 0 ||
        !!boardState?.familyMilestoneJoinPrompt ||
        !!boardState?.sharedCardPrompt;
};

export const isHiddenStockNewsCard = (room: {
    isBoardGame?: boolean;
    boardState?: {
        currentEvent?: { id?: string } | null;
        currentCard?: { deck?: string; cardId?: string } | null;
        currentCardReveal?: { eventId?: string; cardId?: string; isRevealed?: boolean } | null;
    } | null;
} | null | undefined) => {
    const boardState = room?.boardState;
    const card = boardState?.currentCard;
    const reveal = boardState?.currentCardReveal;
    return room?.isBoardGame === true &&
        card?.deck === 'news' &&
        !!card.cardId &&
        NEWS_CARD_MAP[card.cardId]?.type === 'stock_price' &&
        (!reveal ||
            reveal.eventId !== boardState?.currentEvent?.id ||
            reveal.cardId !== card.cardId ||
            reveal.isRevealed !== true);
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { room, playerStatesHydrated, roomSyncState, isController } = useRoom();

    // ─── Milestone 0.5: Adapter Wiring ───────────────────────────────────────
    // LegacyGameAdapter 就位，但所有 Feature Flags 為 false，
    // 任何 dispatch 都回傳 null，不接管任何行為。
    const coreGameAdapter = useMemo(
        () => new LegacyGameAdapter(new CommandGateway(globalGameCoreEngine)),
        []
    );
    // DEV only：確認 Adapter 接線成功（所有 flags = false，不接管任何行為）
    useEffect(() => {
        if (import.meta.env.DEV) {
            debugLog('[GameContext] coreGameAdapter ready:', coreGameAdapter.isReady());
        }
    }, [coreGameAdapter]);
    // ─────────────────────────────────────────────────────────────────────────

    const [gameState, setGameState] = useState<GameState>(createDefaultGameState);

    const [scoreRecords, setScoreRecords] = useState<GameRecord[]>([]);
    const [playerSessionRecords, setPlayerSessionRecords] = useState<GameRecord[]>([]);
    const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'info' | 'error' | 'success'; persist?: boolean } | null>(null);
    const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const saveToPlayerSessionsRef = useRef<((status: 'draft' | 'completed') => Promise<void>) | null>(null);
    const lastSyncedPlayerStateHashRef = useRef<string | null>(null);
    const lastAuthoritativePlayerStateRef = useRef<GameState | null>(null);
    const pendingLocalPlayerPatchRef = useRef<Partial<GameState>>({});
    const lastImmediateSyncRequestRef = useRef(0);
    const [immediateSyncRequest, setImmediateSyncRequest] = useState(0);

    const requestImmediatePlayerSync = useCallback(() => {
        setImmediateSyncRequest(request => request + 1);
    }, []);

    // 清除 Alert Timeout
    useEffect(() => {
        return () => {
            if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        };
    }, []);

    // 每次登入都從乾淨的本機狀態開始；正式遊戲資料由 Firestore 私有玩家文件恢復。
    const hydratedLocalStateUidRef = useRef<string | null>(null);
    useEffect(() => {
        if (!user?.uid) {
            hydratedLocalStateUidRef.current = null;
            sessionIdRef.current = null;
            lastSyncedPlayerStateHashRef.current = null;
            lastAuthoritativePlayerStateRef.current = null;
            pendingLocalPlayerPatchRef.current = {};
            setScoreRecords([]);
            setPlayerSessionRecords([]);
            setAlertInfo(null);
            setGameState(createDefaultGameState());
            return;
        }
        if (hydratedLocalStateUidRef.current === user.uid) return;
        hydratedLocalStateUidRef.current = user.uid;

        sessionIdRef.current = null;
        setAlertInfo(null);
        setGameState(createDefaultGameState());
    }, [user?.uid]);

    // 生成 sessionId（遊戲開始時）
    useEffect(() => {
        if (gameState.isSetup && user && !sessionIdRef.current) {
            sessionIdRef.current = `${user.uid}_${Date.now()}`;
        }
        if (!gameState.isSetup && !gameState.selectionStep) {
            sessionIdRef.current = null;
        }
    }, [gameState.isSetup, gameState.selectionStep, user]);

    const roomMedicalInsuranceCount = user?.uid
        ? room?.playerStates?.[user.uid]?.medicalInsuranceCount || 0
        : 0;
    const roomPlayerIsSetup = user?.uid
        ? !!room?.publicPlayerStates?.[user.uid]?.isSetup
        : false;
    const roomHasPlayerState = user?.uid
        ? !!room?.playerStates?.[user.uid]
        : false;
    const roomPlayerState = user?.uid ? room?.playerStates?.[user.uid] : undefined;
    const isRoomMember = !!(room?.members || []).some(member => member.uid === user?.uid);

    // 自動同步到房間文件 (供執行師監控)
    useEffect(() => {
        // 選擇畫面內容只是本機草稿；正式選擇由 completePlayerSetup() 原子提交，
        // 不要讓草稿同步與執行師開始新局時的玩家文件重建互相競爭。
        if (!room?.id || !user || user.uid === room.hostId || !isRoomMember || !playerStatesHydrated || roomSyncState !== 'synced') return;
        if (!gameState.isSetup) return;
        if (room.flowSchemaVersion === 1 || shouldDeferPlayerStateSync(room)) return;
        // 防止跨場遊戲殘留狀態外洩（C2）：本地 gameState 必須是「為了目前這場
        // 房間遊戲（room.startedAt）而重設/建立的」才允許同步進 Firestore。
        // 玩家剛加入新房間、但本地還殘留上一場遊戲的 gameState（尚未被
        // App.tsx 的重設流程處理到）時，這裡直接跳過，避免把上一場的財務
        // 資料寫進新房間的 playerStates，之後又被誤判為「斷線重連的雲端
        // 存檔」而還原回本地，造成新局帶著上一場的錢開局。
        if (room.startedAt && gameState.boardGameStartedAt !== room.startedAt) return;

        // 初始財報與醫院事件會直接讀取房間玩家狀態，不能等待一般防抖同步。
        const insuranceChanged = roomMedicalInsuranceCount !== (gameState.medicalInsuranceCount || 0);
        const setupSyncPending = gameState.isSetup && (!roomPlayerIsSetup || !roomHasPlayerState);
        const syncUid = user.uid;
        const syncRoomId = room.id;
        const persistedState = limitPlayerSyncHistory(pickPlayerStateForSync(gameState));
        const stateHash = JSON.stringify(persistedState);
        const baselineState = lastAuthoritativePlayerStateRef.current || roomPlayerState || null;
        const localPatch = getChangedPlayerStateFields(baselineState, persistedState);
        if (Object.keys(localPatch).length > 0) {
            pendingLocalPlayerPatchRef.current = {
                ...pendingLocalPlayerPatchRef.current,
                ...localPatch
            };
        }
        // Remote-only snapshots must not start another player transaction. This
        // is the common source of pointless reads while other players act.
        if (!insuranceChanged && !setupSyncPending && Object.keys(localPatch).length === 0) {
            return;
        }
        if (!insuranceChanged && !setupSyncPending && stateHash === lastSyncedPlayerStateHashRef.current) {
            return;
        }
        const shouldSyncImmediately = immediateSyncRequest > lastImmediateSyncRequestRef.current;
        if (shouldSyncImmediately) lastImmediateSyncRequestRef.current = immediateSyncRequest;
        const timeoutId = setTimeout(async () => {
            if (auth.currentUser?.uid !== syncUid) return;
            const playerRef = doc(db, 'rooms', syncRoomId, 'players', syncUid);
            const roomRef = doc(db, 'rooms', syncRoomId);
            const syncStartedAt = performance.now();
            let safePatchFields: string[] = [];
            try {
                const nextState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
                    // 相容同步只交易玩家自己的文件；讀取整個房間會讓每次回合／卡片
                    // 更新都和這條非權威同步互相競爭。新局開始時玩家文件會被刪除重建，
                    // 因此用 boardGameStartedAt 驗證場次，避免舊局資料寫回新局。
                    const playerSnapshot = await transaction.get(playerRef);
                    if (!playerSnapshot.exists()) return null;
                    const latestState = (playerSnapshot.exists() ? playerSnapshot.data() : {}) as GameState;
                    if (latestState.boardGameStartedAt && persistedState.boardGameStartedAt !== latestState.boardGameStartedAt) {
                        throw new Error('目前場次已更新，請重新整理後再同步');
                    }
                    const baseline = baselineState || latestState;
                    const safePatch = getSafePlayerStatePatch(baseline, latestState, persistedState);
                    safePatchFields = Object.keys(safePatch);
                    const committedState = { ...latestState, ...safePatch } as GameState;
                    if (Object.keys(safePatch).length > 0) {
                        transaction.set(playerRef, cleanObject(committedState), { merge: true });
                    }
                    return committedState;
                }));
                if (!nextState) return;
                lastAuthoritativePlayerStateRef.current = nextState;
                lastSyncedPlayerStateHashRef.current = JSON.stringify(limitPlayerSyncHistory(pickPlayerStateForSync(nextState)));
                Object.keys(localPatch).forEach(field => {
                    const key = field as keyof GameState;
                    if (serializedValue(pendingLocalPlayerPatchRef.current[key]) === serializedValue(persistedState[key])) {
                        delete pendingLocalPlayerPatchRef.current[key];
                    }
                });
                setGameState(prev => mergeAuthoritativePlayerState(prev, nextState));
                const nextPublicState = toPublicPlayerState(syncUid, nextState);
                if (room?.status === 'playing' && hasPublicPlayerStateChanged(room.publicPlayerStates?.[syncUid], nextPublicState)) {
                    // 公開摘要是執行師投影，不應讓它把玩家交易綁回房間 transaction；
                    // 權威玩家資料已先成功寫入，摘要失敗可由下一次同步補上。
                    await safeAsync(
                        updateDoc(roomRef, { [`publicPlayerStates.${syncUid}`]: nextPublicState }),
                        null,
                        error => console.error('[GameContext] 更新玩家公開摘要失敗:', error)
                    );
                }
                setAlertInfo(current => current?.message.startsWith('玩家資料同步失敗') ? null : current);
                void trackGameEvent('player_state_sync', {
                    result: safePatchFields.length > 0 || setupSyncPending || !roomHasPlayerState ? 'committed' : 'no_change',
                    local_patch_fields: Object.keys(localPatch).length,
                    committed_fields: safePatchFields.length,
                    duration_ms: Math.round(performance.now() - syncStartedAt),
                    trace_id: `player-sync:${syncRoomId}:${stateHash.slice(0, 12)}`
                }).catch(() => undefined);
            } catch (err: any) {
                if (auth.currentUser?.uid !== syncUid || room?.id !== syncRoomId) return;
                console.error('[GameContext] 同步玩家狀態失敗:', err);
                const code = err?.code || 'unknown';
                const reason = code === 'permission-denied'
                    ? '房間權限或玩家資格已變更'
                    : code === 'resource-exhausted'
                        ? 'Firebase 額度不足'
                        : code === 'unavailable' || code === 'deadline-exceeded'
                            ? '網路或資料庫暫時無法連線'
                            : err?.message || '資料格式或同步操作失敗';
                setAlertInfo({
                    message: `玩家資料同步失敗（${code}）：${reason}。請確認連線後再試一次。`,
                    type: 'error',
                    persist: true
                });
                void trackGameEvent('player_state_sync', {
                    result: 'failed',
                    error_code: code,
                    local_patch_fields: Object.keys(localPatch).length,
                    committed_fields: safePatchFields.length,
                    duration_ms: Math.round(performance.now() - syncStartedAt),
                    trace_id: `player-sync:${syncRoomId}:${stateHash.slice(0, 12)}`
                }).catch(() => undefined);
            }
        }, shouldSyncImmediately || insuranceChanged || setupSyncPending ? 0 : 800);

        return () => clearTimeout(timeoutId);
    }, [gameState, immediateSyncRequest, isRoomMember, playerStatesHydrated, roomSyncState, room?.id, room?.hostId, room?.members, room?.startedAt, room?.status, room?.boardState, roomMedicalInsuranceCount, roomPlayerIsSetup, roomHasPlayerState, roomPlayerState, user?.uid, user?.role]);

    // 房間私有狀態是多人遊戲中的權威來源。執行師調整玩家現金等操作會先
    // 寫入 rooms/{roomId}/players/{uid}，玩家端收到 RoomContext 快照後必須
    // 更新本地 gameState，否則下一次自動同步會把舊資料寫回去。
    useEffect(() => {
        if (!room?.id || !user?.uid || user.uid === room.hostId || !roomPlayerState || roomSyncState !== 'synced') return;
        if (!isPlayerStateForBoardGame(roomPlayerState, room.startedAt)) return;

        const previousAuthoritative = lastAuthoritativePlayerStateRef.current;
        lastAuthoritativePlayerStateRef.current = roomPlayerState;
        lastSyncedPlayerStateHashRef.current = JSON.stringify(limitPlayerSyncHistory(pickPlayerStateForSync(roomPlayerState)));

        // 權威資料在這段等待期間可能已經被別的交易改過（例如先領銀行月結餘、
        // 再扣機運卡費用）。暫存的本機差異若是針對「更早那份」權威值算出來的，
        // 就已經過期；繼續套用只會把新算好的金額蓋回舊數字，必須先丟棄。
        if(room.flowSchemaVersion === 1) pendingLocalPlayerPatchRef.current={};
        Object.keys(pendingLocalPlayerPatchRef.current).forEach(field => {
            const key = field as keyof GameState;
            const authoritativeUnchanged = !previousAuthoritative ||
                serializedValue(roomPlayerState[key]) === serializedValue(previousAuthoritative[key]);
            if (!authoritativeUnchanged) {
                delete pendingLocalPlayerPatchRef.current[key];
            }
        });

        setGameState(prev => {
            const synchronizedState = mergeAuthoritativePlayerState(prev, roomPlayerState);
            Object.entries(pendingLocalPlayerPatchRef.current).forEach(([field, value]) => {
                const key = field as keyof GameState;
                if (serializedValue(synchronizedState[key]) !== serializedValue(value)) {
                    synchronizedState[key] = value as never;
                }
            });

            return JSON.stringify(prev) === JSON.stringify(synchronizedState)
                ? prev
                : synchronizedState;
        });
    }, [room?.id, room?.hostId, room?.startedAt, roomPlayerState, roomSyncState, user?.uid]);

    const hideAlert = useCallback(() => {
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current);
            alertTimeoutRef.current = null;
        }
        setAlertInfo(null);
    }, []);

    const completePlayerSetup = useCallback(async (nextState: GameState) => {
        if (!room?.id || !user?.uid || user.uid === room.hostId) {
            setGameState(nextState);
            return;
        }

        const roomRef = doc(db, 'rooms', room.id);
        const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
        const playerPatch = limitPlayerSyncHistory(pickPlayerStateForSync(withAutomaticHappiness(nextState,room.financialAcceleration)));
        const committedState = await runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
            const [roomSnapshot, playerSnapshot] = await Promise.all([
                transaction.get(roomRef),
                transaction.get(playerRef)
            ]);
            if (!roomSnapshot.exists()) throw new Error('房間不存在，選擇尚未儲存。');

            const latestRoom = roomSnapshot.data() as {
                status?: string;
                startedAt?: number;
                memberUids?: string[];
                members?: Array<{ uid: string }>;
                publicPlayerStates?: Record<string, any>;
            };
            if (latestRoom.status !== 'playing' || latestRoom.startedAt !== nextState.boardGameStartedAt) {
                throw new Error('目前遊戲場次已變更，請重新整理後再選擇。');
            }
            const isMember = latestRoom.memberUids?.includes(user.uid) || latestRoom.members?.some(member => member.uid === user.uid);
            if (!isMember) throw new Error('你已不在目前房間，選擇尚未儲存。');
            if (auth.currentUser?.uid !== user.uid) throw new Error('登入帳號已變更，請重新登入後再試。');

            const latestPlayerState = (playerSnapshot.exists() ? playerSnapshot.data() : {}) as GameState;
            const alreadySetup = latestPlayerState.isSetup === true;
            const sameSelection = latestPlayerState.profession?.id === nextState.profession?.id &&
                latestPlayerState.selectedEnterprise?.id === nextState.selectedEnterprise?.id &&
                latestPlayerState.selectedDream?.id === nextState.selectedDream?.id;
            if (alreadySetup && !sameSelection) {
                throw new Error('這個帳號已在其他分頁完成選擇，請重新整理載入已儲存的設定。');
            }

            const committedState = alreadySetup
                ? latestPlayerState
                : cleanObject({ ...latestPlayerState, ...playerPatch }) as GameState;
            if (!alreadySetup) transaction.set(playerRef, committedState, { merge: true });

            const nextPublicState = toPublicPlayerState(user.uid, committedState);
            if (hasPublicPlayerStateChanged(latestRoom.publicPlayerStates?.[user.uid], nextPublicState)) {
                transaction.update(roomRef, { [`publicPlayerStates.${user.uid}`]: nextPublicState });
            }
            return committedState;
        }));

        lastAuthoritativePlayerStateRef.current = committedState;
        lastSyncedPlayerStateHashRef.current = JSON.stringify(limitPlayerSyncHistory(pickPlayerStateForSync(committedState)));
        setGameState(committedState);
    }, [room?.id, room?.hostId, user?.uid]);

    const showAlert = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info', persist: boolean = false) => {
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current);
            alertTimeoutRef.current = null;
        }

        setAlertInfo({ message, type, persist });
        if (!persist) {
            alertTimeoutRef.current = setTimeout(() => {
                setAlertInfo(null);
                alertTimeoutRef.current = null;
            }, 3000);
        }
    }, []);

    // Room snapshots replace objects even when only the board changes.
    const financialAcceleration = useMemo<FinancialAccelerationState>(() => ({
        multiplier: room?.financialAcceleration?.multiplier || 1,
        updatedAt: room?.financialAcceleration?.updatedAt,
        updatedByUid: room?.financialAcceleration?.updatedByUid,
        updatedByName: room?.financialAcceleration?.updatedByName,
    }), [room?.financialAcceleration?.multiplier, room?.financialAcceleration?.updatedAt,
        room?.financialAcceleration?.updatedByUid, room?.financialAcceleration?.updatedByName]);
    const summary = useMemo(() => calculateFinancialSummary(gameState, financialAcceleration), [gameState, financialAcceleration]);

    const seenAccelerationRef = useRef<string | null>(null);
    useEffect(() => {
        if (!room?.id) {
            seenAccelerationRef.current = null;
            return;
        }
        const accelerationKey = `${room.id}:${financialAcceleration.updatedAt || 0}:${financialAcceleration.multiplier}`;
        if (seenAccelerationRef.current === null) {
            seenAccelerationRef.current = accelerationKey;
            return;
        }
        if (seenAccelerationRef.current !== accelerationKey && user?.uid !== room.hostId) {
            showAlert(`⚡ 本局收益倍率已調整為 ×${financialAcceleration.multiplier}，只影響後續收益`, 'info', true);
        }
        seenAccelerationRef.current = accelerationKey;
    }, [room?.id, room?.hostId, financialAcceleration, user?.uid, showAlert]);

    const scoreResult = useMemo(() => {
        return calculateScoreResult(gameState, summary);
    }, [gameState, summary]);

    // 寫入 player_sessions 的共用函式
    const saveToPlayerSessions = useCallback(async (status: 'draft' | 'completed') => {
        if (!user || !sessionIdRef.current || !gameState.isSetup) return;
        if (localStorage.getItem('hf_practice_mode') === 'true') return;

        const sessionId = sessionIdRef.current;
        const now = new Date().toISOString();
        const data = cleanObject({
            uid: user.uid,
            playerName: gameState.playerName || (user as any).name || 'Unknown',
            roomId: room?.id || null,
            historySource: room?.financialHistoryStorage === 'subcollection' && room.sessionId && user?.uid
                ? {roomId:room.id, sessionId:room.sessionId, uid:user.uid} : null,
            sessionId,
            status,
            profession: gameState.currentRankTitle || gameState.profession?.title || 'Unknown',
            finalScore: scoreResult.totalScore,
            happinessScore: gameState.happinessTotal,
            isWin: gameState.happinessTotal >= 100,
            financialSummary: summary,
            gameStateSnapshot: {
                assets: gameState.assets,
                liabilities: gameState.liabilities,
                income: gameState.income,
                expenses: gameState.expenses,
                history: gameState.history.slice(-100),
                happiness: gameState.happiness,
                cash: gameState.cash,
                loans: gameState.loans,
            },
            updatedAt: now,
            createdAt: now,
        });

        const docRef = doc(db, 'player_sessions', user.uid, 'records', sessionId);
        await safeAsync(setDoc(docRef, data, { merge: true }));
    }, [user, gameState, room?.id, scoreResult, summary]);

    // 保持 ref 指向最新版本，讓 interval 呼叫時能拿到最新 gameState
    useEffect(() => {
        saveToPlayerSessionsRef.current = saveToPlayerSessions;
    }, [saveToPlayerSessions]);

    // 房間玩家文件是斷線恢復的權威來源；歷史草稿只做低頻備份。
    useEffect(() => {
        if (!gameState.isSetup || !user) return;

        saveToPlayerSessionsRef.current?.('draft');

        const interval = setInterval(() => {
            saveToPlayerSessionsRef.current?.('draft');
        }, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, [gameState.isSetup, user]);

    // Presentation mirrors the same pure calculation committed by financial transactions.
    useEffect(()=>{
        setGameState(previous=>{
            const next=withAutomaticHappiness(previous,financialAcceleration);
            return JSON.stringify(previous.happiness)===JSON.stringify(next.happiness) && previous.happinessTotal===next.happinessTotal ? previous : next;
        });
    },[summary.passiveIncome,summary.totalExpenses,gameState.assets,gameState.isSetup,gameState.happiness,financialAcceleration]);

    // 歷史資料不是遊戲中的即時狀態；遊戲進行中不查詢，回到大廳／結算
    // 時只讀一次，避免歷史草稿更新觸發持續監聽。
    useEffect(() => {
        if (!user) {
            setScoreRecords([]);
            return;
        }
        if (room?.status === 'playing') return;

        const q = query(
            collection(db, 'score_records', 'S1', 'records'),
            where('playerUids', 'array-contains', user.uid),
            limit(HISTORY_PAGE_SIZE)
        );

        void getDocs(q).then((snapshot) => {
            const records: GameRecord[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (!data.players || !Array.isArray(data.players)) return;
                const playerData = data.players.find((p: any) => p.uid === user.uid);
                if (!playerData) return;

                records.push({
                    id: docSnap.id,
                    roomId: data.roomId,
                    historySource: data.financialHistoryStorage === 'subcollection' && data.roomId && data.sessionId
                        ? {roomId:data.roomId, sessionId:data.sessionId, uid:user.uid} : data.historySource || undefined,
                    date: data.settledAt?.toDate ? data.settledAt.toDate().toISOString() :
                        (data.settledAt ? new Date(data.settledAt).toISOString() : new Date().toISOString()),
                    playerName: playerData.name,
                    reportName: data.roomName || `${playerData.name} 的財務報表`,
                    profession: playerData.profession,
                    finalScore: playerData.totalScore || 0,
                    happinessScore: playerData.happiness || 0,
                    isWin: playerData.happiness >= 100,
                    status: data.isFinal ? 'completed' : 'draft',
                    financialSummary: playerData.summary || {
                        totalIncome: 0, totalExpenses: 0, monthlyCashflow: 0,
                        passiveIncome: 0, totalAssets: 0, totalLiabilities: 0, payday: 0
                    },
                    gameStateSnapshot: {
                        assets: playerData.assets || [],
                        liabilities: playerData.liabilities || [],
                        income: playerData.income || {},
                        expenses: playerData.expenses || {},
                        history: playerData.history || [],
                        happiness: playerData.happinessItems || [],
                        cash: playerData.cash || 0,
                        loans: playerData.loans || 0
                    },
                    allPlayers: (data.players || []).map((p: any) => ({
                        name: p.name || '玩家',
                        happiness: p.happiness ?? p.happinessTotal ?? 0,
                        totalScore: p.totalScore ?? p.score ?? 0,
                        profession: p.profession || '未知職業'
                    }))
                });
            });

            records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setScoreRecords(records);
        }).catch((error) => {
            console.error("[GameContext] 獲取官方歷史紀錄失敗:", error);
        });
    }, [room?.status, user]);

    // 玩家自存紀錄只在非遊戲狀態讀取一次；官方紀錄在 gameHistory 合併時優先。
    useEffect(() => {
        if (!user) {
            setPlayerSessionRecords([]);
            return;
        }
        if (room?.status === 'playing') return;

        const q = query(
            collection(db, 'player_sessions', user.uid, 'records'),
            orderBy('updatedAt', 'desc'),
            limit(HISTORY_PAGE_SIZE)
        );

        void getDocs(q).then((snapshot) => {
            const records: GameRecord[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                records.push({
                    id: docSnap.id,
                    roomId: data.roomId,
                    historySource: data.financialHistoryStorage === 'subcollection' && data.roomId && data.sessionId
                        ? {roomId:data.roomId, sessionId:data.sessionId, uid:user.uid} : data.historySource || undefined,
                    date: data.updatedAt || new Date().toISOString(),
                    playerName: data.playerName || 'Unknown',
                    reportName: data.playerName ? `${data.playerName} 的財務報表` : '我的財務報表',
                    profession: data.profession || 'Unknown',
                    finalScore: data.finalScore || 0,
                    happinessScore: data.happinessScore || 0,
                    isWin: data.isWin || false,
                    status: data.status || 'draft',
                    financialSummary: data.financialSummary || {
                        totalIncome: 0, totalExpenses: 0, monthlyCashflow: 0,
                        passiveIncome: 0, totalAssets: 0, totalLiabilities: 0, payday: 0
                    },
                    gameStateSnapshot: data.gameStateSnapshot || {
                        assets: [], liabilities: [], income: {}, expenses: {},
                        history: [], happiness: [], cash: 0, loans: 0
                    },
                });
            });

            setPlayerSessionRecords(records);
        }).catch((error) => {
            console.error("[GameContext] 獲取玩家自存紀錄失敗:", error);
        });
    }, [room?.status, user]);

    const saveGameRecord = useCallback(async (record: GameRecord) => {
        await saveToPlayerSessions('completed');
        showAlert('遊戲紀錄已保存', 'success');
    }, [saveToPlayerSessions, showAlert]);

    const updateMarketPrices = useCallback((updates: Record<string, number>, code: string) => {
        setGameState(prev => ({
            ...prev,
            previousMarketPrices: { ...prev.marketPrices },
            marketPrices: { ...prev.marketPrices, ...updates },
            lastPublishedCode: code
        }));
    }, []);

    const bubbleBurst = useCallback((code: string) => {
        setGameState(prev => {
            const updatedAssets = (prev.assets || []).map(asset => {
                if (asset.type === '股票') {
                    const newQty = Math.floor((asset.quantity || 0) / 2);
                    return {
                        ...asset,
                        quantity: newQty,
                        cost: newQty * (asset.lastPurchasePrice || 0)
                    };
                }
                return asset;
            }).filter(asset => asset.type !== '股票' || (asset.quantity || 0) > 0);

            return {
                ...prev,
                assets: updatedAssets,
                lastPublishedCode: code
            };
        });
    }, []);

    const {failure:financialSyncError,retry:retryFinancialSync}=usePublicFinancialEffects({
        db,roomId:room?.id,sessionId:room?.sessionId,uid:user?.uid,
        enabled:room?.flowSchemaVersion===1 && user?.uid!==room?.hostId && isController && gameState.isSetup,
        timestamp:gameState.lastPublicEffectTimestamp,effectId:gameState.lastPublicEffectId
    });

    // 房間主 listener 已經帶回行情更新，避免玩家端再開第二條同房間 listener。
    useEffect(() => {
        if(room?.flowSchemaVersion===1)return;
        const marketUpdate = room?.marketUpdates;
        if (!room?.id || user?.uid === room.hostId || !gameState.isSetup || !marketUpdate) return;
        if (isHiddenStockNewsCard(room)) return;
        if (marketUpdate.timestamp <= (gameState.lastMarketUpdateTimestamp || 0)) return;

        const { updates, code, isBubble } = marketUpdate;
        if (isBubble) {
            bubbleBurst(code);
            updateMarketPrices(updates, code);
            showAlert(`💥 股市泡沫破裂！代碼：${code}\n所有股票數量已減半。`, 'error', true);
        } else {
            updateMarketPrices(updates, code);
            showAlert(`📈 股市行情已更新！代碼：${code}\n請檢查股市面板查看最新價格。`, 'success', true);
        }

        setGameState(prev => ({
            ...prev,
            lastMarketUpdateTimestamp: marketUpdate.timestamp
        }));
    }, [room, user?.uid, gameState.isSetup, gameState.lastMarketUpdateTimestamp, bubbleBurst, updateMarketPrices, showAlert]);

    // 監聽共享棋盤支出效果（例如新聞卡「全體支出調整」）回灌到本地 gameState。
    // 事件本身只放在公開棋盤狀態，財務數字仍由每位玩家自己的私有文件保存。
    useEffect(() => {
        if (!room?.id || !user?.uid || user.uid === room.hostId || !gameState.isSetup) return;

        if(room.flowSchemaVersion===1)return;
        const effect = room.boardState?.sharedExpenseEffect as SharedExpenseEffect | null | undefined;
        if (!effect || effect.sourcePlayerUid === user.uid || effect.id === gameState.lastSharedExpenseEventId) return;

        setGameState(prev => {
            const currentValue = prev.expenses?.[effect.category] || 0;
            const nextValue = effect.isIncrease
                ? currentValue + effect.amount
                : Math.max(0, currentValue - effect.amount);
            return {
                ...prev,
                expenses: { ...prev.expenses, [effect.category]: nextValue },
                lastSharedExpenseSyncedAt: effect.timestamp,
                lastSharedExpenseEventId: effect.id,
                lastBoardEvent: effect.summary,
                pendingCardAction: effect.detail || effect.summary
            };
        });
        showAlert(`📋 ${effect.summary}，財務報表已同步更新`, 'info', true);
    }, [room?.id, room?.hostId, room?.boardState?.sharedExpenseEffect, user?.uid, gameState.isSetup, gameState.lastSharedExpenseEventId, showAlert]);

    // 合併官方紀錄 + 玩家自存紀錄（官方優先，自存紀錄補充沒有官方紀錄的場次）
    const gameHistory = useMemo(() => {
        const officialRoomIds = new Set(scoreRecords.map(record => record.roomId).filter(Boolean));
        return [...scoreRecords, ...playerSessionRecords.filter(record => !record.roomId || !officialRoomIds.has(record.roomId))]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [scoreRecords, playerSessionRecords]);

    const setGameHistory = useCallback(() => {}, []);

    const sessionId = sessionIdRef.current;
    const contextValue = useMemo(() => ({
        gameState, setGameState, completePlayerSetup, gameHistory, setGameHistory,
        summary, financialAcceleration, scoreResult, alertInfo, showAlert, hideAlert,
        saveGameRecord, requestImmediatePlayerSync, updateMarketPrices, bubbleBurst,
        sessionId, financialSyncError, retryFinancialSync,
    }), [gameState, completePlayerSetup, gameHistory, setGameHistory, summary, financialAcceleration,
        scoreResult, alertInfo, showAlert, hideAlert, saveGameRecord, requestImmediatePlayerSync,
        updateMarketPrices, bubbleBurst, sessionId, financialSyncError, retryFinancialSync]);

    return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};
