import { describe, expect, it } from 'vitest';
import { getCardNarrative } from './boardCardDisplay';

describe('getCardNarrative', () => {
  it('keeps the story and removes repeated numeric effects', () => {
    expect(getCardNarrative(
      '因為能源礦產的減少，造成油價提升。所有玩家月支出的交通，增加2,000H。',
      ['月支出（交通、教育、娛樂類） +2,000']
    )).toBe('因為能源礦產的減少，造成油價提升。');
  });

  it('keeps a house description when it does not repeat the metrics', () => {
    const description = '二手豪宅出售。原屋主計畫移民，欲出讓位於精華區的豪華住宅。';
    expect(getCardNarrative(description, ['總價：16,000,000', '月淨收益：0'])).toBe(description);
  });
});
