import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { GameState, FinancialSummary, GameRecord, Transaction } from '../types';
import { STOCK_SYMBOLS } from '../constants';
import { db, auth } from '../../services/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, doc, setDoc } from 'firebase/firestore';

const getRandomPrice = () => (Math.floor(Math.random() * (13 - 2 + 1)) + 2) * 100;

interface GameContextValue {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    gameHistory: GameRecord[];
    setGameHistory: React.Dispatch<React.SetStateAction<GameRecord[]>>;
    summary: FinancialSummary;
    scoreResult: {
        totalScore: number;
        details: Array<{ label: string; points: number; achieved: boolean }>;
    };
    saveGameRecord: (record: GameRecord) => Promise<void>;
    loadGameHistory: () => Promise<void>;
    updateMarketPrices: (updates: Record<string, number>) => void;
    bubbleBurst: () => void;
    alertInfo: { message: string; type: 'info' | 'error' | 'success' } | null;
    showAlert: (message: string, type?: 'info' | 'error' | 'success') => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

const MOCK_HISTORY: GameRecord[] = [];

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>({
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
        expenses: {}, // Initialize expenses as an empty object
        marketPrices: STOCK_SYMBOLS.reduce((acc, symbol) => {
            acc[symbol] = getRandomPrice();
            return acc;
        }, {} as Record<string, number>),
        abilities: {
            stockAbilityCount: 0,
            realEstateAbilityCount: 0,
            professionAbilityCount: 0,
        },
        completedHappinessEvents: [],
    } as any);

    const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

    const saveGameRecord = async (record: GameRecord) => {
        setGameHistory(prev => [record, ...prev]);
        
        // 如果用戶已登入，儲存到 Firebase
        if (auth.currentUser) {
            try {
                const userRecordsRef = collection(db, 'users', auth.currentUser.uid, 'gameRecords');
                await addDoc(userRecordsRef, {
                    ...record,
                    userId: auth.currentUser.uid,
                    createdAt: new Date().toISOString()
                });
                console.log('遊戲紀錄已成功儲存至 Firebase');
            } catch (error) {
                console.error('儲存遊戲紀錄失敗:', error);
            }
        }
    };

    const loadGameHistory = async () => {
        if (!auth.currentUser) return;
        
        try {
            const userRecordsRef = collection(db, 'users', auth.currentUser.uid, 'gameRecords');
            const q = query(userRecordsRef, orderBy('date', 'desc'), limit(50));
            const querySnapshot = await getDocs(q);
            
            const records: GameRecord[] = [];
            querySnapshot.forEach((doc) => {
                records.push(doc.data() as GameRecord);
            });
            
            if (records.length > 0) {
                setGameHistory(records);
            }
        } catch (error) {
            console.error('載入遊戲歷史失敗:', error);
        }
    };
    const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

    const showAlert = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setAlertInfo({ message, type });
        setTimeout(() => setAlertInfo(null), 3000);
    };

    // Calculate financial summary
    const summary: FinancialSummary = useMemo(() => {
        if (!gameState.profession) return { totalIncome: 0, totalExpenses: 0, monthlyCashflow: 0, passiveIncome: 0, totalAssets: 0, totalLiabilities: 0, payday: 0 };

        const passiveIncome = gameState.assets.reduce((sum, a) => {
            let income = a.cashflow;
            // 投資不動產的能力：所有出租房產租金 +10,000H * 能力次數
            if (a.type === '不動產' && !a.isSelfUse && gameState.abilities?.realEstateAbilityCount > 0) {
                income += 10000 * gameState.abilities.realEstateAbilityCount;
            }
            return sum + income;
        }, 0);
        const dynamicIncome = Object.values(gameState.income || {}).reduce((sum, v) => sum + (v || 0), 0);
        const totalIncome = gameState.profession.salary + passiveIncome + dynamicIncome;

        // Calculate interest from liabilities' monthlyPayment
        const creditLoanInterest = (gameState.liabilities.filter(l => l.type === '信用貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)) + (gameState.loans * 0.1);
        const aircraftLoanInterest = gameState.liabilities.filter(l => l.type === '飛行器貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
        const businessLoanInterest = gameState.liabilities.filter(l => l.type === '企業貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
        const realEstateLoanInterest = gameState.liabilities.filter(l => l.type === '不動產貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

        const p = gameState.profession;

        // Calculate each expense category, combining professional base and user adjustments
        // 所得稅務隨工作收入(salary)變動，比例為 5%
        const taxExpense = Math.floor(p.salary * 0.05);
        const basicLivingTotal = Math.max(0, (p.expenses?.basicLiving || 0) + (gameState.expenses?.basicLiving || 0));
        const transportEduTotal = Math.max(0, (p.expenses?.transportEdu || 0) + (gameState.expenses?.transportEdu || 0));
        const otherMedicalChildTotal = Math.max(0, (p.expenses?.otherMedicalChild || 0) + (gameState.expenses?.otherMedicalChild || 0));

        const rankIncrease = Math.max(0, gameState.currentRankLevel - 1);
        const otherExpensesBonus = rankIncrease * 10000; // This bonus is specifically for otherMedicalChild

        const totalInsuranceCount = (gameState.medicalInsuranceCount || 0) + gameState.assets.filter(a => a.isInsured).length;
        const insuranceCost = totalInsuranceCount * 2000;

        const totalExpenses = taxExpense +
                              basicLivingTotal +
                              transportEduTotal +
                              otherMedicalChildTotal +
                              otherExpensesBonus +
                              creditLoanInterest +
                              aircraftLoanInterest +
                              businessLoanInterest +
                              realEstateLoanInterest +
                              insuranceCost;

        const totalAssets = gameState.assets.reduce((sum, a) => {
            if (a.type === '股票') {
                const symbol = a.name.replace('股票 ', '');
                const marketPrice = (gameState.marketPrices && gameState.marketPrices[symbol]) || a.lastPurchasePrice || 0;
                return sum + (a.quantity || 0) * marketPrice;
            }
            return sum + a.cost;
        }, 0) + gameState.cash;

        return {
            totalIncome,
            totalExpenses,
            monthlyCashflow: totalIncome - totalExpenses,
            passiveIncome,
            totalAssets,
            totalLiabilities: gameState.liabilities.reduce((sum, l) => sum + l.totalOwed, 0) + gameState.loans,
            payday: totalIncome - totalExpenses
        };
    }, [gameState.profession, gameState.expenses?.basicLiving, gameState.expenses?.transportEdu, gameState.expenses?.otherMedicalChild, gameState.currentRankLevel, gameState.liabilities, gameState.medicalInsuranceCount, gameState.assets, gameState.cash, gameState.loans, gameState.income, gameState.marketPrices]);

    // Calculate score result
    const scoreResult = useMemo(() => {
        const h = gameState.happinessTotal;
        const reserve = gameState.cash + gameState.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0);
        const isReserveOk = reserve > summary.totalExpenses;
        const isInsured = (gameState.medicalInsuranceCount || 0) >= 1;
        const isCashflowOk = summary.monthlyCashflow > 0;
        const validInvestmentTypes = new Set(['股票', '不動產', '企業', '定存']);
        const playerAssetTypes = new Set(gameState.assets.map(a => a.type).filter(t => validInvestmentTypes.has(t as string)));

        const criteriaList = [
            { label: '遊玩積分', points: 2, achieved: true },
            { label: '幸福指數達 10', points: 1, achieved: h >= 10 },
            { label: '幸福指數達 30', points: 1, achieved: h >= 30 },
            { label: '幸福指數達 60', points: 2, achieved: h >= 60 },
            { label: '幸福指數達 80', points: 3, achieved: h >= 80 },
            { label: '幸福指數達 100', points: 5, achieved: h >= 100 },
            { label: '達到財務安全 (預備金/保險/收支平衡)', points: 1, achieved: isReserveOk && isInsured && isCashflowOk },
            { label: '達到財務寬裕 (擁有多種資產)', points: 2, achieved: playerAssetTypes.size >= 2 },
            { label: '達到財務自由 (理財收入 > 總支出)', points: 3, achieved: summary.passiveIncome > summary.totalExpenses },
        ];

        const totalScore = criteriaList.reduce((sum, c) => sum + (c.achieved ? c.points : 0), 0);
        return { totalScore, details: criteriaList };
    }, [gameState, summary]);

    // Auto-check happiness items based on game state
    useEffect(() => {
        if (!gameState.isSetup) return;
        let updatedHappiness = [...gameState.happiness];
        let changed = false;

        // Auto-check financial freedom
        if (summary.passiveIncome > summary.totalExpenses) {
            const item = updatedHappiness.find(h => h.id === 'h_finance');
            if (item && !item.checked) {
                updatedHappiness = updatedHappiness.map(h => h.id === 'h_finance' ? { ...h, checked: true } : h);
                changed = true;
            }
        } else {
            const item = updatedHappiness.find(h => h.id === 'h_finance');
            if (item && item.checked) {
                updatedHappiness = updatedHappiness.map(h => h.id === 'h_finance' ? { ...h, checked: false } : h);
                changed = true;
            }
        }

        // Auto-check house types
        const houseSubIds: Record<string, string> = { '1room': 'h_house_1', '2room': 'h_house_2', '3room': 'h_house_3', '5room': 'h_house_5' };
        const ownedTypes = new Set(
            gameState.assets
                .filter(a => a.houseType && a.isSelfUse)
                .map(a => a.houseType)
        );
        Object.entries(houseSubIds).forEach(([typeKey, itemId]) => {
            const shouldBeChecked = ownedTypes.has(typeKey);
            const item = updatedHappiness.find(h => h.id === itemId);
            if (item && item.checked !== shouldBeChecked) {
                updatedHappiness = updatedHappiness.map(h => h.id === itemId ? { ...h, checked: shouldBeChecked } : h);
                changed = true;
            }
        });

        const hasAnyHouseType = gameState.assets.some(a => a.type === '不動產' && a.houseType && a.isSelfUse);
        const houseItem = updatedHappiness.find(h => h.id === 'h_house_self');
        if (houseItem && houseItem.checked !== hasAnyHouseType) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_house_self' ? { ...h, checked: hasAnyHouseType } : h);
            changed = true;
        }

        // Auto-check family completion
        const hasDate = updatedHappiness.find(h => h.id === 'h_date')?.checked;
        const hasProposal = updatedHappiness.find(h => h.id === 'h_proposal')?.checked;
        const hasWedding = updatedHappiness.find(h => h.id === 'h_wedding')?.checked;
        const hasChild1 = updatedHappiness.find(h => h.id === 'h_child1')?.checked;
        if (hasDate && hasProposal && hasWedding && hasChild1 && hasAnyHouseType) {
            const familyItem = updatedHappiness.find(h => h.id === 'h_family');
            if (familyItem && !familyItem.checked) {
                updatedHappiness = updatedHappiness.map(h => h.id === 'h_family' ? { ...h, checked: true } : h);
                changed = true;
            }
        }

        // Auto-check aircraft
        const hasAircraft = gameState.assets.some(a => a.type === '飛行器' as any);
        const planeItem = updatedHappiness.find(h => h.id === 'h_plane');
        if (planeItem && planeItem.checked !== hasAircraft) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_plane' ? { ...h, checked: hasAircraft } : h);
            changed = true;
        }

        if (changed) {
            setGameState(prev => {
                return {
                    ...prev,
                    happiness: updatedHappiness,
                    happinessTotal: updatedHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0)
                };
            });
        }
    }, [summary.passiveIncome, summary.totalExpenses, gameState.assets, gameState.isSetup, gameState.happiness]);

    const updateMarketPrices = (updates: Record<string, number>) => {
        setGameState(prev => {
            const newMarketPrices = {
                ...prev.marketPrices,
                ...updates
            };
            
            // Create a log entry for market updates
            const updateDetails = Object.entries(updates)
                .map(([symbol, price]) => `${symbol}: ${prev.marketPrices[symbol]} -> ${price}`)
                .join(', ');

            const marketUpdateEvent: Transaction = {
                id: Math.random().toString(36).substr(2, 9),
                name: '📈 市場行情更新',
                amount: 0,
                sourceLabel: '市場事件',
                usageLabel: '價格調整',
                cashChange: 0,
                balance: prev.cash,
                timestamp: Date.now(),
                details: JSON.stringify({
                    type: 'market_update',
                    updates,
                    description: `股票價格調整：${updateDetails}`
                })
            };

            return {
                ...prev,
                marketPrices: newMarketPrices,
                history: [marketUpdateEvent, ...prev.history]
            };
        });
        showAlert('📈 市場行情已更新！', 'success');
    };

    const bubbleBurst = () => {
        setGameState(prev => {
            const affectedStocks: string[] = [];
            const updatedAssets = prev.assets.map(asset => {
                if (asset.type === '股票') {
                    const oldQty = asset.quantity || 0;
                    const newQty = Math.floor(oldQty / 2);
                    if (newQty <= 0) {
                        affectedStocks.push(`${asset.name} (全部損失)`);
                        return null;
                    }
                    affectedStocks.push(`${asset.name} (${oldQty} -> ${newQty})`);
                    return {
                        ...asset,
                        quantity: newQty,
                        cost: newQty * (asset.lastPurchasePrice || 0)
                    };
                }
                return asset;
            }).filter((a): a is any => a !== null);

            if (affectedStocks.length === 0) {
                return prev;
            }

            const bubbleEvent: Transaction = {
                id: Math.random().toString(36).substr(2, 9),
                name: '🌪️ 泡沫化風暴',
                amount: 0,
                sourceLabel: '市場事件',
                usageLabel: '股票資產減半',
                cashChange: 0,
                balance: prev.cash,
                timestamp: Date.now(),
                details: JSON.stringify({
                    type: 'bubble_burst',
                    affectedStocks,
                    // Store full asset info for restoration if they were completely lost
                    fullAssets: prev.assets.filter(a => a.type === '股票').map(a => ({...a})),
                    description: '泡沫化風暴席捲市場，所有股票資產數量減半。'
                })
            };

            return {
                ...prev,
                assets: updatedAssets,
                history: [bubbleEvent, ...prev.history]
            };
        });
        showAlert('🌪️ 泡沫化風暴已席捲市場！\n所有股票資產已減半。', 'error');
    };

    const value: GameContextValue = {
        gameState,
        setGameState,
        gameHistory,
        setGameHistory,
        summary,
        scoreResult,
        saveGameRecord,
        loadGameHistory,
        updateMarketPrices,
        bubbleBurst,
        alertInfo,
        showAlert
    };

    useEffect(() => {
        loadGameHistory();
    }, [auth.currentUser]);

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
