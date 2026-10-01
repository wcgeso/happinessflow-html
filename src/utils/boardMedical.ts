import { OPPORTUNITY_CARD_MAP } from '../constants/cards';
import { GameState, PendingMedicalClaim, Transaction, TransactionData } from '../types';
import { getRemainingCreditCapacity } from './financialRules';
import { cleanObject } from './utils';
import { normalizeGameState } from './gameState';

export type MedicalBoardStateResult = {
    status: 'applied' | 'duplicate' | 'requires_funding' | 'failed';
    state: GameState;
    shortfall?: number;
    message?: string;
};

export const buildMedicalBoardCardState = (params: {
    currentState: Partial<GameState>;
    cardId: string;
    eventId: string;
    commandId: string;
    txData: TransactionData;
    now?: number;
}): MedicalBoardStateResult => {
    const state = normalizeGameState(params.currentState);
    const card = OPPORTUNITY_CARD_MAP[params.cardId];
    const now = params.now || Date.now();

    if (!card || card.type !== 'medical') {
        return { status: 'failed', state, message: '醫療事件資料已更新，請重新開啟卡片' };
    }

    if (state.appliedBoardFinancialEventIds?.includes(params.commandId)) {
        return { status: 'duplicate', state };
    }

    const expectedCost = Number(card.cashLoss || 0);
    if (
        params.txData.boardFlow !== 'board-card' ||
        params.txData.usage !== 'expense' ||
        params.txData.amount !== expectedCost ||
        params.txData.cashChange !== -expectedCost
    ) {
        return { status: 'failed', state, message: '醫療費資料已更新，請重新檢查答案' };
    }

    const forcedDebtAmount = Number(params.txData.forcedDebtAmount || 0);
    const fundingLoanAmount = Number(params.txData.fundingLoanAmount || 0);
    if (
        !Number.isInteger(forcedDebtAmount) || forcedDebtAmount < 0 ||
        !Number.isInteger(fundingLoanAmount) || fundingLoanAmount < 0 ||
        (forcedDebtAmount > 0 && fundingLoanAmount > 0)
    ) {
        return { status: 'failed', state, message: '周轉資料無效，請重新操作' };
    }
    if (fundingLoanAmount > getRemainingCreditCapacity(state.profession?.salary || 0, state.liabilities, state.loans)) {
        return { status: 'failed', state, message: '信貸額度不足，請改用其他周轉方式' };
    }

    const nextCash = Number(state.cash || 0) - expectedCost + forcedDebtAmount + fundingLoanAmount;
    if (nextCash < 0) {
        return {
            status: 'requires_funding',
            state,
            shortfall: Math.abs(nextCash),
            message: '現金不足，請先完成資金周轉'
        };
    }

    const history = [...(state.history || [])];
    const liabilities = [...(state.liabilities || [])];

    if (forcedDebtAmount > 0) {
        const debtId = `forced-debt:${params.commandId}`;
        liabilities.push({
            id: debtId,
            name: '強制負債',
            totalOwed: forcedDebtAmount,
            monthlyPayment: 0,
            type: '強制負債'
        });
        history.push({
            id: debtId,
            timestamp: now,
            name: `強制計入負債：${params.txData.name}`,
            amount: forcedDebtAmount,
            sourceLabel: '借貸',
            usageLabel: '強制負債',
            cashChange: forcedDebtAmount,
            balance: nextCash,
            details: JSON.stringify({ usage: 'forced_debt', boardEventId: params.commandId }),
            flowType: '融資'
        } satisfies Transaction);
    }

    if (fundingLoanAmount > 0) {
        const loanId = `credit-turnaround:${params.commandId}`;
        liabilities.push({
            id: loanId,
            name: '信用貸款',
            totalOwed: fundingLoanAmount,
            monthlyPayment: Math.floor(fundingLoanAmount * 0.1),
            type: '信用貸款'
        });
        history.push({
            id: loanId,
            timestamp: now,
            name: `借用信用貸款：${params.txData.name}`,
            amount: fundingLoanAmount,
            sourceLabel: '借貸',
            usageLabel: '信用貸款',
            cashChange: fundingLoanAmount,
            balance: nextCash,
            details: JSON.stringify({ usage: 'cash', funding: true, boardEventId: params.commandId }),
            flowType: '融資'
        } satisfies Transaction);
    }

    const claim: PendingMedicalClaim | undefined = state.medicalInsuranceCount > 0 && (card.insurancePays || 0) > 0
        ? {
            id: `medical-claim:${params.eventId}:${params.cardId}`,
            sourceEventId: params.eventId,
            sourceCardId: params.cardId,
            createdAt: now
        }
        : undefined;
    const pendingMedicalClaims = claim && !state.pendingMedicalClaims.some(item => item.id === claim.id)
        ? [...state.pendingMedicalClaims, claim]
        : state.pendingMedicalClaims;
    const transactionId = `medical-card:${params.commandId}`;
    history.push({
        id: transactionId,
        timestamp: now,
        name: params.txData.name,
        amount: expectedCost,
        sourceLabel: '生活支出',
        usageLabel: '醫療支出',
        cashChange: -expectedCost,
        balance: nextCash,
        boardEventId: params.commandId,
        details: JSON.stringify({
            boardEventId: params.commandId,
            sourceEventId: params.eventId,
            sourceCardId: params.cardId,
            pendingMedicalClaimId: claim?.id,
            forcedDebtAmount,
            fundingLoanAmount
        }),
        flowType: '生活'
    } satisfies Transaction);

    const nextState = normalizeGameState(cleanObject({
        ...state,
        cash: nextCash,
        liabilities,
        history,
        pendingMedicalClaims,
        appliedBoardFinancialEventIds: [
            ...(state.appliedBoardFinancialEventIds || []),
            params.commandId
        ]
    }));

    return { status: 'applied', state: nextState };
};
