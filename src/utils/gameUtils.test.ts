import { describe, it, expect } from 'vitest';
import { calculateFinancialSummary, formatMoney } from '../utils/gameUtils';

describe('formatMoney', () => {
    it('formats number without unit suffix', () => {
        expect(formatMoney(100)).toBe('100');
        expect(formatMoney(0)).toBe('0');
    });

    it('formats large numbers with commas', () => {
        expect(formatMoney(1000)).toBe('1,000');
        expect(formatMoney(1000000)).toBe('1,000,000');
    });

    it('handles negative numbers', () => {
        expect(formatMoney(-500)).toBe('-500');
    });
});

describe('calculateFinancialSummary', () => {
    it('counts manual investment income once as passive income', () => {
        const summary = calculateFinancialSummary({
            profession: { salary: 30000, expenses: { basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 } },
            income: { investment: 5000 },
            expenses: {},
            assets: [{ cashflow: 2000, type: '企業', cost: 0 }],
            liabilities: [],
            cash: 0,
            loans: 0,
            currentRankLevel: 1,
            medicalInsuranceCount: 0,
            abilities: {}
        } as any);

        expect(summary.passiveIncome).toBe(7000);
        expect(summary.totalIncome).toBe(37000);
    });

    it('applies room acceleration to income but not expenses', () => {
        const state = {
            profession: { salary: 40000, expenses: { basicLiving: 18000, transportEdu: 0, otherMedicalChild: 0 } },
            income: {},
            expenses: {},
            assets: [],
            liabilities: [],
            cash: 0,
            loans: 0,
            currentRankLevel: 1,
            medicalInsuranceCount: 0,
            abilities: {}
        } as any;

        expect(calculateFinancialSummary(state, 1.5).monthlyCashflow).toBe(40000);
        expect(calculateFinancialSummary(state, 2).monthlyCashflow).toBe(60000);
        expect(calculateFinancialSummary(state, 3).monthlyCashflow).toBe(100000);
    });

    it('defaults legacy rooms to x1', () => {
        const state = {
            profession: { salary: 40000, expenses: { basicLiving: 18000, transportEdu: 0, otherMedicalChild: 0 } },
            income: {},
            expenses: {},
            assets: [],
            liabilities: [],
            cash: 0,
            loans: 0,
            currentRankLevel: 1,
            medicalInsuranceCount: 0,
            abilities: {}
        } as any;

        expect(calculateFinancialSummary(state).monthlyCashflow).toBe(20000);
    });

    it('does not double count legacy target-enterprise income when the asset already has cashflow', () => {
        const state = {
            profession: { salary: 0, expenses: { basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 } },
            selectedEnterprise: { name: '目標企業' },
            income: { '目標企業': 4500000 },
            expenses: {},
            assets: [{ name: '目標企業', cashflow: 4500000, type: '企業', cost: 5000000 }],
            liabilities: [], cash: 0, loans: 0, currentRankLevel: 1, medicalInsuranceCount: 0, abilities: {}
        } as any;

        expect(calculateFinancialSummary(state).totalIncome).toBe(4500000);
        expect(calculateFinancialSummary(state).passiveIncome).toBe(4500000);
    });
});
