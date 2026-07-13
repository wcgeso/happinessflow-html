import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { GameRecord, Transaction, Asset, TransactionData, HappinessItem, GameState } from '../types';
import { formatMoney } from '../utils/gameUtils';
import { extractAssetSymbol, getAssetDisplayLabel, getStockAssetLabel } from '../utils/assetLabels';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

import { REAL_ESTATE_TYPES } from '../constants';

const getLiabilityMonthlyPayment = (type: GameState['liabilities'][number]['type'], total: number) => {
    if (type === '信用貸款') return Math.floor(total * 0.1);
    if (type === '強制負債') return 0;
    return Math.floor(total * 0.005);
};

export const useGameLogic = () => {
    const { gameState, setGameState, gameHistory, setGameHistory, summary, scoreResult, alertInfo, showAlert, hideAlert, saveGameRecord } = useGame();

    const [happinessSubMode, setHappinessSubMode] = useState<'history' | 'pay' | 'inc_exp'>('history');

    const deriveTransactionLabels = (data: TransactionData) => {
        if (data.insuranceType) {
            return { sourceLabel: '生活支出', usageLabel: '保險投保' };
        }
        if (data.usage === 'asset' && data.stockList?.length) {
            return {
                sourceLabel: data.cashChange >= 0 ? '投資回收' : '投資支出',
                usageLabel: data.cashChange >= 0 ? '賣出股票' : '買入股票'
            };
        }
        if (data.usage === 'asset' && data.assetDetails?.type === '定存') {
            return { sourceLabel: '投資支出', usageLabel: '辦理定存' };
        }
        if (data.usage === 'cash' && data.relatedAssetId) {
            return { sourceLabel: '投資回收', usageLabel: '解約或出售資產' };
        }
        if (data.usage === 'cash' && data.source === 'loan') {
            return { sourceLabel: '銀行借貸', usageLabel: '借入現金' };
        }
        if (data.usage === 'liability') {
            return { sourceLabel: '現金支付', usageLabel: '償還貸款' };
        }
        if (data.usage === 'expense_update') {
            return { sourceLabel: '生活事件', usageLabel: '調整月支出' };
        }
        if (data.usage === 'happiness_event') {
            return { sourceLabel: '幸福事件', usageLabel: '幸福卡效果' };
        }
        if (data.usage === 'lifelong_learning') {
            return { sourceLabel: '進修事件', usageLabel: '終身學習' };
        }
        if (data.usage === 'stock_update') {
            return { sourceLabel: '投資收益', usageLabel: '股票配發' };
        }

        return {
            sourceLabel: data.source === 'income' ? '收入' : data.source === 'loan' ? '借貸' : data.usage === 'asset' ? '資產交易' : '支出',
            usageLabel: data.usage === 'asset' ? '買入資產' : '一般支出'
        };
    };

    const addMoney = (amount: number) => {
        setGameState(prev => ({
            ...prev,
            cash: prev.cash + amount
        }));
        showAlert(`🛠️ 開發者操作：${amount > 0 ? '增加' : '減少'}現金 ${formatMoney(Math.abs(amount))}`, 'success');
    };

    const applyLifelongLearningEffect = (
        baseState: GameState,
        learningType: 'enhance_profession' | 'stock_ability' | 'real_estate_ability',
        requiredRoll: number,
        forcedRoll?: number
    ) => {
        const nextState: GameState = {
            ...baseState,
            abilities: { ...baseState.abilities },
            assets: [...baseState.assets],
            profession: baseState.profession ? { ...baseState.profession } : baseState.profession
        };
        const diceRoll = forcedRoll ?? (Math.floor(Math.random() * 6) + 1);
        const success = diceRoll >= requiredRoll;

        const snapshot = {
            previousAbilities: { ...baseState.abilities },
            previousAssets: baseState.assets.map(asset => ({ ...asset })),
            previousRankLevel: baseState.currentRankLevel,
            previousRankTitle: baseState.currentRankTitle,
            previousProfessionSalary: baseState.profession?.salary || 0
        };

        if (success) {
            if (learningType === 'enhance_profession') {
                nextState.abilities = {
                    ...nextState.abilities,
                    professionAbilityCount: (nextState.abilities?.professionAbilityCount || 0) + 1
                };
                const currentLevel = baseState.currentRankLevel;
                const nextPromo = baseState.profession?.promotions[currentLevel - 1];
                if (nextPromo) {
                    nextState.currentRankLevel = currentLevel + 1;
                    nextState.currentRankTitle = nextPromo.rankTitle;
                    if (nextState.profession) {
                        nextState.profession = {
                            ...nextState.profession,
                            salary: nextState.profession.salary + nextPromo.bonus
                        };
                    }
                }
            } else if (learningType === 'stock_ability') {
                nextState.abilities = {
                    ...nextState.abilities,
                    stockAbilityCount: (nextState.abilities?.stockAbilityCount || 0) + 1
                };
                nextState.assets = nextState.assets.map(asset => {
                    if (asset.type === '股票' && asset.quantity) {
                        const doubledQty = asset.quantity * 2;
                        return {
                            ...asset,
                            quantity: doubledQty,
                            cost: doubledQty * (asset.lastPurchasePrice || 0)
                        };
                    }
                    return asset;
                });
            } else if (learningType === 'real_estate_ability') {
                nextState.abilities = {
                    ...nextState.abilities,
                    realEstateAbilityCount: (nextState.abilities?.realEstateAbilityCount || 0) + 1
                };
            }
        }

        return {
            nextState,
            result: {
                learningType,
                requiredRoll,
                diceRoll,
                success,
                ...snapshot
            }
        };
    };

    const handleDeleteTransactionRecord = (id: string) => {
        const txToDelete = gameState.history.find(tx => tx.id === id);
        if (!txToDelete) return;

        setGameState(prev => {
            const index = prev.history.findIndex(tx => tx.id === id);
            if (index === -1) return prev;

            const newHistory = [...prev.history];
            const deletedTx = newHistory.splice(index, 1)[0];
            const newState = { ...prev, history: newHistory };

            // 1. Fundamental Cash Reversal (Uses the actual record's cashChange)
            newState.cash -= (deletedTx.cashChange || 0);

            if (deletedTx.details) try {
                const data: any = JSON.parse(deletedTx.details);

                if (data.boardEventId) {
                    newState.appliedBoardFinancialEventIds = (newState.appliedBoardFinancialEventIds || []).filter(id => id !== data.boardEventId);
                }

                // 2. State Content Reversal
                if (data.usage === 'asset') {
                    if (data.stockList && data.stockList.length > 0) {
                        const updatedAssets = [...newState.assets];
                        data.stockList.forEach((stock: any) => {
                            const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && extractAssetSymbol(a.name) === stock.symbol);
                            if (assetIdx !== -1) {
                                const asset = updatedAssets[assetIdx];
                                const newQty = (asset.quantity || 0) - stock.qty;
                                if (newQty <= 0) updatedAssets.splice(assetIdx, 1);
                                else updatedAssets[assetIdx] = { ...asset, quantity: newQty, cost: newQty * (asset.lastPurchasePrice || 0) };
                            }
                        });
                        newState.assets = updatedAssets;
                    } else if (data.assetDetails) {
                        const details = data.assetDetails;
                        newState.assets = data.createdAssetId
                            ? newState.assets.filter(a => a.id !== data.createdAssetId)
                            : newState.assets.filter(a => {
                                if (details.symbol) {
                                    return !(a.type === details.type && extractAssetSymbol(a.name) === details.symbol);
                                }
                                return a.name !== `${details.type} ${details.symbol || ''}`.trim();
                            });
                        if (details.loanAmount && details.loanAmount > 0) {
                            const loanName = `${details.type === '不動產' ? '不動產貸款' : details.type === '企業' ? '企業貸款' : '汽車貸款'} (${details.symbol || ''})`.trim();
                            newState.liabilities = newState.liabilities.filter(l => l.name !== loanName);
                        }
                        if (details.happyPoints) {
                            const happyLabel = `買房自用 (${details.symbol || ''})`.trim();
                            // Try to remove custom items or uncheck default items
                            // Reverse logic needs matching label mapping too
                            let baseLabel = REAL_ESTATE_TYPES[details.symbol || '']?.label || '自用住宅';
                            if (baseLabel === '兩房一廳住宅') baseLabel = '兩房一廳';
                            if (baseLabel === '三房兩廳住宅') baseLabel = '三房兩廳';
                            if (baseLabel === '五房三廳豪華住宅') baseLabel = '五房三廳';

                            const customItems = newState.happiness.filter(h => h.label.startsWith(baseLabel) && h.isCustom);
                            if (customItems.length > 0) {
                                // Remove the last added custom item to behave like a stack
                                const lastItem = customItems[customItems.length - 1];
                                newState.happiness = newState.happiness.filter(h => h.id !== lastItem.id);
                            } else {
                                // If no custom items, check for base item and uncheck it
                                const baseItem = newState.happiness.find(h => h.label === baseLabel);
                                if (baseItem && baseItem.checked) {
                                    newState.happiness = newState.happiness.map(h => h.id === baseItem.id ? { ...h, checked: false } : h);
                                }
                            }
                        }
                    }
                }

                else if (data.usage === 'liability' && data.liabilityId) {
                    if (data.liabilityId === 'multiple_credit_loans' && data.repaidLiabilities) {
                        data.repaidLiabilities.forEach((item: any) => {
                            const existing = newState.liabilities.find(l => l.id === item.id);
                            if (existing) {
                                newState.liabilities = newState.liabilities.map(l =>
                                    l.id === item.id ? { ...l, totalOwed: l.totalOwed + item.paid, monthlyPayment: Math.floor((l.totalOwed + item.paid) * 0.1) } : l
                                );
                            } else if (item.original) {
                                newState.liabilities.push(item.original);
                            }
                        });
                        if (data.repaidLegacyLoan) {
                            newState.loans += data.repaidLegacyLoan;
                        }
                    } else if (data.liabilityId === 'bank_loan') {
                        newState.loans += (data.amount || 0);
                    } else {
                        newState.liabilities = newState.liabilities.map(l => {
                            if (l.id === data.liabilityId) return { ...l, totalOwed: l.totalOwed + (data.amount || 0) };
                            return l;
                        });
                    }
                }
                else if (data.source === 'loan' && data.usage === 'cash') {
                    let liabIdx = -1;
                    for (let i = newState.liabilities.length - 1; i >= 0; i--) {
                        if (newState.liabilities[i].type === '信用貸款' && newState.liabilities[i].totalOwed === (data.amount || 0)) {
                            liabIdx = i;
                            break;
                        }
                    }
                    if (liabIdx !== -1) {
                        const updatedLiab = [...newState.liabilities];
                        updatedLiab.splice(liabIdx, 1);
                        newState.liabilities = updatedLiab;
                    }
                }
                else if (data.usage === 'forced_debt') {
                    let liabIdx = -1;
                    for (let i = newState.liabilities.length - 1; i >= 0; i--) {
                        if (newState.liabilities[i].type === '強制負債' && newState.liabilities[i].totalOwed === (data.amount || 0)) {
                            liabIdx = i;
                            break;
                        }
                    }
                    if (liabIdx !== -1) {
                        const updatedLiab = [...newState.liabilities];
                        updatedLiab.splice(liabIdx, 1);
                        newState.liabilities = updatedLiab;
                    }
                }
                else if (data.usage === 'expense_update' && data.expensePayload) {
                    const { category, amount, isIncrease } = data.expensePayload;
                    const currentVal = newState.expenses[category] || 0;
                    newState.expenses = { ...newState.expenses, [category]: isIncrease ? Math.max(0, currentVal - amount) : currentVal + amount };
                }
                else if (data.usage === 'happiness_event' && data.happinessEventPayload) {
                    const { id, monthlyExpenseChange, expenseCategory, progressId, happinessItemId, sourceCardId } = data.happinessEventPayload;

                    // 1. Reverse monthly expense
                    if (monthlyExpenseChange) {
                        const cat = (expenseCategory as any) || 'otherMedicalChild';
                        const currentVal = newState.expenses[cat] || 0;
                        newState.expenses = { ...newState.expenses, [cat]: Math.max(0, currentVal - monthlyExpenseChange) };
                    }

                    // 2. Reverse completed list
                    newState.completedHappinessEvents = (newState.completedHappinessEvents || []).filter(eid =>
                        eid !== id && eid !== progressId && eid !== sourceCardId
                    );

                    // 3. Reverse children count if applicable
                    if (id === 'child1' || id === 'child2') {
                        newState.children = Math.max(0, (newState.children || 0) - 1);
                    }

                    // 4. Reverse happiness item
                    const mapping: Record<string, string> = {
                        'date': 'h_date',
                        'propose': 'h_proposal',
                        'wedding': 'h_wedding',
                        'child1': 'h_child1',
                        'child2': 'h_child2'
                    };
                    const targetId = happinessItemId || mapping[progressId || id];
                    if (targetId) {
                        newState.happiness = newState.happiness.map(h => h.id === targetId ? { ...h, checked: false } : h);
                    } else {
                        // For custom items, we remove by name if it's a custom item
                        newState.happiness = newState.happiness.filter(h => !(h.label === data.happinessEventPayload.name && h.isCustom));
                    }
                }
                else if (data.usage === 'lifelong_learning' && data.lifelongLearningPayload && data.lifelongLearningResult) {
                    newState.abilities = { ...data.lifelongLearningResult.previousAbilities };
                    newState.assets = data.lifelongLearningResult.previousAssets.map((asset: Asset) => ({ ...asset }));
                    newState.currentRankLevel = data.lifelongLearningResult.previousRankLevel;
                    newState.currentRankTitle = data.lifelongLearningResult.previousRankTitle;
                    if (newState.profession) {
                        newState.profession = {
                            ...newState.profession,
                            salary: data.lifelongLearningResult.previousProfessionSalary
                        };
                    }
                }
                else if (data.usage === 'cash' && data.source === 'income') {
                    if (data.stockList && data.stockList.length > 0) {
                        const updatedAssets = [...newState.assets];
                        data.stockList.forEach((item: any) => {
                            const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && extractAssetSymbol(a.name) === item.symbol);
                            if (assetIdx !== -1) {
                                const asset = updatedAssets[assetIdx];
                                const newQty = (asset.quantity || 0) + item.qty;
                                updatedAssets[assetIdx] = { ...asset, quantity: newQty, cost: newQty * (asset.lastPurchasePrice || item.price) };
                            } else {
                                updatedAssets.push({ id: generateId(), name: getStockAssetLabel(item.symbol), cost: item.price * item.qty, downPayment: item.price * item.qty, cashflow: 0, type: '股票', quantity: item.qty, lastPurchasePrice: item.price });
                            }
                        });
                        newState.assets = updatedAssets;
                    }
                    if (data.batchSellList && data.batchSellList.length > 0) {
                        data.batchSellList.forEach((item: any) => {
                            if (item.asset) {
                                newState.assets = [...newState.assets, item.asset];
                            }
                            if (item.liability) {
                                newState.liabilities = [...newState.liabilities, item.liability];
                            }
                        });
                    }
                    if (data.relatedAssetPayload) {
                        newState.assets = [...newState.assets, data.relatedAssetPayload];
                    }
                    if (data.removedLiabilities) {
                        newState.liabilities = [...newState.liabilities, ...data.removedLiabilities];
                    }
                }
                else if (data.usage === 'stock_update' && data.stockDividendPayload) {
                    const updatedAssets = [...newState.assets];
                    data.stockDividendPayload.items.forEach((item: any) => {
                        const idx = updatedAssets.findIndex(a => a.id === item.assetId);
                        if (idx !== -1) {
                            const asset = updatedAssets[idx];
                            const newQty = Math.max(0, (asset.quantity || 0) - item.addedQty);
                            updatedAssets[idx] = { ...asset, quantity: newQty, cost: newQty * (asset.lastPurchasePrice || 0) };
                        }
                    });
                    newState.assets = updatedAssets;
                }
                else if (data.insuranceType && data.insurancePayload) {
                    if (data.insuranceType === 'medical') {
                        newState.medicalInsuranceCount = Math.max(0, (newState.medicalInsuranceCount || 0) - (data.insurancePayload.medicalQty || 0));
                    } else if (data.insuranceType === 'house' && data.insurancePayload.targetAssetIds) {
                        const ids = data.insurancePayload.targetAssetIds;
                        newState.assets = newState.assets.map(a => ids.includes(a.id) ? { ...a, isInsured: false } : a);
                    } else if (data.insuranceType === 'aircraft') {
                        newState.assets = newState.assets.map(a => (a.type === '汽車' || a.type === '飛行器') ? { ...a, isInsured: false } : a);
                    }
                    
                    if (data.expensePayload) {
                        const { category, amount: expAmount, isIncrease } = data.expensePayload;
                        const currentVal = newState.expenses[category] || 0;
                        // Reverse the expense change!
                        newState.expenses = { ...newState.expenses, [category]: isIncrease ? Math.max(0, currentVal - expAmount) : currentVal + expAmount };
                    }
                }

                else if (data.type === 'bubble_burst') {
                    if (data.fullAssets) {
                        // Restore from full snapshot
                        const updatedAssets = [...newState.assets.filter(a => a.type !== '股票')];
                        updatedAssets.push(...data.fullAssets);
                        newState.assets = updatedAssets;
                    } else {
                        // Fallback for older records (partial restoration)
                        const updatedAssets = [...newState.assets];
                        data.affectedStocks.forEach((info: string) => {
                            const match = info.match(/股票 \((.*?)\) \((.*?) -> (.*?)\)/);
                            if (match) {
                                const symbol = match[1];
                                const oldQty = parseInt(match[2]);
                                const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && a.name === `股票 (${symbol})`);
                                if (assetIdx !== -1) {
                                    const asset = updatedAssets[assetIdx];
                                    updatedAssets[assetIdx] = {
                                        ...asset,
                                        quantity: oldQty,
                                        cost: oldQty * (asset.lastPurchasePrice || 0)
                                    };
                                }
                            }
                        });
                        newState.assets = updatedAssets;
                    }
                }
                else if (data.type === 'market_update' && data.updates) {
                    if (data.previousPrices) {
                        newState.marketPrices = data.previousPrices;
                    }
                }
                else if (data.type === 'exam_promotion') {
                    if (data.success && newState.profession) {
                        newState.currentRankLevel = data.oldRankLevel;
                        newState.currentRankTitle = data.oldTitle;
                        newState.profession = {
                            ...newState.profession,
                            salary: data.oldSalary
                        };
                    }
                }
                else if (data.type === 'lifelong_success') {
                    newState.abilities = data.oldAbilities;
                    if (data.learningType === 'enhance_profession' && newState.profession) {
                        newState.currentRankLevel = data.oldRankLevel;
                        newState.currentRankTitle = data.oldTitle || newState.currentRankTitle;
                        newState.profession = {
                            ...newState.profession,
                            salary: data.oldSalary
                        };
                    } else if (data.learningType === 'stock_ability') {
                        newState.assets = data.oldAssets;
                    }
                }
                else if (data.type === 'biz_upgrade') {
                    const assetIdx = newState.assets.findIndex(a => a.id === data.assetId);
                    if (assetIdx !== -1) {
                        const asset = newState.assets[assetIdx];
                        newState.assets[assetIdx] = {
                            ...asset,
                            cashflow: data.oldCashflow,
                            isUpgraded: false
                        };
                    }
                    if (data.removedLiability) {
                        newState.liabilities = [...newState.liabilities, data.removedLiability];
                    }
                }

                if (data.name.includes('達成事業成就')) {
                    newState.happiness = newState.happiness.map(h => h.id === 'h_career' ? { ...h, checked: false } : h);
                } else if (data.name.includes('實現人生夢想')) {
                    newState.happiness = newState.happiness.map(h => h.id === 'h_dream' ? { ...h, checked: false } : h);
                }
                newState.happinessTotal = newState.happiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);

            } catch (e) {
                console.error("Failed to parse transaction details for reversal", e);
            }

            const totalCashChange = newState.history.reduce((sum, tx) => sum + (tx.cashChange || 0), 0);
            let runningBalance = newState.cash - totalCashChange;
            newState.history = newState.history.map(tx => {
                runningBalance += (tx.cashChange || 0);
                return { ...tx, balance: runningBalance };
            });

            return newState;
        });

        showAlert('刪除成功，財務報表已更新', 'success');
    };

    const normalizeTransactionData = (data: TransactionData): TransactionData => {
        if (data.usage === 'buy_asset' && data.assetChange?.asset) {
            const asset = data.assetChange.asset;

            if (asset.type === '股票' && asset.symbol && asset.shares) {
                return {
                    ...data,
                    usage: 'asset',
                    stockList: [{
                        symbol: asset.symbol,
                        price: asset.buyPrice || 0,
                        qty: asset.shares
                    }],
                    assetChange: undefined
                };
            }

            if (asset.type === '定存') {
                return {
                    ...data,
                    name: '買入定期存款',
                    usage: 'asset',
                    assetDetails: {
                        type: '定存',
                        cashflow: Math.floor((data.amount || 0) * 0.01),
                        downPayment: data.amount || 0
                    },
                    assetChange: undefined
                };
            }
        }

        if (data.usage === 'sell_asset' && data.sellAssetPayload?.type === 'stock') {
            return {
                ...data,
                source: 'income',
                usage: 'cash',
                stockList: [{
                    symbol: data.sellAssetPayload.symbol,
                    price: data.sellAssetPayload.currentPrice,
                    qty: data.sellAssetPayload.sharesToSell
                }],
                sellAssetPayload: undefined
            };
        }

        if (data.usage === 'loan') {
            const liability = data.liabilityChange?.liability;
            return {
                ...data,
                source: 'loan',
                usage: 'cash',
                liabilityChange: undefined,
                liabilityId: liability?.id
            };
        }

        if (data.usage === 'loan_repayment') {
            return {
                ...data,
                usage: 'liability',
                liabilityId: data.liabilityChange?.liabilityId || data.liabilityId,
                liabilityChange: undefined
            };
        }

        if (data.usage === 'insurance') {
            // 保險是每月固定支出，購買當下不扣現金，維持呼叫端傳入的 cashChange（通常為 0）。
            return {
                ...data,
                usage: 'expense',
                amount: data.amount || data.expensePayload?.amount || 0
            };
        }

        return data;
    };

    const applyAutoLiabilityRepayment = (state: GameState) => {
        if (state.cash <= 0) {
            return { nextState: state, repaidAmount: 0 };
        }

        let remainingCash = state.cash;
        let repaidAmount = 0;
        const priorityTypes: GameState['liabilities'][number]['type'][] = ['強制負債', '信用貸款'];
        let nextLiabilities = [...state.liabilities];

        priorityTypes.forEach(priorityType => {
            nextLiabilities = nextLiabilities
                .map(liability => {
                    if (liability.type !== priorityType || remainingCash <= 0) return liability;

                    const paid = Math.min(liability.totalOwed, remainingCash);
                    remainingCash -= paid;
                    repaidAmount += paid;

                    const nextTotal = liability.totalOwed - paid;
                    return {
                        ...liability,
                        totalOwed: nextTotal,
                        monthlyPayment: getLiabilityMonthlyPayment(liability.type, nextTotal)
                    };
                })
                .filter(liability => liability.totalOwed > 0);
        });

        let nextLegacyLoans = state.loans;
        if (remainingCash > 0 && nextLegacyLoans > 0) {
            const paid = Math.min(nextLegacyLoans, remainingCash);
            remainingCash -= paid;
            repaidAmount += paid;
            nextLegacyLoans -= paid;
        }

        return {
            nextState: {
                ...state,
                cash: remainingCash,
                liabilities: nextLiabilities,
                loans: nextLegacyLoans
            },
            repaidAmount
        };
    };

    const handleTransactionSubmit = (data: TransactionData) => {
        data = normalizeTransactionData(data);
        // 事件級防重複套用（P1-05）：棋盤財務檢核流程若因 modal 重開、effect 重跑或
        // snapshot 延遲而重複呼叫，同一個 boardEventId 只會套用一次。
        if (data.boardEventId && gameState.appliedBoardFinancialEventIds?.includes(data.boardEventId)) {
            return true;
        }
        const amount = Number(data.amount);
        if (isNaN(amount) || amount < 0) {
            showAlert('請輸入有效金額', 'error');
            return false;
        }
        if (data.usage === 'liability' && data.liabilityId) {
            if (amount > gameState.cash) {
                showAlert('現金不足，無法完成還款', 'error');
                return false;
            }

            if (data.liabilityId === 'multiple_credit_loans') {
                const totalCreditDebt =
                    gameState.liabilities
                        .filter(liability => liability.type === '信用貸款')
                        .reduce((sum, liability) => sum + liability.totalOwed, 0) +
                    (gameState.loans || 0);

                if (totalCreditDebt <= 0) {
                    showAlert('目前沒有可償還的信用貸款', 'error');
                    return false;
                }
                if (amount > totalCreditDebt) {
                    showAlert(`還款金額不可超過信用貸款總額 ${formatMoney(totalCreditDebt)}`, 'error');
                    return false;
                }
            } else if (data.liabilityId === 'bank_loan') {
                if (amount > (gameState.loans || 0)) {
                    showAlert(`還款金額不可超過信用貸款總額 ${formatMoney(gameState.loans || 0)}`, 'error');
                    return false;
                }
            } else {
                const targetLiability = gameState.liabilities.find(liability => liability.id === data.liabilityId);
                if (!targetLiability) {
                    showAlert('找不到要償還的貸款資料，請重新開啟還款視窗', 'error');
                    return false;
                }
                if (amount > targetLiability.totalOwed) {
                    showAlert(`還款金額不可超過 ${targetLiability.name} 的剩餘金額 ${formatMoney(targetLiability.totalOwed)}`, 'error');
                    return false;
                }
            }
        }

        const storageData: any = { ...data };

        // Determine flowType if not provided
        let flowType: '生活' | '投資' | '融資' | '其它' = (data.flowType as any) || '其它';
        if (!data.flowType) {
            if (data.usage === 'asset' || (data.usage === 'cash' && data.source === 'income')) {
                flowType = '投資';
            } else if (data.usage === 'liability' || (data.usage === 'cash' && data.source === 'loan')) {
                flowType = '融資';
            } else if (data.usage === 'expense_update' || data.usage === 'happiness_event' || data.usage === 'lifelong_learning' || data.usage === 'stock_update' || data.insuranceType) {
                flowType = '生活';
            }
        }

        // Pre-calculate success message
        let finalSuccessMessage = '交易已記錄';
        if (data.usage === 'asset') {
            if (data.stockList && data.stockList.length > 0) finalSuccessMessage = `成功買入股票 ${data.stockList.length} 筆`;
            else if (data.assetDetails) finalSuccessMessage = `成功買入 ${data.assetDetails.type} ${data.assetDetails.symbol || ''}`.trim();
        } else if (data.usage === 'liability') {
            finalSuccessMessage = `成功還款 ${formatMoney(amount)}`;
        } else if (data.source === 'loan' && data.usage === 'cash') {
            finalSuccessMessage = `成功借貸 ${formatMoney(amount)}`;
        } else if (data.usage === 'expense_update' && data.expensePayload) {
            finalSuccessMessage = `成功${data.expensePayload.isIncrease ? '增加' : '減少'}月支出`;
        } else if (data.usage === 'cash' && data.source === 'income') {
            finalSuccessMessage = data.stockList ? '成功賣出股票' : '成功賣出資產';
        } else if (data.usage === 'stock_update') {
            finalSuccessMessage = '配股已核發';
        } else if (data.usage === 'lifelong_learning') {
            finalSuccessMessage = '終身學習效果已結算';
        } else if (data.insuranceType) {
            finalSuccessMessage = '保險已生效';
        }

        setGameState(prev => {
            let newState = { ...prev };
            newState.cash += data.cashChange;

            if (data.usage === 'asset') {
                if (data.stockList && data.stockList.length > 0) {
                    const updatedAssets = [...newState.assets];
                    data.stockList.forEach(stock => {
                        const existingIdx = updatedAssets.findIndex(a => a.type === '股票' && extractAssetSymbol(a.name) === stock.symbol);
                        if (existingIdx !== -1) {
                            const existing = updatedAssets[existingIdx];
                            const newQty = (existing.quantity || 0) + stock.qty;
                            updatedAssets[existingIdx] = { ...existing, quantity: newQty, lastPurchasePrice: stock.price, cost: newQty * stock.price };
                        } else {
                            updatedAssets.push({ id: generateId(), name: getStockAssetLabel(stock.symbol), cost: stock.price * stock.qty, downPayment: stock.price * stock.qty, cashflow: 0, type: '股票' as const, quantity: stock.qty, lastPurchasePrice: stock.price });
                        }
                    });
                    newState.assets = updatedAssets;
                } else if (data.assetDetails) {
                    const details = data.assetDetails;
                    const loanAmt = details.loanAmount || 0;

                    // 企業類型的資產，其顯示價值（cost）應為投資總額（downPayment），不包含企業貸款
                    const assetCost = details.type === '企業'
                        ? (details.downPayment || 0)
                        : data.amount;

                    const displayName = details.symbol
                        ? (details.type === '股票'
                            ? getStockAssetLabel(details.symbol)
                            : details.type === '不動產'
                              ? getAssetDisplayLabel({ id: '', name: details.symbol, cost: 0, downPayment: 0, cashflow: 0, type: '不動產', houseType: details.houseType })
                              : details.type === '企業'
                                ? getAssetDisplayLabel({ id: '', name: details.symbol, cost: 0, downPayment: 0, cashflow: 0, type: '企業' })
                                : `${details.type} ${details.symbol}`.trim())
                        : details.type === '不動產'
                          ? getAssetDisplayLabel({ id: '', name: '', cost: 0, downPayment: 0, cashflow: 0, type: '不動產', houseType: details.houseType })
                          : `${details.type} ${details.symbol || ''}`.trim();

                    const newAsset: Asset = {
                        id: generateId(),
                        name: displayName,
                        cost: assetCost,
                        downPayment: details.downPayment || 0,
                        cashflow: details.cashflow || 0,
                        type: details.type as any,
                        isSelfUse: details.isSelfUse,
                        houseType: details.houseType,
                        isInsured: false
                    };
                    storageData.createdAssetId = newAsset.id;
                    newState.assets = [...newState.assets, newAsset];
                    if (loanAmt > 0) {
                        const loanTypeMap: Record<string, '不動產貸款' | '企業貸款' | '汽車貸款'> = { '不動產': '不動產貸款', '企業': '企業貸款', '飛行器': '汽車貸款', '汽車': '汽車貸款' };
                        const loanType = loanTypeMap[details.type];
                        if (loanType) {
                            newState.liabilities = [...newState.liabilities, { id: generateId(), name: `${loanType} (${details.symbol || ''})`.trim(), totalOwed: loanAmt, monthlyPayment: details.loanInterest || 0, type: loanType, linkedAssetId: newAsset.id }];
                        }
                    }




                    if (details.happyPoints && details.happyPoints > 0) {
                        // Determine the label used in the initial happiness list
                        // REAL_ESTATE_TYPES has { type: '1room', label: '單間小套房' }
                        // initialHappinessList has '單間小套房', '兩房一廳', '三房兩廳', '五房三廳'
                        // We need to map the REAL_ESTATE_TYPES label to the initial list label if they differ slightly
                        // 1room -> '單間小套房' (Match)
                        // 2room -> '兩房一廳住宅' in constants vs '兩房一廳' in initial list
                        // 3room -> '三房兩廳住宅' in constants vs '三房兩廳' in initial list
                        // 5room -> '五房三廳豪華住宅' in constants vs '五房三廳' in initial list

                        let baseLabel = REAL_ESTATE_TYPES[details.symbol || '']?.label || '自用住宅';
                        if (baseLabel === '兩房一廳住宅') baseLabel = '兩房一廳';
                        if (baseLabel === '三房兩廳住宅') baseLabel = '三房兩廳';
                        if (baseLabel === '五房三廳豪華住宅') baseLabel = '五房三廳';

                        // Check if the base item exists (e.g., "單間小套房")
                        const existingBaseItemIndex = newState.happiness.findIndex(h => h.label === baseLabel);

                        if (existingBaseItemIndex !== -1) {
                            const item = newState.happiness[existingBaseItemIndex];
                            if (!item.checked) {
                                // If base item exists but not checked, verify it: this is the first house
                                newState.happiness = newState.happiness.map((h, i) =>
                                    i === existingBaseItemIndex ? { ...h, checked: true } : h
                                );
                            } else {
                                // If base item is already checked, create a new item with index
                                const existingCount = newState.happiness.filter(h => h.label.startsWith(baseLabel)).length;
                                const nextIndex = existingCount + 1;
                                const happyLabel = `${baseLabel} ${nextIndex}`; // "單間小套房 2"

                                const newItem: HappinessItem = {
                                    id: `h_re_selfuse_${Math.random().toString(36).substr(2, 9)}`,
                                    label: happyLabel,
                                    points: details.happyPoints,
                                    checked: true,
                                    isCustom: true,
                                    parentId: 'h_house_self' // Nest it under the parent to look nice
                                };
                                newState.happiness = [...newState.happiness, newItem];
                            }
                        } else {
                            // If base item doesn't exist at all (fallback), create "單間小套房"
                            const newItem: HappinessItem = {
                                id: `h_re_selfuse_${Math.random().toString(36).substr(2, 9)}`,
                                label: baseLabel,
                                points: details.happyPoints,
                                checked: true,
                                isCustom: true,
                                parentId: 'h_house_self'
                            };
                            newState.happiness = [...newState.happiness, newItem];
                        }
                    }
                }
            } else if (data.usage === 'liability' && data.liabilityId) {
                if (data.liabilityId === 'multiple_credit_loans') {
                    let remaining = amount;
                    const repaidList: { id: string, paid: number, original: any }[] = [];

                    newState.liabilities = newState.liabilities.map(l => {
                        if (l.type === '信用貸款' && remaining > 0) {
                            const pay = Math.min(l.totalOwed, remaining);
                            remaining -= pay;
                            const newTotal = l.totalOwed - pay;
                            repaidList.push({ id: l.id, paid: pay, original: { ...l } });
                            return { ...l, totalOwed: newTotal, monthlyPayment: Math.floor(newTotal * 0.1) };
                        }
                        return l;
                    }).filter(l => l.totalOwed > 0);

                    if (remaining > 0 && newState.loans > 0) {
                        const pay = Math.min(newState.loans, remaining);
                        newState.loans -= pay;
                        remaining -= pay;
                        storageData.repaidLegacyLoan = pay;
                    }

                    storageData.repaidLiabilities = repaidList;
                } else if (data.liabilityId === 'bank_loan') {
                    newState.loans = Math.max(0, newState.loans - amount);
                } else {
                    newState.liabilities = newState.liabilities.map(l => {
                        if (l.id === data.liabilityId) {
                            const newTotal = Math.max(0, l.totalOwed - amount);
                            // 同步更新月支付金額（利息），維持 0.5% 或 10% 的比例
                            const newMonthly = getLiabilityMonthlyPayment(l.type, newTotal);
                            return { ...l, totalOwed: newTotal, monthlyPayment: newMonthly };
                        }
                        return l;
                    });
                    // 如果還清了，移除該負債
                    newState.liabilities = newState.liabilities.filter(l => l.totalOwed > 0);
                }
            } else if (data.source === 'loan' && data.usage === 'cash') {
                newState.liabilities = [...newState.liabilities, { id: generateId(), name: '信用貸款', totalOwed: amount, monthlyPayment: Math.floor(amount * 0.1), type: '信用貸款' }];
            } else if (data.usage === 'forced_debt') {
                newState.liabilities = [...newState.liabilities, { id: generateId(), name: '強制負債', totalOwed: amount, monthlyPayment: 0, type: '強制負債' }];
            } else if (data.usage === 'happiness_event' && data.happinessEventPayload) {
                const { id, name, points, monthlyExpenseChange, progressId, happinessItemId, sourceCardId } = data.happinessEventPayload;

                // Add to completed list
                newState.completedHappinessEvents = Array.from(new Set([
                    ...(newState.completedHappinessEvents || []),
                    id,
                    ...(progressId ? [progressId] : []),
                    ...(sourceCardId ? [sourceCardId] : [])
                ]));

                // Update existing happiness item if it exists
                const mapping: Record<string, string> = {
                    'date': 'h_date',
                    'propose': 'h_proposal',
                    'wedding': 'h_wedding',
                    'child1': 'h_child1',
                    'child2': 'h_child2'
                };
                const targetId = happinessItemId || mapping[progressId || id];

                if (targetId && newState.happiness.some(h => h.id === targetId)) {
                    newState.happiness = newState.happiness.map(h =>
                        h.id === targetId ? { ...h, checked: true } : h
                    );
                } else {
                    // Fallback for custom or unexpected items
                    const newItem: HappinessItem = {
                        id: `h_event_${sourceCardId || id}_${Date.now()}`,
                        label: name,
                        points: points,
                        checked: true,
                        isCustom: true
                    };
                    newState.happiness = [...newState.happiness, newItem];
                }

                // Handle monthly expense increase
                if (monthlyExpenseChange) {
                    const category = data.happinessEventPayload.expenseCategory || 'otherMedicalChild';
                    const currentVal = newState.expenses[category] || 0;
                    newState.expenses = { ...newState.expenses, [category]: currentVal + monthlyExpenseChange };
                }
            } else if (data.usage === 'expense_update' && data.expensePayload) {
                const { category, amount: expAmount, isIncrease } = data.expensePayload;
                const currentVal = newState.expenses[category] || 0;
                newState.expenses = { ...newState.expenses, [category]: isIncrease ? currentVal + expAmount : Math.max(0, currentVal - expAmount) };
            } else if (data.usage === 'cash' && data.source === 'income') {
                let updatedAssets = [...newState.assets];
                if (data.stockList && data.stockList.length > 0) {
                    data.stockList.forEach(item => {
                        const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && extractAssetSymbol(a.name) === item.symbol);
                        if (assetIdx >= 0) {
                            const asset = updatedAssets[assetIdx];
                            if (asset.quantity && asset.quantity >= item.qty) {
                                if (asset.quantity === item.qty) { updatedAssets.splice(assetIdx, 1); }
                                else { const remainingQty = asset.quantity - item.qty; updatedAssets[assetIdx] = { ...asset, quantity: remainingQty, lastPurchasePrice: item.price, cost: remainingQty * item.price }; }
                            }
                        }
                    });
                } else if (data.batchSellList && data.batchSellList.length > 0) {
                    // 處理批次賣出
                    data.batchSellList.forEach(item => {
                        updatedAssets = updatedAssets.filter(a => a.id !== item.asset.id);
                        if (item.liability) {
                            newState.liabilities = newState.liabilities.filter(l => l.id !== item.liability?.id);
                        }
                    });
                } else if (data.relatedAssetId) {
                    const assetToSell = updatedAssets.find(a => a.id === data.relatedAssetId);
                    if (assetToSell) {
                        if (assetToSell.type === '定存') {
                            updatedAssets = updatedAssets.reduce((acc: Asset[], asset) => {
                                if (asset.id !== data.relatedAssetId) {
                                    acc.push(asset);
                                    return acc;
                                }

                                const remainingDeposit = Math.max(0, asset.cost - amount);
                                if (remainingDeposit > 0) {
                                    acc.push({
                                        ...asset,
                                        cost: remainingDeposit,
                                        downPayment: remainingDeposit,
                                        cashflow: Math.floor(remainingDeposit * 0.01)
                                    });
                                }
                                return acc;
                            }, []);
                        } else {
                            storageData.relatedAssetPayload = assetToSell;
                            updatedAssets = updatedAssets.filter(a => a.id !== data.relatedAssetId);

                            const assetSymbol = assetToSell.name.split(' ').slice(1).join(' ');
                            const loanType = assetToSell.type === '不動產' ? '不動產貸款' : assetToSell.type === '企業' ? '企業貸款' : (assetToSell.type === '汽車' || assetToSell.type === '飛行器') ? '汽車貸款' : null;

                            if (loanType) {
                                const loanName = `${loanType} (${assetSymbol})`.trim();
                                const removedLiabilities = newState.liabilities.filter(l => l.name === loanName);
                                storageData.removedLiabilities = removedLiabilities;
                                newState.liabilities = newState.liabilities.filter(l => l.name !== loanName);
                            }
                        }
                    }
                }
                newState.assets = updatedAssets;
            } else if (data.usage === 'stock_update' && data.stockDividendPayload) {
                const updatedAssets = [...newState.assets];
                data.stockDividendPayload.items.forEach(item => {
                    const idx = updatedAssets.findIndex(a => a.id === item.assetId);
                    if (idx !== -1) {
                        const asset = updatedAssets[idx];
                        const newQty = (asset.quantity || 0) + item.addedQty;
                        updatedAssets[idx] = { ...asset, quantity: newQty, cost: newQty * (asset.lastPurchasePrice || 0) };
                    }
                });
                newState.assets = updatedAssets;
            } else if (data.insuranceType && data.insurancePayload) {
                if (data.insuranceType === 'medical') { newState.medicalInsuranceCount = (newState.medicalInsuranceCount || 0) + (data.insurancePayload.medicalQty || 0); }
                else if (data.insuranceType === 'house' && data.insurancePayload.targetAssetIds) {
                    const targetIds = data.insurancePayload.targetAssetIds;
                    newState.assets = newState.assets.map(a => targetIds.includes(a.id) ? { ...a, isInsured: true } : a);
                } else if (data.insuranceType === 'aircraft') {
                    newState.assets = newState.assets.map(a => (a.type === '汽車' || a.type === '飛行器') ? { ...a, isInsured: true } : a);
                }
                
                if (data.expensePayload) {
                    const { category, amount: expAmount, isIncrease } = data.expensePayload;
                    const currentVal = newState.expenses[category] || 0;
                    newState.expenses = { ...newState.expenses, [category]: isIncrease ? currentVal + expAmount : Math.max(0, currentVal - expAmount) };
                }
            }

            const { sourceLabel, usageLabel } = deriveTransactionLabels(data);
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: data.name,
                amount: amount,
                sourceLabel,
                usageLabel,
                cashChange: data.cashChange,
                balance: newState.cash,
                details: JSON.stringify(storageData),
                flowType: flowType
            };
            newState.history = [...newState.history, newTx];

            if (data.name.includes('達成事業成就')) {
                newState.happiness = newState.happiness.map(h => h.id === 'h_career' ? { ...h, checked: true } : h);
                if (prev.selectedEnterprise) {
                    const e = prev.selectedEnterprise;
                    const isRelated = prev.profession?.id === e.relatedProfessionId;
                    const bonusPercent = isRelated ? prev.currentRankLevel * 10 : 0;
                    const baseIncome = e.income;
                    const bonusAmt = Math.floor(baseIncome * (bonusPercent / 100));
                    newState.income = { ...newState.income, [e.name]: baseIncome + bonusAmt };
                }
            }
            else if (data.name.includes('實現人生夢想')) { newState.happiness = newState.happiness.map(h => h.id === 'h_dream' ? { ...h, checked: true } : h); }
            newState.happinessTotal = newState.happiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);

            if (data.boardEventId) {
                newState.appliedBoardFinancialEventIds = [...(prev.appliedBoardFinancialEventIds || []), data.boardEventId];
            }

            return newState;
        });

        showAlert(finalSuccessMessage, 'success');
        return true;
    };

    const handlePaydayConfirm = () => {
        const flow = summary.monthlyCashflow;
        executePayday(flow);
    };

    const executePayday = (flow: number) => {
        setGameState(prev => {
            const newState = { ...prev, cash: prev.cash + flow };
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: '每月結餘',
                amount: Math.abs(flow),
                sourceLabel: flow >= 0 ? '收入' : '支出',
                usageLabel: '月現金流',
                cashChange: flow,
                balance: newState.cash,
                flowType: '生活'
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
        showAlert(
            flow >= 0
                ? '已領取月結餘'
                : '已支付月結餘',
            'success'
        );
    };

    const confirmMedicalClaim = () => {
        const claimAmount = (gameState.medicalInsuranceCount || 0) * 50000;
        if (claimAmount <= 0) {
            showAlert('沒有可用的醫療保險', 'error');
            return;
        }

        executeMedicalClaim(claimAmount);
    };

    const executeMedicalClaim = (claimAmount: number) => {
        setGameState(prev => {
            const newState = { ...prev, cash: prev.cash + claimAmount };
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: '醫療保險理賠',
                amount: claimAmount,
                sourceLabel: '收入',
                usageLabel: '保險理賠',
                cashChange: claimAmount,
                balance: newState.cash,
                flowType: '生活'
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
        showAlert(`申請成功！獲得理賠 ${formatMoney(claimAmount)}`, 'success');
    };

    const confirmAircraftClaim = () => {
        const hasInsuredAircraft = gameState.assets.some(a => (a.type === '汽車' || a.type === '飛行器') && a.isInsured);
        if (!hasInsuredAircraft) {
            showAlert('沒有已投保的汽車', 'error');
            return;
        }

        const claimAmount = 400000; // 汽車理賠為 500,000 的 80%

        executeAircraftClaim(claimAmount);
    };

    const executeAircraftClaim = (claimAmount: number) => {
        setGameState(prev => {
            const newState = { ...prev, cash: prev.cash + claimAmount };
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: '汽車保險理賠',
                amount: claimAmount,
                sourceLabel: '收入',
                usageLabel: '保險理賠',
                cashChange: claimAmount,
                balance: newState.cash,
                flowType: '生活'
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
        showAlert(`申請成功！獲得理賠 ${formatMoney(claimAmount)}`, 'success');
    };

    const handleToggleHappiness = (id: string, checked?: boolean) => {
        setGameState(prev => {
            const item = prev.happiness.find(h => h.id === id);
            if (!item) return prev;

            const isNowChecked = checked !== undefined ? checked : !item.checked;
            if (item.checked === isNowChecked) return prev;

            const newHappiness = prev.happiness.map(h => {
                if (h.id === id) return { ...h, checked: isNowChecked };
                return h;
            });
            const total = newHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);

            return {
                ...prev,
                happiness: newHappiness,
                happinessTotal: total
            };
        });
    };

    const handleAddHappinessItem = (label: string, points: number) => {
        executeAddHappinessItem(label, points);
    };

    const executeAddHappinessItem = (label: string, points: number) => {
        setGameState(prev => {
            const newItem = { id: generateId(), label, points, checked: true, isCustom: true };
            const newHappiness = [...prev.happiness, newItem];

            return {
                ...prev,
                happiness: newHappiness,
                happinessTotal: newHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0)
            };
        });
    };

    const handleRemoveHappinessItem = (id: string) => {
        setGameState(prev => {
            const filteredHappiness = prev.happiness.filter(h => h.id !== id);

            return {
                ...prev,
                happiness: filteredHappiness,
                happinessTotal: filteredHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0)
            };
        });
    };

    const handlePromotionConfirm = (_type: 'normal' | 'lifelong' = 'normal'): boolean | 'pending' => {
        const cost = 1000;
        if (gameState.cash < cost) {
            showAlert(`現金不足！報名費需 ${cost.toLocaleString()}`, 'error');
            return false;
        }
        executePromotionFee(cost);
        return true;
    };

    const executePromotionFee = (cost: number) => {
        setGameState(prev => {
            const newState = { ...prev, cash: prev.cash - cost };
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: '升等考試報名費',
                amount: cost,
                sourceLabel: '支出',
                usageLabel: '教育進修',
                cashChange: -cost,
                balance: newState.cash,
                flowType: '生活'
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
    };

    const handleBizUpgrade = (assetId: string, diceRoll: number) => {
        setGameState(prev => {
            const newState = { ...prev };
            const assetIdx = newState.assets.findIndex(a => a.id === assetId);
            if (assetIdx === -1) return prev;

            const asset = newState.assets[assetIdx];
            const symbolMatch = asset.name.match(/[A-Z]\d+/);
            const symbol = symbolMatch ? symbolMatch[0] : '';

            // 1. Update Asset
            const oldIncome = asset.cashflow;
            const addedIncome = diceRoll * 10000;
            const newAsset: Asset = {
                ...asset,
                name: symbol ? `小型企業 (${symbol})` : '小型企業',
                cashflow: oldIncome + addedIncome,
                isUpgraded: true
            };

            const updatedAssets = [...newState.assets];
            updatedAssets[assetIdx] = newAsset;
            newState.assets = updatedAssets;

            // 2. Remove associated liability
            const loanName = `企業貸款 (${symbol})`.trim();
            newState.liabilities = newState.liabilities.filter(l => l.name !== loanName);

            // 3. Add history record
            const upgradeTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: `📈 企業升級：${symbol}`,
                amount: 0,
                sourceLabel: '企業事件',
                usageLabel: '資產升級',
                cashChange: 0,
                balance: newState.cash,
                details: JSON.stringify({
                    type: 'biz_upgrade',
                    assetId,
                    symbol,
                    diceRoll,
                    addedIncome,
                    oldCashflow: asset.cashflow,
                    removedLiability: newState.liabilities.find(l => l.name === loanName) || null,
                    description: `${symbol} 從兼職工作室升級為小型企業。利息全免，企業收入增加 ${formatMoney(addedIncome)}。`
                }),
                flowType: '投資'
            };
            newState.history = [upgradeTx, ...newState.history];

            return newState;
        });
        showAlert('🎉 企業升級成功！', 'success');
    };

    const handleLifelongConfirm = (type: string, cost: number): boolean | 'pending' => {
        if (gameState.cash < cost) {
            showAlert(`現金不足，需要 ${formatMoney(cost)}`, 'error');
            return false;
        }
        executeLifelongFee(type, cost);
        return true;
    };

    const executeLifelongFee = (type: string, cost: number) => {
        setGameState(prev => {
            const newState = { ...prev, cash: prev.cash - cost };
            const typeNames: Record<string, string> = {
                'enhance_profession': '增強職業能力',
                'stock_ability': '投資股票的能力',
                'real_estate_ability': '投資不動產的能力'
            };
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: `終身學習報名：${typeNames[type] || type}`,
                amount: cost,
                sourceLabel: '支出',
                usageLabel: '教育支出',
                cashChange: -cost,
                balance: newState.cash,
                flowType: '生活'
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
    };

    const applyLifelongResult = (type: string, success: boolean, showAlertMsg: boolean = true) => {
        if (!success) return;

        setGameState(prev => {
            const typeNames: Record<string, string> = {
                'enhance_profession': '增強職業能力',
                'stock_ability': '投資股票的能力',
                'real_estate_ability': '投資不動產的能力'
            };
            const lifelongOutcome = applyLifelongLearningEffect(prev, type as 'enhance_profession' | 'stock_ability' | 'real_estate_ability', 1, 6);
            const newState = lifelongOutcome.nextState;

            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: `終身學習成功：${typeNames[type] || type}`,
                amount: 0,
                sourceLabel: '事件',
                usageLabel: '能力獲得',
                cashChange: 0,
                balance: newState.cash,
                details: JSON.stringify({
                    type: 'lifelong_success',
                    learningType: type,
                    oldAbilities: prev.abilities,
                    newAbilities: newState.abilities,
                    // If it was profession enhancement, store rank info
                    oldTitle: prev.currentRankTitle,
                    oldRankLevel: prev.currentRankLevel,
                    newRankLevel: newState.currentRankLevel,
                    oldSalary: prev.profession?.salary || 0,
                    newSalary: newState.profession?.salary || 0,
                    // If it was stock ability, store previous assets to revert doubling
                    oldAssets: prev.assets
                }),
                flowType: '其它'
            };

            newState.history = [...newState.history, newTx];
            return newState;
        });

        if (showAlertMsg) {
            const messages: Record<string, string> = {
                'enhance_profession': '職業能力已提升，職位晉升一級！',
                'stock_ability': '已獲得投資股票的能力！',
                'real_estate_ability': '已獲得投資不動產的能力！'
            };
            showAlert(`🎉 ${messages[type] || '學習成功！'}`, 'success');
        }
    };

    const applyExamResult = (success: boolean, bonus: number, newTitle: string) => {
        setGameState(prev => {
            if (!prev.profession) return prev;

            const updatedProfession = success
                ? { ...prev.profession, salary: prev.profession.salary + bonus }
                : prev.profession;

            const newState = {
                ...prev,
                profession: updatedProfession,
                currentRankLevel: success ? prev.currentRankLevel + 1 : prev.currentRankLevel,
                currentRankTitle: success ? newTitle : prev.currentRankTitle
            };

            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: success ? '晉升加薪' : '升等考試未通過',
                amount: success ? bonus : 0,
                sourceLabel: success ? '收入' : '事件',
                usageLabel: success ? '工作收入增加' : '考試結果',
                cashChange: 0,
                balance: newState.cash,
                details: JSON.stringify({
                    type: 'exam_promotion',
                    success,
                    bonus,
                    oldTitle: prev.currentRankTitle,
                    newTitle,
                    oldSalary: prev.profession?.salary || 0,
                    newSalary: updatedProfession.salary,
                    oldRankLevel: prev.currentRankLevel,
                    newRankLevel: success ? prev.currentRankLevel + 1 : prev.currentRankLevel
                }),
                flowType: '其它'
            };

            newState.history = [...newState.history, newTx];
            return newState;
        });
    };

    const handleFinishGame = async (meta: { playerName: string }) => {
        // 限制歷史紀錄長度，避免超過 Firestore 1MB 限制
        const optimizedHistory = gameState.history.slice(0, 100);

        const record: GameRecord = {
            id: generateId(),
            date: new Date().toISOString(),
            playerName: meta.playerName,
            reportName: gameState.reportName || '',
            profession: gameState.profession?.title || 'Unknown',
            finalRankTitle: gameState.currentRankTitle || gameState.profession?.title || 'Unknown',
            finalScore: scoreResult.totalScore,
            happinessScore: gameState.happinessTotal,
            maxRankLevel: gameState.currentRankLevel,
            isWin: summary.passiveIncome > summary.totalExpenses,
            financialSummary: summary,
            gameStateSnapshot: {
                assets: gameState.assets,
                liabilities: gameState.liabilities,
                income: gameState.income,
                expenses: gameState.expenses,
                history: optimizedHistory,
                happiness: gameState.happiness,
                cash: gameState.cash,
                loans: gameState.loans,
            }
        };
        await saveGameRecord(record);
        return record;
    };

    return {
        gameState,
        summary,
        scoreResult,
        alertInfo,
        showAlert,
        addMoney,
        handleDeleteTransactionRecord,
        handleTransactionSubmit,
        handlePaydayConfirm,
        executePayday,
        confirmMedicalClaim,
        executeMedicalClaim,
        confirmAircraftClaim,
        executeAircraftClaim,
        handleToggleHappiness,
        handleAddHappinessItem,
        executeAddHappinessItem,
        handleRemoveHappinessItem,
        handlePromotionConfirm,
        executePromotionFee,
        handleBizUpgrade,
        handleLifelongConfirm,
        executeLifelongFee,
        applyLifelongResult,
        applyExamResult,
        handleFinishGame,
        happinessSubMode,
        setHappinessSubMode
    };
};
