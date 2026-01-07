import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
    doc,
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { GameState, GameRecord, FinancialSummary } from '../types';
import { calculateFinancialSummary, calculateScoreResult } from '../utils/gameUtils';
import { cleanObject } from '../utils/utils';

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
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { room } = useRoom();

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

    const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
    const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'info' | 'error' | 'success'; persist?: boolean } | null>(null);

    // 自動保存到 localStorage
    useEffect(() => {
        if (gameState.isSetup || gameState.selectionStep) {
            localStorage.setItem('happiness_game_state', JSON.stringify(gameState));
        }
    }, [gameState]);

    // 自動同步到房間文件 (供執行師監控)
    useEffect(() => {
        // 只要不是房主，且 (已完成初始設定 或 正在進行選擇步驟)，就同步狀態
        if (!room?.id || !user || user.uid === room.hostId) return;
        if (!gameState.isSetup && !gameState.selectionStep) return;

        const timeoutId = setTimeout(async () => {
            try {
                const roomRef = doc(db, 'rooms', room.id);
                const cleanedState = cleanObject(gameState);
                await updateDoc(roomRef, {
                    [`playerStates.${user.uid}`]: cleanedState
                });
            } catch (err) {
                console.error('同步玩家數據失敗:', err);
            }
        }, 800); // 800ms 延遲避免過度頻繁寫入

        return () => clearTimeout(timeoutId);
    }, [gameState, room?.id, user?.uid, user?.role]);

    const hideAlert = useCallback(() => {
        setAlertInfo(null);
    }, []);

    const showAlert = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info', persist: boolean = false) => {
        setAlertInfo({ message, type, persist });
        if (!persist) {
            setTimeout(() => setAlertInfo(null), 3000);
        }
    }, []);

    const summary = useMemo(() => calculateFinancialSummary(gameState), [gameState]);

    const scoreResult = useMemo(() => {
        return calculateScoreResult(gameState, summary);
    }, [gameState, summary]);

    // 獲取個人歷史紀錄
    useEffect(() => {
        if (!user) {
            setGameHistory([]);
            return;
        }

        console.log(`[GameContext] 開始獲取用戶 ${user.uid} 的歷史紀錄... 路徑: score_records/S1/records`);
        console.log(`[GameContext] 查詢條件: playerUids array-contains ${user.uid}`);

        const q = query(
            collection(db, 'score_records', 'S1', 'records'),
            where('playerUids', 'array-contains', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[GameContext] 收到 Snapshot, 文件數量: ${snapshot.size}`);
            console.log(`[GameContext] Snapshot metadata:`, snapshot.metadata);

            if (snapshot.empty) {
                console.log(`[GameContext] Snapshot 為空，用戶 ${user.uid} 可能還沒有任何遊戲紀錄`);
                console.log(`[GameContext] 嘗試查看所有文檔（測試用）...`);
            }

            const history: GameRecord[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log(`[GameContext] 處理紀錄: ${doc.id}`, {
                    playerUids: data.playerUids,
                    playersCount: data.players?.length,
                    settledAt: data.settledAt,
                    isFinal: data.isFinal
                });

                // 檢查 players 陣列是否存在且包含用戶
                if (!data.players || !Array.isArray(data.players)) {
                    console.log(`[GameContext] 紀錄 ${doc.id} 的 players 欄位格式錯誤:`, data.players);
                    return;
                }

                const playerData = data.players.find((p: any) => p.uid === user.uid);

                if (playerData) {
                    console.log(`[GameContext] 找到用戶 ${user.uid} 在紀錄 ${doc.id} 中的數據:`, {
                        name: playerData.name,
                        profession: playerData.profession,
                        totalScore: playerData.totalScore,
                        happiness: playerData.happiness
                    });
                    history.push({
                        id: doc.id,
                        date: data.settledAt?.toDate ? data.settledAt.toDate().toISOString() :
                            (data.settledAt ? new Date(data.settledAt).toISOString() : new Date().toISOString()),
                        playerName: playerData.name,
                        reportName: data.roomName || `${playerData.name} 的財務報表`,
                        profession: playerData.profession,
                        finalScore: playerData.totalScore || 0,
                        happinessScore: playerData.happiness || 0,
                        isWin: playerData.happiness >= 100,
                        financialSummary: playerData.summary || {
                            totalIncome: 0,
                            totalExpenses: 0,
                            monthlyCashflow: 0,
                            passiveIncome: 0,
                            totalAssets: 0,
                            totalLiabilities: 0,
                            payday: 0
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
                } else {
                    console.log(`[GameContext] 紀錄 ${doc.id} 的 players 陣列中未找到用戶 ${user.uid}`);
                    console.log(`[GameContext] 該紀錄的所有玩家 UID:`, data.players.map((p: any) => p.uid));
                }
            });

            // 手動排序
            history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            console.log(`[GameContext] 獲取到 ${history.length} 筆符合用戶的紀錄`);
            if (history.length > 0) {
                console.log(`[GameContext] 第一筆紀錄:`, history[0]);
            }
            setGameHistory(history);
        }, (error) => {
            console.error("[GameContext] 獲取歷史紀錄失敗:", error);
            console.error("[GameContext] 錯誤詳情:", {
                code: error.code,
                message: error.message,
                name: error.name
            });
        });

        return () => unsubscribe();
    }, [user]);

    const saveGameRecord = async (record: GameRecord) => {
        // 這裡可以實作保存到 Firebase 的邏輯
        setGameHistory(prev => [record, ...prev]);
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
                        bubbleBurst(code);
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
        });

        return () => unsubscribe();
    }, [room?.id, user?.uid, room?.hostId, gameState.isSetup, gameState.lastMarketUpdateTimestamp, bubbleBurst, updateMarketPrices]);

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
            bubbleBurst
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
