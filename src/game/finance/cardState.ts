import {buildLoanBorrowState} from './personalState';
import {resolveBoardCardAction,isBoardPromptForCurrentEvent} from '../../utils/boardCardActions';
import type {BoardFinancialMutationResult,Asset,GameState,Transaction,TransactionData,BoardState} from '../../types';
import {cleanObject} from '../../utils/utils';
import {serverNow} from '../../utils/serverClock';
import {NEWS_CARD_MAP,OPPORTUNITY_CARDS,HAPPINESS_CARD_MAP} from '../../constants/cards';
import {extractAssetSymbol,getBusinessAssetLabel,getRealEstateAssetLabel,getStockAssetLabel} from '../../utils/assetLabels';
import {getLiabilityMonthlyPayment,getRemainingCreditCapacity} from '../../utils/financialRules';
import {STOCK_SYMBOLS} from '../../constants';
export const buildLifelongLearningSuccessState = (
    currentState: GameState,
    learningType: 'enhance_profession' | 'stock_ability' | 'real_estate_ability',
    commandId: string,
    now = serverNow()
): GameState => {
    const currentAssets = Array.isArray(currentState.assets) ? currentState.assets : [];
    const currentAbilities = {
        stockAbilityCount: 0,
        realEstateAbilityCount: 0,
        professionAbilityCount: 0,
        ...(currentState.abilities || {})
    };
    const nextState: GameState = {
        ...currentState,
        abilities: currentAbilities,
        assets: [...currentAssets],
        profession: currentState.profession ? { ...currentState.profession } : currentState.profession
    };
    if (learningType === 'enhance_profession') {
        nextState.abilities.professionAbilityCount = (nextState.abilities.professionAbilityCount || 0) + 1;
        const currentPromo = currentState.profession?.promotions?.[(currentState.currentRankLevel || 1) - 1];
        if (currentPromo && nextState.profession) {
            nextState.currentRankLevel = (currentState.currentRankLevel || 1) + 1;
            nextState.currentRankTitle = currentPromo.rankTitle;
            nextState.profession.salary += currentPromo.bonus;
        }
    } else if (learningType === 'stock_ability') {
        nextState.abilities.stockAbilityCount = (nextState.abilities.stockAbilityCount || 0) + 1;
        nextState.assets = nextState.assets.map(asset => {
            if (asset.type !== '股票' || !asset.quantity) return asset;
            const quantity = asset.quantity * 2;
            return { ...asset, quantity, cost: quantity * (asset.lastPurchasePrice || 0) };
        });
    } else {
        nextState.abilities.realEstateAbilityCount = (nextState.abilities.realEstateAbilityCount || 0) + 1;
    }

    const typeNames = {
        enhance_profession: '增強職業能力',
        stock_ability: '投資股票的能力',
        real_estate_ability: '投資不動產的能力'
    };
    const entry: Transaction = {
        id: commandId,
        timestamp: now,
        name: `終身學習成功：${typeNames[learningType]}`,
        amount: 0,
        sourceLabel: '事件',
        usageLabel: '能力獲得',
        cashChange: 0,
        balance: nextState.cash,
        details: JSON.stringify({
            type: 'lifelong_success',
            learningType,
            oldAbilities: currentAbilities,
            newAbilities: nextState.abilities,
            oldTitle: currentState.currentRankTitle,
            oldRankLevel: currentState.currentRankLevel,
            newRankLevel: nextState.currentRankLevel,
            oldSalary: currentState.profession?.salary || 0,
            newSalary: nextState.profession?.salary || 0,
            oldAssets: currentAssets
        }),
        flowType: '其它'
    };
    return cleanObject({ ...nextState, history: [entry, ...(currentState.history || [])] }) as GameState;
};

export const hasSchoolPromotionFee = (state: GameState, eventId: string) =>
    (state.history || []).some(transaction => {
        if (transaction.name !== '升等考試報名費') return false;
        if (transaction.id === `school-fee:${eventId}` || transaction.boardEventId === eventId) return true;
        try {
            const details = transaction.details ? JSON.parse(transaction.details) : null;
            return details?.boardEventId === eventId;
        } catch {
            return false;
        }
    });

export const buildSchoolPromotionState = (
    currentState: GameState,
    success: boolean,
    commandId: string,
    now = serverNow()
): { state: GameState; bonus: number; newTitle: string } => {
    if (!currentState.profession) throw new Error('玩家職業資料尚未同步完成，請重新整理後再試');

    const level = Math.max(1, currentState.currentRankLevel || 1);
    const currentPromo = currentState.profession.promotions?.[level - 1];
    if (!currentPromo) throw new Error('已達最高職業等級，無法再升等');

    const bonus = success ? currentPromo.bonus : 0;
    const nextProfession = success
        ? { ...currentState.profession, salary: currentState.profession.salary + bonus }
        : currentState.profession;
    const nextRankLevel = success ? level + 1 : level;
    const nextTitle = success ? currentPromo.rankTitle : currentState.currentRankTitle;
    const entry: Transaction = {
        id: commandId,
        timestamp: now,
        name: success ? '晉升加薪' : '升等考試未通過',
        amount: bonus,
        sourceLabel: success ? '收入' : '事件',
        usageLabel: success ? '工作收入增加' : '考試結果',
        cashChange: 0,
        balance: currentState.cash,
        details: JSON.stringify({
            type: 'exam_promotion',
            success,
            bonus,
            oldTitle: currentState.currentRankTitle,
            newTitle: nextTitle,
            oldSalary: currentState.profession.salary,
            newSalary: nextProfession.salary,
            oldRankLevel: level,
            newRankLevel: nextRankLevel
        }),
        flowType: '其它'
    };

    return {
        state: cleanObject({
            ...currentState,
            profession: nextProfession,
            currentRankLevel: nextRankLevel,
            currentRankTitle: nextTitle,
            history: [entry, ...(currentState.history || [])]
        }) as GameState,
        bonus,
        newTitle: nextTitle
    };
};


export const buildDirectHappinessCardState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    const payload = txData.happinessEventPayload;
    if (!payload) throw new Error('幸福卡結果資料尚未準備完成');
    if ((currentState.appliedBoardFinancialEventIds || []).includes(commandId)) return currentState;

    const completedHappinessEvents = Array.from(new Set([
        ...(currentState.completedHappinessEvents || []),
        payload.id,
        ...(payload.progressId ? [payload.progressId] : []),
        ...(payload.sourceCardId ? [payload.sourceCardId] : [])
    ]));
    const happiness = [...(currentState.happiness || [])];
    const happinessItemId = payload.happinessItemId;
    const existingItemIndex = happinessItemId
        ? happiness.findIndex(item => item.id === happinessItemId)
        : -1;

    if (existingItemIndex >= 0) {
        happiness[existingItemIndex] = { ...happiness[existingItemIndex], checked: true };
    } else {
        happiness.push({
            id: `${commandId}:happiness`,
            label: payload.name,
            points: payload.points,
            checked: true,
            isCustom: true
        });
    }

    const category = payload.expenseCategory === 'basicLiving' || payload.expenseCategory === 'transportEdu' || payload.expenseCategory === 'otherMedicalChild'
        ? payload.expenseCategory
        : null;
    const nextCash = currentState.cash + (Number(txData.cashChange) || 0);
    const nextExpenses = category && payload.monthlyExpenseChange
        ? { ...currentState.expenses, [category]: (currentState.expenses[category] || 0) + payload.monthlyExpenseChange }
        : currentState.expenses;

    const transactionRecord: Transaction = {
        id: commandId,
        timestamp: now,
        name: txData.name,
        amount: Number(txData.amount) || 0,
        sourceLabel: '幸福卡',
        usageLabel: '幸福事件',
        cashChange: Number(txData.cashChange) || 0,
        balance: nextCash,
        boardEventId: commandId,
        details: JSON.stringify({ ...txData, boardEventId: commandId }),
        flowType: '生活'
    };

    return cleanObject({
        ...currentState,
        cash: nextCash,
        expenses: nextExpenses,
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        completedHappinessEvents,
        appliedBoardFinancialEventIds: [
            ...(currentState.appliedBoardFinancialEventIds || []),
            commandId
        ],
        history: [transactionRecord, ...(currentState.history || [])]
    }) as GameState;
};

export const addRealEstateCardToMarket = (market: string[], cardId: string) =>
    Array.from(new Set([...market, cardId]));

export const isCurrentRealEstatePurchase = (cardId: string, txData: TransactionData) => {
    const card = NEWS_CARD_MAP[cardId];
    const details = txData.assetDetails;
    if (!card || card.type !== 'real_estate' || !details || details.type !== '不動產') return false;

    const isSelfUse = details.isSelfUse === true;
    return txData.source === 'loan' &&
        txData.usage === 'asset' &&
        txData.amount === card.totalPrice &&
        txData.cashChange === -card.downPayment &&
        details.symbol === card.id &&
        details.houseType === card.houseType &&
        details.downPayment === card.downPayment &&
        details.loanAmount === card.loanAmount &&
        details.loanInterest === card.monthlyPayment &&
        details.cashflow === (isSelfUse ? 0 : card.rent) &&
        details.happyPoints === (isSelfUse ? card.happinessBonus : 0) &&
        (card.canSelfUse || !isSelfUse);
};

export const buildRealEstatePurchaseState = (
    currentState: GameState,
    txData: TransactionData,
    commandId: string,
    now = serverNow()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;
    const details = txData.assetDetails;
    if (!details || details.type !== '不動產') throw new Error('不動產購買資料尚未準備完成');
    if (txData.forcedDebtAmount) throw new Error('購買不動產不能強制計入負債，請先完成周轉');
    const funding=Number(txData.fundingLoanAmount || 0);
    if (!Number.isInteger(funding) || funding<0) throw new Error('不動產周轉金額無效');
    if (funding>0) {
        const shortfall=Math.max(0,-(currentState.cash+txData.cashChange));
        if (funding!==shortfall || funding>getRemainingCreditCapacity(currentState.profession?.salary || 0,currentState.liabilities,currentState.loans)) throw new Error('周轉金額不符或超過信貸上限');
        currentState=buildLoanBorrowState(currentState,{name:`借用信用貸款：${txData.name}`,amount:funding,cashChange:funding,usage:'loan',source:'cash'} as TransactionData,`${commandId}:funding`,now);
    }
    if ((Number(currentState.cash) || 0) + txData.cashChange < 0) throw new Error('現金不足，無法購買此房屋');

    const assetId = `${commandId}:asset`;
    const asset = {
        id: assetId,
        name: getRealEstateAssetLabel(details.symbol, details.houseType),
        cost: txData.amount,
        downPayment: details.downPayment || 0,
        cashflow: details.cashflow || 0,
        type: '不動產' as const,
        isSelfUse: details.isSelfUse,
        houseType: details.houseType,
        isInsured: false
    };
    const liability = details.loanAmount && details.loanAmount > 0 ? {
        id: `${assetId}:loan`,
        name: `不動產貸款 (${details.symbol || ''})`.trim(),
        totalOwed: details.loanAmount,
        monthlyPayment: details.loanInterest || 0,
        type: '不動產貸款' as const,
        linkedAssetId: assetId
    } : null;
    let happiness = currentState.happiness || [];
    if (details.isSelfUse && details.happyPoints && details.happyPoints > 0) {
        const happinessId = details.houseType === '1room' ? 'h_house_1'
            : details.houseType === '2room' ? 'h_house_2'
                : details.houseType === '3room' ? 'h_house_3'
                    : details.houseType === '5room' ? 'h_house_5' : null;
        if (happinessId) happiness = happiness.map(item => item.id === happinessId ? { ...item, checked: true } : item);
    }
    const nextCash = (Number(currentState.cash) || 0) + txData.cashChange;
    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), asset],
        liabilities: liability ? [...(currentState.liabilities || []), liability] : (currentState.liabilities || []),
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [...(currentState.history || []), {
            id: commandId,
            timestamp: now,
            name: txData.name,
            amount: txData.amount,
            sourceLabel: '貸款',
            usageLabel: '不動產',
            cashChange: txData.cashChange,
            balance: nextCash,
            details: JSON.stringify({ ...txData, boardEventId: commandId, createdAssetId: assetId }),
            flowType: '投資'
        } satisfies Transaction]
}) as GameState;
};

export const buildStartupLoanState = (
    currentState: GameState,
    cardId: string,
    commandId: string,
    now = serverNow()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;

    const card = NEWS_CARD_MAP[cardId];
    if (!card || card.type !== 'small_business') throw new Error('創業貸款卡片資料不存在');

    const assetId = `${commandId}:asset`;
    const nextCash = (Number(currentState.cash) || 0) + card.loanAmount - card.investmentPerMonth;
    const asset = {
        id: assetId,
        name: getBusinessAssetLabel(card.id, '兼職工作室'),
        cost: card.investmentPerMonth,
        downPayment: card.investmentPerMonth,
        cashflow: 0,
        type: '企業' as const,
        isInsured: false
    };
    const liability = {
        id: `${assetId}:loan`,
        name: `企業貸款 (${card.id})`,
        totalOwed: card.loanAmount,
        monthlyPayment: card.interestPerMonth,
        type: '企業貸款' as const,
        linkedAssetId: assetId
    };
    const pendingUpgradeQueue = [
        ...(currentState.pendingStartupUpgradeActions || (currentState.pendingStartupUpgradeAction ? [currentState.pendingStartupUpgradeAction] : [])),
        { cardId: card.id, symbol: card.id, assetId }
    ];

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: [...(currentState.assets || []), asset],
        liabilities: [...(currentState.liabilities || []), liability],
        pendingStartupUpgradeAction: pendingUpgradeQueue[0],
        pendingStartupUpgradeActions: pendingUpgradeQueue,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [...(currentState.history || []), {
            id: commandId,
            timestamp: now,
            name: `新聞卡：${card.title}`,
            amount: card.investmentPerMonth,
            sourceLabel: '借貸',
            usageLabel: '買入資產',
            cashChange: card.loanAmount - card.investmentPerMonth,
            balance: nextCash,
            details: JSON.stringify({
                boardEventId: commandId,
                sourceCardId: card.id,
                loanAmount: card.loanAmount,
                investmentPerMonth: card.investmentPerMonth,
                interestPerMonth: card.interestPerMonth,
                createdAssetId: assetId
            }),
            flowType: '投資'
        } satisfies Transaction]
    }) as GameState;
};

export const getPendingStartupUpgradeActions = (currentState: GameState) => {
    const eligibleAssets = currentState.assets.filter(asset => asset.type === '企業' && !asset.isUpgraded);
    const hasLoan = (assetId: string, cardId: string) => currentState.liabilities.some(liability =>
        liability.type === '企業貸款' &&
        (liability.linkedAssetId === assetId || liability.name.includes(cardId))
    );
    const stored = currentState.pendingStartupUpgradeActions?.length
        ? currentState.pendingStartupUpgradeActions
        : currentState.pendingStartupUpgradeAction
            ? [currentState.pendingStartupUpgradeAction]
            : [];
    const claimed = new Set<string>();
    const queue = stored.flatMap(action => {
        const asset = eligibleAssets.find(item =>
            !claimed.has(item.id) &&
            ((action.assetId && item.id === action.assetId) || item.name.includes(action.symbol || action.cardId))
        );
        if (!asset) return [];
        claimed.add(asset.id);
        return [{ ...action, assetId: asset.id }];
    });

    eligibleAssets.forEach(asset => {
        if (claimed.has(asset.id)) return;
        const cardId = asset.name.match(/N05[6-8]/)?.[0];
        if (!cardId || !hasLoan(asset.id, cardId)) return;
        claimed.add(asset.id);
        queue.push({ cardId, symbol: cardId, assetId: asset.id });
    });

    return queue;
};

export const resolveStartupUpgradeTarget = (
    currentState: GameState,
    payload: { assetId: string; cardId: string }
) => {
    const storedQueue = currentState.pendingStartupUpgradeActions?.length
        ? currentState.pendingStartupUpgradeActions
        : currentState.pendingStartupUpgradeAction
            ? [currentState.pendingStartupUpgradeAction]
            : [];
    const pendingQueue = getPendingStartupUpgradeActions(currentState);
    const pendingIndex = pendingQueue.findIndex(action => action.assetId === payload.assetId);
    const fallbackIndex = pendingIndex >= 0
        ? pendingIndex
        : pendingQueue.findIndex(action => action.cardId === payload.cardId);
    const storedPending = pendingQueue[fallbackIndex];
    if (storedPending && storedPending.cardId !== payload.cardId) return null;

    const card = NEWS_CARD_MAP[payload.cardId];
    const pending = storedPending || (card?.type === 'small_business'
        ? { cardId: card.id, symbol: card.id }
        : null);
    if (!pending) return null;

    const matches = (asset: GameState['assets'][number]) => asset.type === '企業' &&
        !asset.isUpgraded &&
        (!pending.symbol || asset.name.includes(pending.symbol));
    const authoritativeAssetId = storedPending?.assetId || payload.assetId;
    const preferredAssetIndex = currentState.assets.findIndex(asset => asset.id === authoritativeAssetId && matches(asset));
    // 舊版本或跨裝置恢復可能保留已失效的 assetId；卡片代號仍是可驗證的
    // 權威線索，允許在同一筆未升級工作室中恢復，避免銀行流程永久卡住。
    const assetIndex = preferredAssetIndex >= 0
        ? preferredAssetIndex
        : currentState.assets.findIndex(matches);
    if (assetIndex < 0) return null;

    const asset = currentState.assets[assetIndex];
    if (!storedPending && !currentState.liabilities.some(liability =>
        liability.type === '企業貸款' &&
        (liability.linkedAssetId === asset.id || liability.name.includes(payload.cardId))
    )) return null;

    const resolvedPending = { ...pending, assetId: ('assetId' in pending && pending.assetId) || asset.id };
    const wasStored = storedQueue.some(action => action.assetId === resolvedPending.assetId);
    return { pending: resolvedPending, asset, assetIndex, pendingIndex: Math.max(0, fallbackIndex), recovered: !wasStored };
};

export const buildStartupUpgradeState = (
    currentState: GameState,
    payload: { assetId: string; cardId: string; diceRoll: number },
    commandId: string,
    now = serverNow()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;

    const target = resolveStartupUpgradeTarget(currentState, payload);
    if (!target) throw new Error('企業升級等待狀態已更新');
    const { pending, assetIndex, pendingIndex } = target;
    if (!Number.isInteger(payload.diceRoll) || payload.diceRoll < 1 || payload.diceRoll > 6) {
        throw new Error('企業升級骰點無效');
    }

    const asset = currentState.assets[assetIndex];

    const symbol = asset.name.match(/[A-Z]\d+/)?.[0] || payload.cardId;
    const addedIncome = payload.diceRoll * 10000;
    const upgradedAsset = {
        ...asset,
        name: `小型企業 (${symbol})`,
        cashflow: (asset.cashflow || 0) + addedIncome,
        isUpgraded: true
    };
    const linkedLiability = currentState.liabilities.find(liability =>
        liability.linkedAssetId === asset.id || liability.name === `企業貸款 (${symbol})`
    );
    const nextAssets = [...currentState.assets];
    nextAssets[assetIndex] = upgradedAsset;

    const pendingUpgradeQueue = getPendingStartupUpgradeActions(currentState)
        .filter((_, index) => index !== pendingIndex);

    return cleanObject({
        ...currentState,
        assets: nextAssets,
        liabilities: currentState.liabilities.filter(liability => liability !== linkedLiability),
        pendingStartupUpgradeAction: pendingUpgradeQueue[0],
        pendingStartupUpgradeActions: pendingUpgradeQueue.length > 0 ? pendingUpgradeQueue : undefined,
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [{
            id: commandId,
            timestamp: now,
            name: `📈 企業升級：${symbol}`,
            amount: 0,
            sourceLabel: '企業事件',
            usageLabel: '資產升級',
            cashChange: 0,
            balance: currentState.cash,
            details: JSON.stringify({
                type: 'biz_upgrade',
                assetId: asset.id,
                cardId: payload.cardId,
                symbol,
                diceRoll: payload.diceRoll,
                addedIncome,
                oldCashflow: asset.cashflow,
                removedLiability: linkedLiability || null
            }),
            flowType: '投資'
        } satisfies Transaction, ...(currentState.history || [])]
}) as GameState;
};

export const buildTargetEnterprisePurchaseState = (
    currentState: GameState,
    data: TransactionData,
    commandId: string,
    now = serverNow()
): { status: BoardFinancialMutationResult['status']; state?: GameState; shortfall?: number; message?: string } => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return { status: 'duplicate', state: currentState };
    const enterprise = currentState.selectedEnterprise;
    if (!enterprise || data.usage !== 'asset' || data.assetDetails?.type !== '企業' || data.amount !== enterprise.cost || data.cashChange !== -enterprise.cost) {
        return { status: 'failed', message: '目標企業資料已更新，請重新開啟購買視窗' };
    }
    if (currentState.happiness.some(item => item.id === 'h_career' && item.checked)) {
        return { status: 'duplicate', state: currentState };
    }

    const forcedDebtAmount = Number(data.forcedDebtAmount || 0);
    const fundingLoanAmount = Number(data.fundingLoanAmount || 0);
    if (!Number.isInteger(forcedDebtAmount) || forcedDebtAmount < 0 || !Number.isInteger(fundingLoanAmount) || fundingLoanAmount < 0 || (forcedDebtAmount > 0 && fundingLoanAmount > 0)) {
        return { status: 'failed', message: '周轉金額無效，請重新操作' };
    }
    if (fundingLoanAmount > getRemainingCreditCapacity(currentState.profession?.salary || 0, currentState.liabilities, currentState.loans)) {
        return { status: 'failed', message: '信貸額度不足，請改用其他周轉方式' };
    }
    const nextCash = currentState.cash - enterprise.cost + forcedDebtAmount + fundingLoanAmount;
    if (nextCash < 0) return { status: 'requires_funding', shortfall: Math.abs(nextCash) };

    const assetId = `${commandId}:asset`;
    const bonusPercent = currentState.profession?.id === enterprise.relatedProfessionId
        ? currentState.currentRankLevel * 10
        : 0;
    const cashflow = enterprise.income + Math.floor(enterprise.income * bonusPercent / 100);
    const fundingId = `${commandId}:funding`;
    const liabilities = [...currentState.liabilities];
    const history = [...currentState.history];
    if (forcedDebtAmount > 0 || fundingLoanAmount > 0) {
        const amount = forcedDebtAmount || fundingLoanAmount;
        const isCredit = fundingLoanAmount > 0;
        liabilities.push({
            id: fundingId,
            name: isCredit ? '信用貸款' : '強制負債',
            totalOwed: amount,
            monthlyPayment: isCredit ? Math.floor(amount * 0.1) : 0,
            type: isCredit ? '信用貸款' : '強制負債'
        });
        history.push({
            id: fundingId,
            timestamp: now,
            name: `${isCredit ? '借用信用貸款' : '強制計入負債'}：${data.name}`,
            amount,
            sourceLabel: '借貸',
            usageLabel: isCredit ? '信用貸款' : '強制負債',
            cashChange: amount,
            balance: currentState.cash + amount,
            details: JSON.stringify({ boardEventId: commandId }),
            flowType: '融資'
        });
    }
    history.push({
        id: commandId,
        timestamp: now,
        name: data.name,
        amount: enterprise.cost,
        sourceLabel: '資產交易',
        usageLabel: '買入資產',
        cashChange: -enterprise.cost,
        balance: nextCash,
        details: JSON.stringify({ ...data, createdAssetId: assetId }),
        flowType: '投資'
    });
    const happiness = currentState.happiness.map(item => item.id === 'h_career' ? { ...item, checked: true } : item);
    const { [enterprise.name]: _legacyDuplicateIncome, ...income } = currentState.income;

    return {
        status: 'applied',
        state: cleanObject({
            ...currentState,
            cash: nextCash,
            assets: [...currentState.assets, {
                id: assetId,
                name: getBusinessAssetLabel(enterprise.name, enterprise.name),
                cost: enterprise.cost,
                downPayment: enterprise.cost,
                cashflow,
                type: '企業',
                isInsured: false
            }],
            liabilities,
            income,
            happiness,
            happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
            history,
            appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId]
        }) as GameState
    };
};

export const buildSharedInvestmentState = (
    currentState: GameState,
    cardId: string,
    amount: number,
    commandId: string,
    funding: Pick<TransactionData, 'forcedDebtAmount' | 'fundingLoanAmount'> = {},
    now = serverNow()
): BoardFinancialMutationResult & { state?: GameState } => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return { status: 'duplicate', state: currentState };
    const card = NEWS_CARD_MAP[cardId];
    if (!card || card.type !== 'large_enterprise' || !Number.isInteger(amount) || amount < 1000000 ||
        amount % 1000000 !== 0 || amount > card.maxInvestment) {
        return { status: 'failed', message: '共享投資金額或卡片已更新，請重新選擇' };
    }
    const forcedDebtAmount = Number(funding.forcedDebtAmount || 0);
    const fundingLoanAmount = Number(funding.fundingLoanAmount || 0);
    if (!Number.isInteger(forcedDebtAmount) || forcedDebtAmount < 0 || !Number.isInteger(fundingLoanAmount) || fundingLoanAmount < 0 ||
        (forcedDebtAmount > 0 && fundingLoanAmount > 0)) {
        return { status: 'failed', message: '周轉金額無效，請重新操作' };
    }
    if (fundingLoanAmount > getRemainingCreditCapacity(currentState.profession?.salary || 0, currentState.liabilities, currentState.loans)) {
        return { status: 'failed', message: '信貸額度不足，請改用其他周轉方式' };
    }
    const fundingAmount = forcedDebtAmount || fundingLoanAmount;
    const nextCash = (Number(currentState.cash) || 0) + fundingAmount - amount;
    if (nextCash < 0) return { status: 'requires_funding', shortfall: -nextCash };

    const assetId = `${commandId}:asset`;
    const fundingId = `${commandId}:funding`;
    const history = [...(currentState.history || [])];
    const liabilities = [...(currentState.liabilities || [])];
    if (fundingAmount > 0) {
        const isCredit = fundingLoanAmount > 0;
        liabilities.push({
            id: fundingId,
            name: isCredit ? '信用貸款' : '強制負債',
            totalOwed: fundingAmount,
            monthlyPayment: isCredit ? Math.floor(fundingAmount * 0.1) : 0,
            type: isCredit ? '信用貸款' : '強制負債'
        });
        history.push({
            id: fundingId, timestamp: now,
            name: `${isCredit ? '借用信用貸款' : '強制計入負債'}：新聞卡：${card.title}`,
            amount: fundingAmount, sourceLabel: '借貸', usageLabel: isCredit ? '信用貸款' : '強制負債',
            cashChange: fundingAmount, balance: (Number(currentState.cash) || 0) + fundingAmount,
            details: JSON.stringify({ boardEventId: commandId }), flowType: '融資'
        });
    }
    history.push({
        id: commandId, timestamp: now, name: `新聞卡：${card.title}`,
        amount, sourceLabel: '資產交易', usageLabel: '買入資產', cashChange: -amount, balance: nextCash,
        details: JSON.stringify({ boardEventId: commandId, sourceCardId: card.id, createdAssetId: assetId }), flowType: '投資'
    });
    return {
        status: 'applied',
        state: cleanObject({
            ...currentState,
            cash: nextCash,
            assets: [...(currentState.assets || []), {
                id: assetId, name: getBusinessAssetLabel(card.id, card.businessName),
                cost: amount, downPayment: amount, cashflow: (amount / 1000000) * card.monthlyReturnPerMillion,
                type: '企業', isInsured: false
            }],
            liabilities, history,
            appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId]
        }) as GameState
    };
};

export const buildVehicleLossState = (
    currentState: GameState,
    payload: { assetId?: string; claimAmount?: number },
    commandId: string,
    now = serverNow()
): GameState => {
    if (currentState.appliedBoardFinancialEventIds?.includes(commandId)) return currentState;

    const vehicleIndex = currentState.assets.findIndex(asset =>
        (asset.type === '汽車' || asset.type === '飛行器') &&
        (!payload.assetId || asset.id === payload.assetId)
    );
    if (vehicleIndex < 0) throw new Error('目前沒有可移除的汽車');

    const vehicle = currentState.assets[vehicleIndex];
    const claimAmount = Math.max(0, payload.claimAmount || 0);
    const nextCash = (Number(currentState.cash) || 0) + claimAmount;
    const happiness = (currentState.happiness || []).map(item =>
        item.id === 'h_plane' ? { ...item, checked: false } : item
    );

    return cleanObject({
        ...currentState,
        cash: nextCash,
        assets: currentState.assets.filter((_, index) => index !== vehicleIndex),
        // 原汽車貸款刻意保留，符合 C038 規則。
        liabilities: currentState.liabilities,
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        appliedBoardFinancialEventIds: [...(currentState.appliedBoardFinancialEventIds || []), commandId],
        history: [{
            id: commandId,
            timestamp: now,
            name: '機運卡：天有不測風雲',
            amount: claimAmount,
            sourceLabel: claimAmount > 0 ? '保險理賠' : '機運事件',
            usageLabel: '汽車損失',
            cashChange: claimAmount,
            balance: nextCash,
            details: JSON.stringify({
                boardEventId: commandId,
                removedAssetId: vehicle.id,
                removedAssetName: vehicle.name,
                claimAmount,
                liabilitiesPreserved: true
            }),
            flowType: '其它'
        } satisfies Transaction, ...(currentState.history || [])]
    }) as GameState;
};


// Bind event finances to the cloud event; receipt lookup happens before this check so committed old commands remain recoverable.
export const validateFinancialEvent = (board:BoardState,tx:TransactionData,uid:string):string|null => {
    if(!['board-card','hospital','repair'].includes(tx.boardFlow || ''))return null;
    const event=board.currentEvent;
    if(tx.boardFlow==='board-card' && isBoardPromptForCurrentEvent(board.sharedCardPrompt,board))return '共享事件已就緒，尚未扣款；請從共享視窗完成本人財務檢核';
    return event?.playerUid===uid && !!tx.boardEventId && (tx.boardEventId===event.id || tx.boardEventId.startsWith(`${event.id}:`))
        ? null : '原財務事件已更新，尚未扣款；請核對目前事件';
};
export const buildExpenseBroadcast = (board:BoardState,state:GameState,tx:TransactionData,uid:string,commandId:string,now:number):BoardState|undefined => {
    if(tx.boardFlow!=='board-card' || tx.usage!=='expense_update' || !board.currentCard)return undefined;
    const action=resolveBoardCardAction(board.currentCard.cardId,state);
    const expense=action.kind==='financial' ? action.afterApply?.affectsAllPlayersExpense : undefined;
    if(!expense)return undefined;
    if(board.currentEvent?.playerUid!==uid || tx.expensePayload?.category!==expense.category || tx.expensePayload?.amount!==expense.amount || tx.expensePayload?.isIncrease!==expense.isIncrease)throw new Error('全體支出資料已更新，請核對來源卡片');
    return {...board,sharedExpenseEffect:{id:commandId,sourcePlayerUid:uid,...expense,summary:tx.name,detail:'依來源卡片同步全體月支出',timestamp:now}};
};
