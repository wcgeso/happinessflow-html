import { describe, it, expect } from 'vitest';
import { formatMoney } from '../utils/gameUtils';

describe('formatMoney', () => {
    it('formats number with H suffix', () => {
        expect(formatMoney(100)).toBe('100 H');
        expect(formatMoney(0)).toBe('0 H');
    });

    it('formats large numbers with commas', () => {
        expect(formatMoney(1000)).toBe('1,000 H');
        expect(formatMoney(1000000)).toBe('1,000,000 H');
    });

    it('handles negative numbers', () => {
        expect(formatMoney(-500)).toBe('-500 H');
    });
});
