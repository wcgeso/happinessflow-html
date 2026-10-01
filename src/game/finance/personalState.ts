import type {Asset,GameState,Transaction,TransactionData} from '../../types';
import {cleanObject} from '../../utils/utils';
import {serverNow} from '../../utils/serverClock';
import {extractAssetSymbol,getStockAssetLabel} from '../../utils/assetLabels';
import {getLiabilityMonthlyPayment} from '../../utils/financialRules';

export const buildInsurancePurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    if (txData.usage !== 'insurance' || !txData.insuranceType || !txData.insurancePayload) {
        throw new Error('保險交易資料尚未準備完成');
    }

    let assets = [...(currentState.assets || [])];
    let medicalInsuranceCount = currentState.medicalInsuranceCount || 0;

    if (txData.insuranceType === 'medical') {
        const quantity = txData.insurancePayload.medicalQty || 0;
        if (quantity < 1 || medicalInsuranceCount >= 1) throw new Error('已持有醫療保險');
        medicalInsuranceCount += quantity;
    } else if (txData.insuranceType === 'house') {
        const targetAssetIds = txData.insurancePayload.targetAssetIds || [];
        if (targetAssetIds.length === 0) throw new Error('未選擇投保房屋');
        const targets = assets.filter(asset => targetAssetIds.includes(asset.id) && asset.type === '不動產');
        if (targets.length !== targetAssetIds.length || targets.some(asset => asset.isInsured)) {
            throw new Error('房屋保險狀態已更新，請重新選擇');
        }
        assets = assets.map(asset => targetAssetIds.includes(asset.id) ? { ...asset, isInsured: true } : asset);
    } else if (txData.insuranceType === 'aircraft') {
        const vehicles = assets.filter(asset => asset.type === '汽車' || asset.type === '飛行器');
        if (vehicles.length === 0 || vehicles.every(asset => asset.isInsured)) throw new Error('目前沒有可投保的汽車');
        assets = assets.map(asset => (asset.type === '汽車' || asset.type === '飛行器') ? { ...asset, isInsured: true } : asset);
    } else {
        throw new Error('不支援的保險類型');
    }

    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name,
        amount: Number(txData.amount) || 0,
        sourceLabel: '保險',
        usageLabel: '購買保險',
        cashChange: Number(txData.cashChange) || 0,
        balance: currentState.cash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '生活'
    };

    return cleanObject({
        ...currentState,
        assets,
        medicalInsuranceCount,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildDepositPurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const sourceAsset = txData.assetChange?.asset;
    const amount = Number(txData.amount || sourceAsset?.value || txData.assetDetails?.downPayment || 0);
    if (amount <= 0 || txData.cashChange >= 0) throw new Error('定存金額無效');
    if (currentState.cash + txData.cashChange < 0) throw new Error('現金不足，無法辦理定存');

    const deposit: Asset = {
        id: sourceAsset?.id || `${commandId}:asset`,
        name: '定存',
        cost: amount,
        downPayment: amount,
        cashflow: Math.floor(amount * 0.01),
        type: '定存'
    };
    const nextCash = currentState.cash + txData.cashChange;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || `定存 ${amount.toLocaleString()}`,
        amount,
        sourceLabel: '現金',
        usageLabel: '辦理定存',
        cashChange: txData.cashChange,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), deposit],
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildStockTradeState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    if (!txData.stockList?.length || (txData.usage !== 'asset' && txData.usage !== 'cash')) {
        throw new Error('股票交易資料尚未準備完成');
    }

    const isBuy = txData.usage === 'asset';
    const assets = [...(currentState.assets || [])];
    for (const trade of txData.stockList) {
        const index = assets.findIndex(asset => asset.type === '股票' && extractAssetSymbol(asset.name) === trade.symbol);
        const existing = index >= 0 ? assets[index] : null;
        const existingQuantity = existing?.quantity || existing?.shares || 0;
        if (isBuy) {
            const quantity = existingQuantity + trade.qty;
            const nextAsset: Asset = existing
                ? { ...existing, quantity, shares: quantity, lastPurchasePrice: trade.price, cost: quantity * trade.price }
                : {
                    id: `${commandId}:${trade.symbol}`,
                    name: getStockAssetLabel(trade.symbol),
                    cost: trade.price * trade.qty,
                    downPayment: trade.price * trade.qty,
                    cashflow: 0,
                    type: '股票',
                    quantity: trade.qty,
                    shares: trade.qty,
                    lastPurchasePrice: trade.price
                };
            if (existing) assets[index] = nextAsset;
            else assets.push(nextAsset);
        } else {
            if (!existing || existingQuantity < trade.qty) throw new Error(`${trade.symbol} 持有張數不足`);
            const remaining = existingQuantity - trade.qty;
            if (remaining === 0) assets.splice(index, 1);
            else assets[index] = { ...existing, quantity: remaining, shares: remaining, cost: remaining * trade.price, lastPurchasePrice: trade.price };
        }
    }

    const nextCash = currentState.cash + txData.cashChange;
    if (nextCash < 0) throw new Error('現金不足，無法買入股票');
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name,
        amount: Number(txData.amount) || 0,
        sourceLabel: isBuy ? '現金' : '投資回收',
        usageLabel: isBuy ? '買入股票' : '賣出股票',
        cashChange: txData.cashChange,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildLoanBorrowState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const amount = Number(txData.amount) || 0;
    if (txData.usage !== 'loan' || txData.source !== 'cash' || amount <= 0 || txData.cashChange !== amount) {
        throw new Error('信用貸款資料尚未準備完成');
    }

    const nextCash = currentState.cash + amount;
    const liability = {
        id: commandId,
        name: '信用貸款',
        totalOwed: amount,
        monthlyPayment: Math.floor(amount * 0.1),
        type: '信用貸款' as const
    };
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || '申請信用貸款',
        amount,
        sourceLabel: '借貸',
        usageLabel: '信用貸款',
        cashChange: amount,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '融資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        liabilities: [...(currentState.liabilities || []), liability],
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildLoanRepaymentState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const amount = Number(txData.amount) || 0;
    if (txData.usage !== 'liability' || txData.source !== 'cash' || amount <= 0 || txData.cashChange !== -amount) {
        throw new Error('還款資料尚未準備完成');
    }
    if (currentState.cash < amount) throw new Error('現金不足，無法完成還款');

    let liabilities = [...(currentState.liabilities || [])];
    let legacyLoans = currentState.loans || 0;
    if (txData.liabilityId === 'multiple_credit_loans') {
        let remaining = amount;
        liabilities = liabilities.map(liability => {
            if (liability.type !== '信用貸款' || remaining <= 0) return liability;
            const paid = Math.min(liability.totalOwed, remaining);
            remaining -= paid;
            const totalOwed = liability.totalOwed - paid;
            return { ...liability, totalOwed, monthlyPayment: Math.floor(totalOwed * 0.1) };
        }).filter(liability => liability.totalOwed > 0);
        if (remaining > 0) {
            const paid = Math.min(legacyLoans, remaining);
            legacyLoans -= paid;
            remaining -= paid;
        }
        if (remaining > 0) throw new Error('目前沒有足夠的信用貸款可償還');
    } else if (txData.liabilityId === 'bank_loan') {
        if (amount > legacyLoans) throw new Error('還款金額不可超過信用貸款總額');
        legacyLoans -= amount;
    } else {
        const index = liabilities.findIndex(liability => liability.id === txData.liabilityId);
        if (index < 0) throw new Error('找不到要償還的貸款資料');
        const target = liabilities[index];
        if (amount > target.totalOwed) throw new Error(`還款金額不可超過 ${target.name} 的剩餘金額`);
        const totalOwed = target.totalOwed - amount;
        if (totalOwed === 0) liabilities.splice(index, 1);
        else liabilities[index] = { ...target, totalOwed, monthlyPayment: getLiabilityMonthlyPayment(target.type, totalOwed) };
    }

    const nextCash = currentState.cash - amount;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || '償還貸款',
        amount,
        sourceLabel: '現金',
        usageLabel: '償還貸款',
        cashChange: -amount,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '融資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        liabilities,
        loans: legacyLoans,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildDepositWithdrawalState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const amount = Number(txData.amount) || 0;
    if (txData.usage !== 'cash' || txData.source !== 'income' || !txData.relatedAssetId || amount <= 0) {
        throw new Error('定存解約資料尚未準備完成');
    }
    const target = currentState.assets.find(asset => asset.id === txData.relatedAssetId && asset.type === '定存');
    const balance = target?.cost || target?.value || 0;
    if (!target || amount > balance) throw new Error('解約金額不可超過定存餘額');

    const remaining = balance - amount;
    const assets = currentState.assets.reduce<Asset[]>((result, asset) => {
        if (asset.id !== txData.relatedAssetId) {
            result.push(asset);
        } else if (remaining > 0) {
            result.push({ ...asset, cost: remaining, downPayment: remaining, cashflow: Math.floor(remaining * 0.01) });
        }
        return result;
    }, []);
    const nextCash = currentState.cash + amount;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || `解約定存 ${amount.toLocaleString()}`,
        amount,
        sourceLabel: '投資回收',
        usageLabel: '解約定存',
        cashChange: amount,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const buildCarPurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;
    const details = txData.assetDetails;
    const price = Number(txData.amount) || 0;
    if (txData.usage !== 'asset' || details?.type !== '汽車' || price <= 0) throw new Error('汽車交易資料尚未準備完成');
    if (currentState.assets.some(asset => asset.type === '汽車' || asset.type === '飛行器')) throw new Error('目前已經擁有汽車');
    if (currentState.cash + txData.cashChange < 0) throw new Error('現金不足，無法購買汽車');

    const assetId = `${commandId}:asset`;
    const car: Asset = {
        id: assetId,
        name: '汽車',
        cost: price,
        downPayment: details.downPayment || 0,
        cashflow: details.cashflow || 0,
        type: '汽車',
        isInsured: false
    };
    const loanAmount = details.loanAmount || 0;
    const liabilities = loanAmount > 0
        ? [...(currentState.liabilities || []), {
            id: `${commandId}:loan`,
            name: '汽車貸款',
            totalOwed: loanAmount,
            monthlyPayment: details.loanInterest || 0,
            type: '汽車貸款' as const,
            linkedAssetId: assetId
        }]
        : currentState.liabilities;
    const nextCash = currentState.cash + txData.cashChange;
    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name || '買入汽車',
        amount: price,
        sourceLabel: loanAmount > 0 ? '貸款' : '現金',
        usageLabel: '購買汽車',
        cashChange: txData.cashChange,
        balance: nextCash,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '投資'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), car],
        liabilities,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

