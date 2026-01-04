import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
    doc, 
    updateDoc, 
    onSnapshot 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { GameState, GameRecord, FinancialSummary } from '../types';
import { calculateFinancialSummary } from '../utils/gameUtils';
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
        if (gameState.isSetup) {
            localStorage.setItem('happiness_game_state', JSON.stringify(gameState));
        }
    }, [gameState]);

    // 自動同步到房間文件 (供執行師監控)
    useEffect(() => {
        if (!room?.id || user?.role !== 'player' || !gameState.isSetup) return;

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
        const h = gameState.happinessTotal || 0;
        const reserve = (gameState.cash || 0) + (gameState.assets || []).filter(a => a.type === '定存').reduce((s, a) => s + (a.cost || 0), 0);
        const isReserveOk = reserve > summary.totalExpenses;
        const isInsured = (gameState.medicalInsuranceCount || 0) >= 1; 
        const isCashflowOk = summary.monthlyCashflow > 0;
        
        const validInvestmentTypes = new Set(['股票', '不動產', '企業', '定存']);
        const playerAssetTypes = new Set((gameState.assets || []).map(a => a.type).filter(t => validInvestmentTypes.has(t as string)));
        
        const criteriaList = [
            { label: '遊玩積分', points: 2, achieved: true },
            { label: '幸福指數達 10', points: 1, achieved: h >= 10 },
            { label: '幸福指數達 30', points: 1, achieved: h >= 30 },
            { label: '幸福指數達 60', points: 2, achieved: h >= 60 },
            { label: '幸福指數達 80', points: 3, achieved: h >= 80 },
            { label: '幸福指數達 100', points: 5, achieved: h >= 100 },
            { label: '達到財務安全 (預備金/保險/收支平衡)', points: 1, achieved: isReserveOk && isInsured && isCashflowOk },
            { label: '達到財務寬裕 (擁有多種資產)', points: 2, achieved: playerAssetTypes.size >= 2 },
            { label: '達到財務自由 (資產收入 > 總支出)', points: 3, achieved: summary.passiveIncome > summary.totalExpenses },
        ];

        const totalScore = criteriaList.reduce((sum, c) => sum + (c.achieved ? c.points : 0), 0);
        return { totalScore, details: criteriaList };
    }, [gameState, summary]);

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
        if (!room?.id || user?.role !== 'player' || !gameState.isSetup) return;

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
    }, [room?.id, user?.role, gameState.isSetup, gameState.lastMarketUpdateTimestamp, bubbleBurst, updateMarketPrices]);

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
