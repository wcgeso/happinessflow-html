import { CoachExpenseCategory, GameState } from '../types';

const normalizeDelta = (value: number, label: string) => {
    const delta = Math.trunc(Number(value));
    if (!Number.isFinite(delta) || delta === 0) throw new Error(`${label}調整金額不可為 0`);
    return delta;
};

export const applyPlayerLiabilityAdjustment = (
    state: GameState,
    liabilityId: string,
    totalOwedDelta: number,
    monthlyPaymentDelta: number
): { state: GameState; before: { totalOwed: number; monthlyPayment: number }; after: { totalOwed: number; monthlyPayment: number }; liabilityName: string } => {
    const owedDelta = Math.trunc(Number(totalOwedDelta));
    const paymentDelta = Math.trunc(Number(monthlyPaymentDelta));
    if (!Number.isFinite(owedDelta) || !Number.isFinite(paymentDelta) || (owedDelta === 0 && paymentDelta === 0)) {
        throw new Error('請至少調整一項負債資料');
    }

    const liability = (state.liabilities || []).find(item => item.id === liabilityId);
    if (!liability) throw new Error('找不到要調整的負債');

    const nextTotalOwed = (Number(liability.totalOwed) || 0) + owedDelta;
    const nextMonthlyPayment = (Number(liability.monthlyPayment) || 0) + paymentDelta;
    if (nextTotalOwed < 0) throw new Error('負債本金不可低於 0');
    if (nextMonthlyPayment < 0) throw new Error('每月還款不可低於 0');
    if (nextTotalOwed === 0 && nextMonthlyPayment !== 0) throw new Error('負債本金為 0 時，每月還款也必須為 0');

    const nextLiabilities = nextTotalOwed === 0
        ? state.liabilities.filter(item => item.id !== liabilityId)
        : state.liabilities.map(item => item.id === liabilityId
            ? { ...item, totalOwed: nextTotalOwed, monthlyPayment: nextMonthlyPayment }
            : item);

    return {
        state: { ...state, liabilities: nextLiabilities },
        before: { totalOwed: Number(liability.totalOwed) || 0, monthlyPayment: Number(liability.monthlyPayment) || 0 },
        after: { totalOwed: nextTotalOwed, monthlyPayment: nextMonthlyPayment },
        liabilityName: liability.name
    };
};

export const applyPlayerExpenseAdjustment = (
    state: GameState,
    category: CoachExpenseCategory,
    amountDelta: number
): { state: GameState; before: number; after: number } => {
    const delta = normalizeDelta(amountDelta, '每月支出');
    const before = Number(state.expenses?.[category]) || 0;
    const after = before + delta;
    if (after < 0) throw new Error('每月支出不可低於 0');

    return {
        state: { ...state, expenses: { ...(state.expenses || {}), [category]: after } },
        before,
        after
    };
};
