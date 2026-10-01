import { describe, expect, it } from 'vitest';
import { isForcedPaymentFundingTransaction, marketPricesMatch } from './GameView';

describe('isForcedPaymentFundingTransaction', () => {
  it('does not route insurance into the cash-turnaround flow', () => {
    expect(isForcedPaymentFundingTransaction({ source: 'cash', usage: 'expense', cashChange: 0 })).toBe(false);
  });

  it('routes only positive cash funding transactions into the cash-turnaround flow', () => {
    expect(isForcedPaymentFundingTransaction({ source: 'income', usage: 'cash', cashChange: 20000 })).toBe(true);
    expect(isForcedPaymentFundingTransaction({ source: 'loan', usage: 'cash', cashChange: 20000 })).toBe(true);
    expect(isForcedPaymentFundingTransaction({ source: 'cash', usage: 'expense', cashChange: 0 })).toBe(false);
  });
});

describe('marketPricesMatch', () => {
  it('treats room market prices as synced when all target symbols already match', () => {
    expect(marketPricesMatch(
      { A10: 1000, A20: 1200, A30: 1000, A40: 1500, B50: 1200, B60: 800, B70: 2000, B80: 1500 },
      { A10: 1000, A20: 1200, A30: 1000, A40: 1500, B50: 1200, B60: 800, B70: 2000, B80: 1500 }
    )).toBe(true);
  });

  it('stays unsynced when any target symbol is different', () => {
    expect(marketPricesMatch(
      { A10: 1000, A20: 1200, A30: 999, A40: 1500, B50: 1200, B60: 800, B70: 2000, B80: 1500 },
      { A10: 1000, A20: 1200, A30: 1000, A40: 1500, B50: 1200, B60: 800, B70: 2000, B80: 1500 }
    )).toBe(false);
  });
});
