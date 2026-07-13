import { describe, expect, it } from 'vitest';
import { HAPPINESS_CARDS, NEWS_CARDS, OPPORTUNITY_CARDS } from '../constants/cards';
import { getMissingCardAssetIds, toCardPresentationModel } from './cardPresentation';

describe('card presentation pipeline', () => {
  it('keeps all 160 card ids on the CSS fallback until art direction is approved', () => {
    const cardIds = [...HAPPINESS_CARDS, ...OPPORTUNITY_CARDS, ...NEWS_CARDS].map(card => card.id);
    expect(cardIds).toHaveLength(160);
    expect(getMissingCardAssetIds(cardIds)).toHaveLength(160);
  });

  it('normalizes the same presentation shape for every deck', () => {
    const model = toCardPresentationModel({
      cardId: 'H001',
      deck: 'happiness',
      title: '測試卡',
      subtitle: undefined,
      description: '說明',
      effectLines: ['幸福 +1'],
    });
    expect(model).toMatchObject({ cardId: 'H001', subtitle: '', effectLines: ['幸福 +1'], asset: null });
  });
});
