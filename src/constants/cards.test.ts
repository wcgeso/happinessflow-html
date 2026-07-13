import { describe, expect, it } from 'vitest';
import { buildOpportunityCardMetaFromSchema, OPPORTUNITY_CARD_MAP } from './cards';

describe('buildOpportunityCardMetaFromSchema', () => {
  it('shows the financial-check expense category for monthly expense cards', () => {
    expect(buildOpportunityCardMetaFromSchema('C047')?.effectLines).toContain(
      '月支出（交通、教育、娛樂類） +2,000'
    );
  });

  it('marks all opportunity cards requiring sharing for execution review', () => {
    expect(OPPORTUNITY_CARD_MAP.C054.requiresStorySharing).toBe(true);
    expect(OPPORTUNITY_CARD_MAP.C056.requiresStorySharing).toBe(true);
  });
});
