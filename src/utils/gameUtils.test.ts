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
});
