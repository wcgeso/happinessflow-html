import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { GameRecord, Transaction, Asset, TransactionData, HappinessItem } from '../types';
import { formatMoney } from '../utils/gameUtils';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useGameLogic = () => {
    const { gameState, setGameState, gameHistory, setGameHistory, summary, scoreResult, alertInfo, showAlert } = useGame();

    const [happinessSubMode, setHappinessSubMode] = useState<'history' | 'pay' | 'inc_exp'>('history');

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

            if (!deletedTx.details) return newState;

            try {
                const data: any = JSON.parse(deletedTx.details);

                // 2. State Content Reversal
                if (data.usage === 'asset') {
                    if (data.stockList && data.stockList.length > 0) {
                        const updatedAssets = [...newState.assets];
                        data.stockList.forEach((stock: any) => {
                            const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && a.name === `股票 ${stock.symbol}`);
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
                        const assetName = `${details.type} ${details.symbol || ''}`.trim();
                        newState.assets = newState.assets.filter(a => a.name !== assetName);
                        if (details.loanAmount && details.loanAmount > 0) {
                            const loanName = `${details.type === '不動產' ? '不動產貸款' : details.type === '企業' ? '企業貸款' : '飛行器貸款'} (${details.symbol || ''})`.trim();
                            newState.liabilities = newState.liabilities.filter(l => l.name !== loanName);
                        }
                    }
                }
                else if (data.usage === 'liability' && data.liabilityId) {
                    if (data.liabilityId === 'bank_loan') {
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
                else if (data.usage === 'expense_update' && data.expensePayload) {
                    const { category, amount, isIncrease } = data.expensePayload;
                    const currentVal = newState.expenses[category] || 0;
                    newState.expenses = { ...newState.expenses, [category]: isIncrease ? Math.max(0, currentVal - amount) : currentVal + amount };
                }
                else if (data.usage === 'happiness_event' && data.happinessEventPayload) {
                    const { id, monthlyExpenseChange, expenseCategory } = data.happinessEventPayload;
                    
                    // 1. Reverse monthly expense
                    if (monthlyExpenseChange) {
                        const cat = (expenseCategory as any) || 'otherMedicalChild';
                        const currentVal = newState.expenses[cat] || 0;
                        newState.expenses = { ...newState.expenses, [cat]: Math.max(0, currentVal - monthlyExpenseChange) };
                    }
                    
                    // 2. Reverse completed list
                    newState.completedHappinessEvents = (newState.completedHappinessEvents || []).filter(eid => eid !== id);
                    
                    // 3. Reverse happiness item
                    const mapping: Record<string, string> = {
                        'date': 'h_date',
                        'propose': 'h_proposal',
                        'wedding': 'h_wedding',
                        'child1': 'h_child1',
                        'child2': 'h_child2'
                    };
                    const targetId = mapping[id];
                    if (targetId) {
                        newState.happiness = newState.happiness.map(h => h.id === targetId ? { ...h, checked: false } : h);
                    } else {
                        // For custom items, we remove by name if it's a custom item
                        newState.happiness = newState.happiness.filter(h => !(h.label === data.happinessEventPayload.name && h.isCustom));
                    }
                }
                else if (data.usage === 'cash' && data.source === 'income') {
                    if (data.stockList && data.stockList.length > 0) {
                        const updatedAssets = [...newState.assets];
                        data.stockList.forEach((item: any) => {
                            const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && a.name.includes(item.symbol));
                            if (assetIdx !== -1) {
                                const asset = updatedAssets[assetIdx];
                                const newQty = (asset.quantity || 0) + item.qty;
                                updatedAssets[assetIdx] = { ...asset, quantity: newQty, cost: newQty * (asset.lastPurchasePrice || item.price) };
                            } else {
                                updatedAssets.push({ id: generateId(), name: `股票 ${item.symbol}`, cost: item.price * item.qty, downPayment: item.price * item.qty, cashflow: 0, type: '股票', quantity: item.qty, lastPurchasePrice: item.price });
                            }
                        });
                        newState.assets = updatedAssets;
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
                        newState.assets = newState.assets.map(a => a.type === '飛行器' ? { ...a, isInsured: false } : a);
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

                if (data.name.includes('達成事業成就')) {
                    newState.happiness = newState.happiness.map(h => h.id === 'h_career' ? { ...h, checked: false } : h);
                } else if (data.name.includes('實現人生夢想')) {
                    newState.happiness = newState.happiness.map(h => h.id === 'h_dream' ? { ...h, checked: false } : h);
                }
                newState.happinessTotal = newState.happiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);

            } catch (e) {
                console.error("Failed to parse transaction details for reversal", e);
            }

            return newState;
        });

        showAlert('刪除成功，財務報表已更新', 'success');
    };

    const handleTransactionSubmit = (data: TransactionData) => {
        const amount = Number(data.amount);
        if (isNaN(amount) || amount < 0) {
            showAlert('請輸入有效金額', 'error');
            return false;
        }

        const storageData: any = { ...data };

        // Pre-calculate success message
        let finalSuccessMessage = '交易已記錄';
        if (data.usage === 'asset') {
            if (data.stockList && data.stockList.length > 0) finalSuccessMessage = `成功購買股票 ${data.stockList.length} 筆`;
            else if (data.assetDetails) finalSuccessMessage = `成功購買 ${data.assetDetails.type} ${data.assetDetails.symbol || ''}`.trim();
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
        } else if (data.insuranceType) {
            finalSuccessMessage = '保險已生效';
        }

        setGameState(prev => {
            const newState = { ...prev };
            newState.cash += data.cashChange;

            if (data.usage === 'asset') {
                if (data.stockList && data.stockList.length > 0) {
                    const updatedAssets = [...newState.assets];
                    data.stockList.forEach(stock => {
                        const existingIdx = updatedAssets.findIndex(a => a.type === '股票' && a.name === `股票 ${stock.symbol}`);
                        if (existingIdx !== -1) {
                            const existing = updatedAssets[existingIdx];
                            const newQty = (existing.quantity || 0) + stock.qty;
                            updatedAssets[existingIdx] = { ...existing, quantity: newQty, lastPurchasePrice: stock.price, cost: newQty * stock.price };
                        } else {
                            updatedAssets.push({ id: generateId(), name: `股票 ${stock.symbol}`, cost: stock.price * stock.qty, downPayment: stock.price * stock.qty, cashflow: 0, type: '股票' as const, quantity: stock.qty, lastPurchasePrice: stock.price });
                        }
                    });
                    newState.assets = updatedAssets;
                } else if (data.assetDetails) {
                    const details = data.assetDetails;
                    const loanAmt = details.loanAmount || 0;
                    const totalCost = (details.downPayment || 0) + loanAmt;
                    
                    const newAsset: Asset = { 
                        id: generateId(), 
                        name: `${details.type} ${details.symbol || ''}`.trim(), 
                        cost: totalCost, 
                        downPayment: details.downPayment || 0, 
                        cashflow: details.cashflow || 0, 
                        type: details.type as any, 
                        isSelfUse: details.isSelfUse, 
                        houseType: details.houseType, 
                        isInsured: false 
                    };
                    newState.assets = [...newState.assets, newAsset];
                    if (loanAmt > 0) {
                        const loanTypeMap: Record<string, '不動產貸款' | '企業貸款' | '飛行器貸款'> = { '不動產': '不動產貸款', '企業': '企業貸款', '飛行器': '飛行器貸款' };
                        const loanType = loanTypeMap[details.type];
                        if (loanType) {
                            newState.liabilities = [...newState.liabilities, { id: generateId(), name: `${loanType} (${details.symbol || ''})`.trim(), totalOwed: loanAmt, monthlyPayment: details.loanInterest || 0, type: loanType }];
                        }
                    }
                }
            } else if (data.usage === 'liability' && data.liabilityId) {
                if (data.liabilityId === 'bank_loan') { 
                    newState.loans = Math.max(0, newState.loans - amount); 
                } else { 
                    newState.liabilities = newState.liabilities.map(l => { 
                        if (l.id === data.liabilityId) {
                            const newTotal = Math.max(0, l.totalOwed - amount);
                            // 同步更新月支付金額（利息），維持 0.5% 或 10% 的比例
                            const newMonthly = l.type === '信用貸款' ? Math.floor(newTotal * 0.1) : Math.floor(newTotal * 0.005);
                            return { ...l, totalOwed: newTotal, monthlyPayment: newMonthly }; 
                        }
                        return l; 
                    }); 
                    // 如果還清了，移除該負債
                    newState.liabilities = newState.liabilities.filter(l => l.totalOwed > 0);
                }
            } else if (data.source === 'loan' && data.usage === 'cash') {
                newState.liabilities = [...newState.liabilities, { id: generateId(), name: '信用貸款', totalOwed: amount, monthlyPayment: Math.floor(amount * 0.1), type: '信用貸款' }];
            } else if (data.usage === 'happiness_event' && data.happinessEventPayload) {
                const { id, name, points, monthlyExpenseChange } = data.happinessEventPayload;
                
                // Add to completed list
                newState.completedHappinessEvents = [...(newState.completedHappinessEvents || []), id];

                // Update existing happiness item if it exists
                const mapping: Record<string, string> = {
                    'date': 'h_date',
                    'propose': 'h_proposal',
                    'wedding': 'h_wedding',
                    'child1': 'h_child1',
                    'child2': 'h_child2'
                };
                const targetId = mapping[id];
                
                if (targetId && newState.happiness.some(h => h.id === targetId)) {
                    newState.happiness = newState.happiness.map(h => 
                        h.id === targetId ? { ...h, checked: true } : h
                    );
                } else {
                    // Fallback for custom or unexpected items
                    const newItem: HappinessItem = {
                        id: `h_event_${Date.now()}`,
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
                newState.expenses = { ...newState.expenses, [category]: isIncrease ? currentVal + expAmount : currentVal - expAmount };
            } else if (data.usage === 'cash' && data.source === 'income') {
                let updatedAssets = [...newState.assets];
                if (data.stockList && data.stockList.length > 0) {
                    data.stockList.forEach(item => {
                        const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && a.name.includes(item.symbol));
                        if (assetIdx >= 0) {
                            const asset = updatedAssets[assetIdx];
                            if (asset.quantity && asset.quantity >= item.qty) {
                                if (asset.quantity === item.qty) { updatedAssets.splice(assetIdx, 1); }
                                else { const remainingQty = asset.quantity - item.qty; updatedAssets[assetIdx] = { ...asset, quantity: remainingQty, lastPurchasePrice: item.price, cost: remainingQty * item.price }; }
                            }
                        }
                    });
                } else if (data.relatedAssetId) {
                    const assetToSell = updatedAssets.find(a => a.id === data.relatedAssetId);
                    if (assetToSell) {
                        if (assetToSell.type === '定存') {
                            // 定存解約：從所有定存項目中扣除金額
                            let remainingToWithdraw = amount;
                            updatedAssets = updatedAssets.reduce((acc: Asset[], asset) => {
                                if (asset.type === '定存' && remainingToWithdraw > 0) {
                                    if (asset.cost <= remainingToWithdraw) {
                                        remainingToWithdraw -= asset.cost;
                                        return acc;
                                    } else {
                                        const newCost = asset.cost - remainingToWithdraw;
                                        remainingToWithdraw = 0;
                                        acc.push({
                                            ...asset,
                                            cost: newCost,
                                            downPayment: newCost,
                                            cashflow: Math.floor(newCost * 0.005)
                                        });
                                        return acc;
                                    }
                                }
                                acc.push(asset);
                                return acc;
                            }, []);
                        } else {
                            storageData.relatedAssetPayload = assetToSell;
                            updatedAssets = updatedAssets.filter(a => a.id !== data.relatedAssetId);
                            
                            const assetSymbol = assetToSell.name.split(' ').slice(1).join(' ');
                            const loanType = assetToSell.type === '不動產' ? '不動產貸款' : assetToSell.type === '企業' ? '企業貸款' : assetToSell.type === '飛行器' ? '飛行器貸款' : null;
                            
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
                    newState.assets = newState.assets.map(a => a.type === '飛行器' ? { ...a, isInsured: true } : a);
                }
            }

            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: data.name,
                amount: amount,
                sourceLabel: data.source === 'income' ? '收入' : data.source === 'loan' ? '借貸' : data.usage === 'liability' ? '負債還款' : data.usage === 'asset' ? '資產交易' : '支出',
                usageLabel: data.usage === 'asset' ? '購買資產' : data.usage === 'liability' ? '償還負債' : '一般支出',
                cashChange: data.cashChange,
                balance: newState.cash,
                details: JSON.stringify(storageData)
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

            return newState;
        });

        showAlert(finalSuccessMessage, 'success');
        return true;
    };

    const handlePaydayConfirm = () => {
        const flow = summary.monthlyCashflow;
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
                balance: newState.cash
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
        showAlert(flow >= 0 ? '已領取月結餘' : '已支付月結餘', 'success');
    };

    const confirmMedicalClaim = () => {
        const claimAmount = (gameState.medicalInsuranceCount || 0) * 50000;
        if (claimAmount <= 0) {
            showAlert('沒有可用的醫療保險', 'error');
            return;
        }

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
                balance: newState.cash
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
        showAlert(`申請成功！獲得理賠 ${formatMoney(claimAmount)}`, 'success');
    };

    const confirmAircraftClaim = () => {
        const hasInsuredAircraft = gameState.assets.some(a => a.type === '飛行器' && a.isInsured);
        if (!hasInsuredAircraft) {
            showAlert('沒有已投保的飛行器', 'error');
            return;
        }

        const claimAmount = 400000; // 飛行器理賠為 500,000 H 的 80%

        setGameState(prev => {
            const newState = { ...prev, cash: prev.cash + claimAmount };
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: '飛行器保險理賠',
                amount: claimAmount,
                sourceLabel: '收入',
                usageLabel: '保險理賠',
                cashChange: claimAmount,
                balance: newState.cash
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

    const handlePromotionConfirm = (type: 'normal' | 'lifelong') => {
        const cost = type === 'normal' ? 1000 : 5000;
        if (gameState.cash < cost) {
            showAlert(`現金不足！報名費需 ${cost.toLocaleString()} H`, 'error');
            return false;
        }
        setGameState(prev => {
            const newState = { ...prev, cash: prev.cash - cost };
            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: `升等考試報名費 (${type === 'normal' ? '一般考試' : '終身學習'})`,
                amount: cost,
                sourceLabel: '支出',
                usageLabel: '教育進修',
                cashChange: -cost,
                balance: newState.cash
            };
            newState.history = [...newState.history, newTx];
            return newState;
        });
        return true;
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
                    diceRoll,
                    addedIncome,
                    description: `${symbol} 從兼職工作室升級為小型企業。利息全免，企業收入增加 ${formatMoney(addedIncome)}。`
                })
            };
            newState.history = [upgradeTx, ...newState.history];

            return newState;
        });
        showAlert('🎉 企業升級成功！', 'success');
    };

    const handleLifelongConfirm = (type: string, cost: number) => {
        if (gameState.cash < cost) {
            showAlert(`現金不足，需要 ${formatMoney(cost)}`, 'error');
            return false;
        }

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
                balance: newState.cash
            };

            newState.history = [...newState.history, newTx];
            return newState;
        });

        return true;
    };

    const applyLifelongResult = (type: string, success: boolean, showAlertMsg: boolean = true) => {
        if (!success) return;

        setGameState(prev => {
            const newState = { ...prev };
            const typeNames: Record<string, string> = {
                'enhance_profession': '增強職業能力',
                'stock_ability': '投資股票的能力',
                'real_estate_ability': '投資不動產的能力'
            };

            if (type === 'enhance_profession') {
                newState.abilities = { 
                    ...newState.abilities, 
                    professionAbilityCount: (newState.abilities?.professionAbilityCount || 0) + 1 
                };
                const currentLevel = prev.currentRankLevel;
                const nextPromo = prev.profession?.promotions[currentLevel - 1];
                if (nextPromo) {
                    newState.currentRankLevel = currentLevel + 1;
                    newState.currentRankTitle = nextPromo.rankTitle;
                    if (newState.profession) {
                        newState.profession = {
                            ...newState.profession,
                            salary: newState.profession.salary + nextPromo.bonus
                        };
                    }
                }
            } else if (type === 'stock_ability') {
                newState.abilities = { 
                    ...newState.abilities, 
                    stockAbilityCount: (newState.abilities?.stockAbilityCount || 0) + 1 
                };
                // 股票張數全部增加一倍
                newState.assets = newState.assets.map(asset => {
                    if (asset.type === '股票' && asset.quantity) {
                        const newQty = asset.quantity * 2;
                        return {
                            ...asset,
                            quantity: newQty,
                            cost: newQty * (asset.lastPurchasePrice || 0)
                        };
                    }
                    return asset;
                });
            } else if (type === 'real_estate_ability') {
                newState.abilities = { 
                    ...newState.abilities, 
                    realEstateAbilityCount: (newState.abilities?.realEstateAbilityCount || 0) + 1 
                };
                // 不再直接修改現有資產的 cashflow，改由 GameContext 裡的 summary 動態計算
            }

            const newTx: Transaction = {
                id: generateId(),
                timestamp: Date.now(),
                name: `終身學習成功：${typeNames[type] || type}`,
                amount: 0,
                sourceLabel: '事件',
                usageLabel: '能力獲得',
                cashChange: 0,
                balance: newState.cash
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
                balance: newState.cash
            };
            
            newState.history = [...newState.history, newTx];
            return newState;
        });
    };

    const handleFinishGame = (meta: { playerName: string }) => {
        const record: GameRecord = {
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            playerName: meta.playerName,
            profession: gameState.profession?.title || 'Unknown',
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
                history: gameState.history,
                happiness: gameState.happiness,
                cash: gameState.cash,
                loans: gameState.loans,
            }
        };
        setGameHistory(prev => [record, ...prev]);
        return record;
    };

    return {
        gameState,
        summary,
        scoreResult,
        alertInfo,
        showAlert,
        handleDeleteTransactionRecord,
        handleTransactionSubmit,
        handlePaydayConfirm,
        confirmMedicalClaim,
        confirmAircraftClaim,
        handleToggleHappiness,
        handleAddHappinessItem,
        handleRemoveHappinessItem,
        handlePromotionConfirm,
        handleBizUpgrade,
        handleLifelongConfirm,
        applyLifelongResult,
        applyExamResult,
        handleFinishGame,
        happinessSubMode,
        setHappinessSubMode
    };
};
