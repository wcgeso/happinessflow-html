import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    doc,
    updateDoc,
    onSnapshot,
    collection,
    getDoc,
    query,
    where,
    orderBy,
    setDoc,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { GameState, GameRecord, FinancialSummary, SharedExpenseEffect } from '../types';
import { calculateFinancialSummary, calculateScoreResult } from '../utils/gameUtils';
import { cleanObject, safeAsync } from '../utils/utils';
import { hasPublicPlayerStateChanged, toPublicPlayerState } from '../utils/playerState';
import { globalGameCoreEngine, CommandGateway, LegacyGameAdapter } from '../game';

interface GameContextValue {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    gameHistory: GameRecord[];
    setGameHistory: React.Dispatch<React.SetStateAction<GameRecord[]>>;
    summary: FinancialSummary;
    scoreResult: { totalScore: number; details: any[] };
    alertInfo: { message: string; type: 'info' | 'error' | 'success'; persist?: boolean } | null;
    showAlert: (message: string, type?: 'info' | 'error' | 'success', persist?: boolean) => void;
    hideAlert: () => void;
    saveGameRecord: (record: GameRecord) => Promise<void>;
    updateMarketPrices: (updates: Record<string, number>, code: string) => void;
    bubbleBurst: (code: string) => void;
    sessionId: string | null;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { room } = useRoom();

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
            console.debug('[GameContext] coreGameAdapter ready:', coreGameAdapter.isReady());
        }
    }, [coreGameAdapter]);
    // ─────────────────────────────────────────────────────────────────────────

    // localStorage 的還原鍵值必須帶帳號 uid 才能還原，避免同一台裝置換帳號
    // 登入時，把上一個帳號的財務資料誤還原成新登入者的 gameState（見稽核
    // 報告 C2）。useState 初始化時 useAuth() 的 user 通常還沒 hydrate 完成
    // （Firebase Auth 是非同步的），所以這裡先給預設值，實際還原交給下面
    // 依 user?.uid 觸發的 effect 處理。
    const getGameStateStorageKey = (uid: string) => `happiness_game_state_${uid}`;

    const [gameState, setGameState] = useState<GameState>(() => {
        return {
            profession: null,
            selectedEnterprise: null,
            selectedDream: null,
            currentRankTitle: '',
            currentRankLevel: 1,
            cash: 0,
            children: 0,
            medicalInsuranceCount: 0,
            assets: [],
            liabilities: [],
            loans: 0,
            isSetup: false,
            selectionStep: null,
            history: [],
            happiness: [],
            happinessTotal: 0,
            marketPrices: {},
            previousMarketPrices: {},
            lastPublishedCode: '',
            abilities: {
                stockAbilityCount: 0,
                realEstateAbilityCount: 0,
                professionAbilityCount: 0,
            },
            completedHappinessEvents: [],
            playerName: '',
            reportName: ''
        } as GameState;
    });

    const [scoreRecords, setScoreRecords] = useState<GameRecord[]>([]);
    const [playerSessionRecords, setPlayerSessionRecords] = useState<GameRecord[]>([]);
    const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'info' | 'error' | 'success'; persist?: boolean } | null>(null);
    const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const saveToPlayerSessionsRef = useRef<((status: 'draft' | 'completed') => Promise<void>) | null>(null);

    // 清除 Alert Timeout
    useEffect(() => {
        return () => {
            if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        };
    }, []);

    // 帳號可用後，還原這個帳號自己專屬的本機存檔（只在還沒開始任何設定流程
    // 時還原一次，避免蓋掉使用者這個工作階段內已經產生的新狀態）。
    const hasHydratedLocalStateRef = useRef(false);
    useEffect(() => {
        if (!user?.uid || hasHydratedLocalStateRef.current) return;
        hasHydratedLocalStateRef.current = true;

        const saved = localStorage.getItem(getGameStateStorageKey(user.uid));
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved) as GameState;
            setGameState(prev => (prev.isSetup || prev.selectionStep ? prev : parsed));
        } catch (e) {
            console.error('Failed to parse saved game state', e);
        }
    }, [user?.uid]);

    // 自動保存到 localStorage（依帳號 uid 分開存放，避免同裝置換帳號互相汙染）
    useEffect(() => {
        if (!user?.uid) return;
        if (gameState.isSetup || gameState.selectionStep) {
            localStorage.setItem(getGameStateStorageKey(user.uid), JSON.stringify(gameState));
        }
    }, [gameState, user?.uid]);

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

    // 自動同步到房間文件 (供執行師監控)
    useEffect(() => {
        // 只要不是房主，且 (已完成初始設定 或 正在進行選擇步驟)，就同步狀態
        if (!room?.id || !user || user.uid === room.hostId) return;
        if (!gameState.isSetup && !gameState.selectionStep) return;
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
        const timeoutId = setTimeout(async () => {
            const playerRef = doc(db, 'rooms', room.id, 'players', user.uid);
            const roomRef = doc(db, 'rooms', room.id);
            try {
                const playerSnap = await getDoc(playerRef);
                const existingRoomState = playerSnap.exists() ? playerSnap.data() : undefined;
                const roomHasNewerSharedExpense =
                    (existingRoomState?.lastSharedExpenseSyncedAt || 0) > (gameState.lastSharedExpenseSyncedAt || 0);
                const cleanedState = cleanObject({
                    ...gameState,
                    boardPosition: existingRoomState?.boardPosition ?? gameState.boardPosition,
                    skipTurns: existingRoomState?.skipTurns ?? gameState.skipTurns,
                    lastBoardEvent: existingRoomState?.lastBoardEvent ?? gameState.lastBoardEvent,
                    pendingCardAction: existingRoomState?.pendingCardAction ?? gameState.pendingCardAction,
                    bankServiceWindowActive: existingRoomState?.bankServiceWindowActive ?? gameState.bankServiceWindowActive,
                    bankServiceGrantedAtEventId: existingRoomState?.bankServiceGrantedAtEventId ?? gameState.bankServiceGrantedAtEventId,
                    pendingFamilyMilestoneJoinAction: existingRoomState?.pendingFamilyMilestoneJoinAction ?? gameState.pendingFamilyMilestoneJoinAction,
                    ...(roomHasNewerSharedExpense ? {
                        expenses: existingRoomState?.expenses ?? gameState.expenses,
                        lastSharedExpenseSyncedAt: existingRoomState?.lastSharedExpenseSyncedAt
                    } : {})
                });
                const batch = writeBatch(db);
                batch.set(playerRef, cleanedState, { merge: true });
                const nextPublicState = toPublicPlayerState(user.uid, cleanedState as GameState);
                if (hasPublicPlayerStateChanged(room?.publicPlayerStates?.[user.uid], nextPublicState)) {
                    batch.update(roomRef, {
                        [`publicPlayerStates.${user.uid}`]: nextPublicState
                    });
                }
                await batch.commit();
            } catch (err: any) {
                console.error('[GameContext] 同步玩家狀態失敗:', err);
                setAlertInfo({
                    message: `玩家資料同步失敗：${err?.message || '請重新整理後再試一次'}`,
                    type: 'error',
                    persist: true
                });
            }
        }, insuranceChanged || setupSyncPending ? 0 : 800);

        return () => clearTimeout(timeoutId);
    }, [gameState, room?.id, room?.hostId, room?.startedAt, roomMedicalInsuranceCount, roomPlayerIsSetup, roomHasPlayerState, user?.uid, user?.role]);

    // 房間私有狀態是多人遊戲中的權威來源。執行師調整玩家現金等操作會先
    // 寫入 rooms/{roomId}/players/{uid}，玩家端收到 RoomContext 快照後必須
    // 更新本地 gameState，否則下一次自動同步會把舊資料寫回去。
    useEffect(() => {
        if (!room?.id || !user?.uid || user.uid === room.hostId || !roomPlayerState) return;

        setGameState(prev => {
            const synchronizedState = {
                ...prev,
                ...roomPlayerState,
                assets: Array.isArray(roomPlayerState.assets) ? roomPlayerState.assets : (prev.assets || []),
                liabilities: Array.isArray(roomPlayerState.liabilities) ? roomPlayerState.liabilities : (prev.liabilities || []),
                history: Array.isArray(roomPlayerState.history) ? roomPlayerState.history : (prev.history || []),
                happiness: Array.isArray(roomPlayerState.happiness) ? roomPlayerState.happiness : (prev.happiness || [])
            };

            return JSON.stringify(prev) === JSON.stringify(synchronizedState)
                ? prev
                : synchronizedState;
        });
    }, [room?.id, room?.hostId, roomPlayerState, user?.uid]);

    const hideAlert = useCallback(() => {
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current);
            alertTimeoutRef.current = null;
        }
        setAlertInfo(null);
    }, []);

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

    const summary = useMemo(() => calculateFinancialSummary(gameState), [gameState]);

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

    // 遊戲開始後立刻存一次，之後每 60 秒自動存檔草稿到 player_sessions
    useEffect(() => {
        if (!gameState.isSetup || !user) return;

        saveToPlayerSessionsRef.current?.('draft');

        const interval = setInterval(() => {
            saveToPlayerSessionsRef.current?.('draft');
        }, 60 * 1000);

        return () => clearInterval(interval);
    }, [gameState.isSetup, user]);

    // 自動更新唯讀幸福項目
    useEffect(() => {
        if (!gameState.isSetup) return;

        let updatedHappiness = [...gameState.happiness];
        let changed = false;

        // 1. 財務自由 (理財收入 > 總支出)
        const isFinancialFree = summary.passiveIncome > summary.totalExpenses;
        const financeItem = updatedHappiness.find(h => h.id === 'h_finance');
        if (financeItem && financeItem.checked !== isFinancialFree) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_finance' ? { ...h, checked: isFinancialFree } : h);
            changed = true;
        }

        // 2. 自住房相關：只取分數最高的那一間
        const houseSubIds: Record<string, string> = { '1room': 'h_house_1', '2room': 'h_house_2', '3room': 'h_house_3', '5room': 'h_house_5' };
        const housePoints: Record<string, number> = { '1room': 2, '2room': 4, '3room': 6, '5room': 8 };
        const selfUseTypes = gameState.assets
            .filter(a => a.houseType && a.isSelfUse)
            .map(a => a.houseType as string);
        const bestType = selfUseTypes.reduce<string | null>((best, t) =>
            best === null || (housePoints[t] || 0) > (housePoints[best] || 0) ? t : best
        , null);

        Object.entries(houseSubIds).forEach(([typeKey, itemId]) => {
            const shouldBeChecked = typeKey === bestType;
            const item = updatedHappiness.find(h => h.id === itemId);
            if (item && item.checked !== shouldBeChecked) {
                updatedHappiness = updatedHappiness.map(h => h.id === itemId ? { ...h, checked: shouldBeChecked } : h);
                changed = true;
            }
        });

        const hasAnySelfUseHouse = gameState.assets.some(a => a.type === '不動產' && a.houseType && a.isSelfUse);
        const houseSelfItem = updatedHappiness.find(h => h.id === 'h_house_self');
        if (houseSelfItem && houseSelfItem.checked !== hasAnySelfUseHouse) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_house_self' ? { ...h, checked: hasAnySelfUseHouse } : h);
            changed = true;
        }

        // 3. 幸福家庭 (完成 5 項: 約會, 求婚, 婚禮, 孩子1, 自住房)
        const hasDate = updatedHappiness.find(h => h.id === 'h_date')?.checked;
        const hasProposal = updatedHappiness.find(h => h.id === 'h_proposal')?.checked;
        const hasWedding = updatedHappiness.find(h => h.id === 'h_wedding')?.checked;
        const hasChild1 = updatedHappiness.find(h => h.id === 'h_child1')?.checked;
        const isFamilyComplete = !!(hasDate && hasProposal && hasWedding && hasChild1 && hasAnySelfUseHouse);

        const familyItem = updatedHappiness.find(h => h.id === 'h_family');
        if (familyItem && familyItem.checked !== isFamilyComplete) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_family' ? { ...h, checked: isFamilyComplete } : h);
            changed = true;
        }

        // 4. 汽車（相容舊的飛行器資產資料）
        const hasAircraft = gameState.assets.some(a => a.type === '汽車' || a.type === '飛行器');
        const planeItem = updatedHappiness.find(h => h.id === 'h_plane');
        if (planeItem && planeItem.checked !== hasAircraft) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_plane' ? { ...h, checked: hasAircraft } : h);
            changed = true;
        }

        if (changed) {
            const newTotal = updatedHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);
            setGameState(prev => ({
                ...prev,
                happiness: updatedHappiness,
                happinessTotal: newTotal
            }));
        }
    }, [summary.passiveIncome, summary.totalExpenses, gameState.assets, gameState.isSetup, gameState.happiness]);

    // 監聽執行師存入的官方紀錄 (score_records)
    useEffect(() => {
        if (!user) {
            setScoreRecords([]);
            return;
        }

        const q = query(
            collection(db, 'score_records', 'S1', 'records'),
            where('playerUids', 'array-contains', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records: GameRecord[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (!data.players || !Array.isArray(data.players)) return;
                const playerData = data.players.find((p: any) => p.uid === user.uid);
                if (!playerData) return;

                records.push({
                    id: docSnap.id,
                    roomId: data.roomId,
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
        }, (error) => {
            console.error("[GameContext] 獲取官方歷史紀錄失敗:", error);
        });

        return () => unsubscribe();
    }, [user]);

    // 監聽玩家自存紀錄 (player_sessions)，排除已有官方紀錄的場次
    useEffect(() => {
        if (!user) {
            setPlayerSessionRecords([]);
            return;
        }

        const q = query(
            collection(db, 'player_sessions', user.uid, 'records'),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const coachRoomIds = new Set(scoreRecords.filter(r => r.roomId).map(r => r.roomId));

            const records: GameRecord[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                // 如果這場遊戲已有執行師的官方紀錄，跳過（避免重複）
                if (data.roomId && coachRoomIds.has(data.roomId)) return;

                records.push({
                    id: docSnap.id,
                    roomId: data.roomId,
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
        }, (error) => {
            console.error("[GameContext] 獲取玩家自存紀錄失敗:", error);
        });

        return () => unsubscribe();
    }, [user, scoreRecords]);

    const saveGameRecord = async (record: GameRecord) => {
        await saveToPlayerSessions('completed');
        showAlert('遊戲紀錄已保存', 'success');
    };

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

    // 房間主 listener 已經帶回行情更新，避免玩家端再開第二條同房間 listener。
    useEffect(() => {
        const marketUpdate = room?.marketUpdates;
        if (!room?.id || user?.uid === room.hostId || !gameState.isSetup || !marketUpdate) return;
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
    }, [room?.id, room?.hostId, room?.marketUpdates, user?.uid, gameState.isSetup, gameState.lastMarketUpdateTimestamp, bubbleBurst, updateMarketPrices, showAlert]);

    // 監聽共享棋盤支出效果（例如新聞卡「全體支出調整」）回灌到本地 gameState。
    // 事件本身只放在公開棋盤狀態，財務數字仍由每位玩家自己的私有文件保存。
    useEffect(() => {
        if (!room?.id || !user?.uid || user.uid === room.hostId || !gameState.isSetup) return;

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
        return [...scoreRecords, ...playerSessionRecords]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [scoreRecords, playerSessionRecords]);

    const setGameHistory = () => {};

    return (
        <GameContext.Provider value={{
            gameState,
            setGameState,
            gameHistory,
            setGameHistory,
            summary,
            scoreResult,
            alertInfo,
            showAlert,
            hideAlert,
            saveGameRecord,
            updateMarketPrices,
            bubbleBurst,
            sessionId: sessionIdRef.current,
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};
