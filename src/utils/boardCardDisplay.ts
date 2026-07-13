import {
  buildHappinessCardMetaFromSchema,
  buildNewsCardMetaFromSchema,
  buildOpportunityCardMetaFromSchema
} from '../constants/cards';
import { BoardCardResult, GameState } from '../types';

const EFFECT_SENTENCE_MARKERS = ['所有玩家', '抽到本卡', '抽到卡片', '月支出'];

export const getCardNarrative = (description: string | undefined, effectLines: string[] = []) => {
  const normalized = description ? description.trim() : '';
  if (!normalized || effectLines.length === 0) return normalized;

  const segments = normalized
    .split(/(?<=[。！？.!?])|\n+/)
    .map(segment => segment.trim())
    .filter(Boolean);
  const narrative = segments.filter(segment => {
    if (EFFECT_SENTENCE_MARKERS.some(marker => segment.includes(marker))) return false;
    const hasNumber = /\d[\d,]*/.test(segment);
    const hasImpactWord = /增加|減少|支出|收入|貸款|租金|幸福點|幸福分/.test(segment);
    return !(hasNumber && hasImpactWord);
  });

  return narrative.join('').trim() || normalized;
};

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
