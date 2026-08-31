import { describe, expect, it } from 'vitest';
import { GameState } from '../types';
import { applyPlayerExpenseAdjustment, applyPlayerLiabilityAdjustment } from './coachAdjustments';

const baseState = (): GameState => ({
    profession: null,
    selectedEnterprise: null,
    selectedDream: null,
    expenses: { basicLiving: 10000, transportEdu: 5000, otherMedicalChild: 0 },
    income: { salary: 50000 },
    currentRankTitle: '',
    currentRankLevel: 1,
    cash: 100000,
    children: 0,
    medicalInsuranceCount: 0,
    assets: [],
    liabilities: [{ id: 'loan-1', name: '信用貸款', totalOwed: 100000, monthlyPayment: 10000, type: '信用貸款' }],
    loans: 100000,
    isSetup: true,
    selectionStep: 'completed',
    history: [],
    happiness: [],
    happinessTotal: 0,
    marketPrices: {},
    previousMarketPrices: {},
    lastPublishedCode: '',
    abilities: { stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 },
    completedHappinessEvents: []
});

describe('coach adjustments', () => {
    it('adjusts one liability without touching other liabilities', () => {
        const result = applyPlayerLiabilityAdjustment(baseState(), 'loan-1', 20000, 2000);
        expect(result.before).toEqual({ totalOwed: 100000, monthlyPayment: 10000 });
        expect(result.after).toEqual({ totalOwed: 120000, monthlyPayment: 12000 });
        expect(result.state.liabilities).toHaveLength(1);
        expect(result.state.liabilities[0].totalOwed).toBe(120000);
    });

    it('removes a liability only when principal and monthly payment both reach zero', () => {
        const result = applyPlayerLiabilityAdjustment(baseState(), 'loan-1', -100000, -10000);
        expect(result.state.liabilities).toEqual([]);
    });

    it('blocks negative liability or expense values', () => {
        expect(() => applyPlayerLiabilityAdjustment(baseState(), 'loan-1', -100001, 0)).toThrow('負債本金不可低於 0');
        expect(() => applyPlayerExpenseAdjustment(baseState(), 'basicLiving', -10001)).toThrow('每月支出不可低於 0');
    });

    it('adjusts persistent monthly expenses by category', () => {
        const result = applyPlayerExpenseAdjustment(baseState(), 'transportEdu', 3000);
        expect(result.before).toBe(5000);
        expect(result.after).toBe(8000);
        expect(result.state.expenses.transportEdu).toBe(8000);
    });
});
