import { describe, expect, it } from 'vitest';
import { createInitialMarketPrices, STOCK_DATA, STOCK_SYMBOLS } from './constants';

describe('createInitialMarketPrices', () => {
  it('selects one complete non-bubble market snapshot for a new game', () => {
    const prices = createInitialMarketPrices(() => 0);

    expect(Object.keys(prices)).toEqual(STOCK_SYMBOLS);
    expect(prices).toEqual(STOCK_DATA.N001);
    expect(Object.values(prices).every(price => price > 0)).toBe(true);
  });
});
