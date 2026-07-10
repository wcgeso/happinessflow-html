import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    doc,
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { GameState, GameRecord, FinancialSummary } from '../types';
import { calculateFinancialSummary, calculateScoreResult } from '../utils/gameUtils';
import { cleanObject, safeAsync } from '../utils/utils';
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

    const [gameState, setGameState] = useState<GameState>(() => {
        // 從 localStorage 恢復狀態 (選配)
        const saved = localStorage.getItem('happiness_game_state');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved game state', e);
            }
        }
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

    // 自動保存到 localStorage
    useEffect(() => {
        if (gameState.isSetup || gameState.selectionStep) {
            localStorage.setItem('happiness_game_state', JSON.stringify(gameState));
        }
    }, [gameState]);

    // 生成 sessionId（遊戲開始時）
    useEffect(() => {
        if (gameState.isSetup && user && !sessionIdRef.current) {
            sessionIdRef.current = `${user.uid}_${Date.now()}`;
        }
        if (!gameState.isSetup && !gameState.selectionStep) {
            sessionIdRef.current = null;
        }
    }, [gameState.isSetup, gameState.selectionStep, user]);

    // 自動同步到房間文件 (供執行師監控)
    useEffect(() => {
        // 只要不是房主，且 (已完成初始設定 或 正在進行選擇步驟)，就同步狀態
        if (!room?.id || !user || user.uid === room.hostId) return;
        if (!gameState.isSetup && !gameState.selectionStep) return;

        const timeoutId = setTimeout(async () => {
            const roomRef = doc(db, 'rooms', room.id);
            const existingRoomState = room.playerStates?.[user.uid];
            // 若房間端的共享支出同步時間戳比本地新，代表本地的回灌監聽尚未趕上，
            // 這次寫回必須保留房間端的正式共享結果，避免用舊的本地 expenses 覆寫掉它（P0-02）。
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
            await safeAsync(updateDoc(roomRef, {
                [`playerStates.${user.uid}`]: cleanedState
            }));
        }, 800); // 800ms 延遲避免過度頻繁寫入

        return () => clearTimeout(timeoutId);
    }, [gameState, room?.id, user?.uid, user?.role]);

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
            isWin: summary.passiveIncome > summary.totalExpenses,
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

    // 遊戲開始後立刻存一次，之後每兩分鐘自動存檔草稿到 player_sessions
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

    // 監聽來自執行師的行情更新
    useEffect(() => {
        // 只要不是房主（執行師本人），不論角色身份，都應該接收行情更新
        if (!room?.id || user?.uid === room.hostId || !gameState.isSetup) return;

        const roomRef = doc(db, 'rooms', room.id);
        const unsubscribe = onSnapshot(roomRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.marketUpdates && data.marketUpdates.timestamp > (gameState.lastMarketUpdateTimestamp || 0)) {
                    const { updates, code, isBubble } = data.marketUpdates;

                    if (isBubble) {
                        // 泡沫破裂除了持股減半，泡沫卡本身通常也帶有崩跌後的新股價，
                        // 之前只呼叫 bubbleBurst() 沒有連帶套用 updates，導致崩跌後
                        // 的新股價從未真正寫進本地 gameState（詳見稽核報告 C3）。
                        bubbleBurst(code);
                        updateMarketPrices(updates, code);
                        showAlert(`💥 股市泡沫破裂！代碼：${code}\n所有股票數量已減半。`, 'error', true);
                    } else {
                        updateMarketPrices(updates, code);
                        showAlert(`📈 股市行情已更新！代碼：${code}\n請檢查股市面板查看最新價格。`, 'success', true);
                    }

                    // 記錄已處理的更新時間戳，避免重複處理
                    setGameState(prev => ({
                        ...prev,
                        lastMarketUpdateTimestamp: data.marketUpdates.timestamp
                    }));
                }
            }
        }, (err) => {
            console.error("[GameContext] 監聽房間行情失敗:", err);
        });

        return () => unsubscribe();
    }, [room?.id, user?.uid, room?.hostId, gameState.isSetup, gameState.lastMarketUpdateTimestamp, bubbleBurst, updateMarketPrices]);

    // 監聽共享棋盤支出效果（例如新聞卡「全體支出調整」）回灌到本地 gameState。
    // room.playerStates 是共享效果的正式來源；若不回灌，本地防抖同步（見上方
    // 自動同步到房間文件 effect）會在下一次寫入時用舊的本地 expenses 覆寫掉
    // 這筆正式共享結果（P0-02）。
    useEffect(() => {
        if (!room?.id || !user?.uid || user.uid === room.hostId || !gameState.isSetup) return;

        const roomRef = doc(db, 'rooms', room.id);
        const unsubscribe = onSnapshot(roomRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            const sharedState = data.playerStates?.[user.uid];
            const syncedAt = sharedState?.lastSharedExpenseSyncedAt;
            if (!syncedAt || syncedAt <= (gameState.lastSharedExpenseSyncedAt || 0)) return;

            setGameState(prev => ({
                ...prev,
                expenses: sharedState.expenses ?? prev.expenses,
                lastSharedExpenseSyncedAt: syncedAt
            }));

            // 給受影響玩家一個可見的確認，而不是悄悄改數字卻毫無提示（見 M2/P1-03）。
            if (sharedState.lastBoardEvent) {
                showAlert(`📋 ${sharedState.lastBoardEvent}，財務報表已同步更新`, 'info', true);
            }
        }, (err) => {
            console.error("[GameContext] 監聽共享支出效果失敗:", err);
        });

        return () => unsubscribe();
    }, [room?.id, room?.hostId, user?.uid, gameState.isSetup, gameState.lastSharedExpenseSyncedAt, showAlert]);

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
