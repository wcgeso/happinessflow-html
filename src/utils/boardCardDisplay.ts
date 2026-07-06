import {
  buildHappinessCardMetaFromSchema,
  buildNewsCardMetaFromSchema,
  buildOpportunityCardMetaFromSchema
} from '../constants/cards';
import { BoardCardResult, GameState } from '../types';

export const hydrateBoardCardResult = (card: BoardCardResult | null, gameState: GameState): BoardCardResult | null => {
  if (!card) return null;

  const happinessMeta = buildHappinessCardMetaFromSchema(card.cardId, gameState);
  if (happinessMeta) {
    return {
      ...card,
      title: happinessMeta.title,
      subtitle: happinessMeta.subtitle,
      description: happinessMeta.description,
      familyMilestoneStatus: happinessMeta.familyMilestoneStatus,
      effectLines: happinessMeta.effectLines
    };
  }

  const newsMeta = buildNewsCardMetaFromSchema(card.cardId);
  if (newsMeta) {
    return {
      ...card,
      title: newsMeta.title,
      subtitle: newsMeta.subtitle,
      description: newsMeta.description,
      effectLines: newsMeta.effectLines
    };
  }

  const opportunityMeta = buildOpportunityCardMetaFromSchema(card.cardId);
  if (opportunityMeta && card.deck === 'opportunity') {
    return {
      ...card,
      title: opportunityMeta.title,
      subtitle: opportunityMeta.subtitle || '',
      description: opportunityMeta.description,
      effectLines: opportunityMeta.effectLines
    };
  }

  return card;
};
