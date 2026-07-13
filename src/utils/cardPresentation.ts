import type { BoardCardResult } from '../types';

export interface CardAssetManifestEntry {
  cardId: string;
  frontImage?: string;
  backImage?: string;
  referenceOnly?: boolean;
}

export interface CardPresentationModel {
  cardId: string;
  deck: BoardCardResult['deck'];
  title: string;
  subtitle: string;
  description: string;
  effectLines: string[];
  familyMilestoneStatus?: BoardCardResult['familyMilestoneStatus'];
  asset: CardAssetManifestEntry | null;
}

// Keep this manifest empty until the new visual direction is approved.
// Current cards continue to use the existing CSS presentation and fallback.
export const CARD_ASSET_MANIFEST: Record<string, CardAssetManifestEntry> = {};

export const toCardPresentationModel = (card: BoardCardResult): CardPresentationModel => ({
  cardId: card.cardId,
  deck: card.deck,
  title: card.title,
  subtitle: card.subtitle || '',
  description: card.description || '',
  effectLines: card.effectLines || [],
  familyMilestoneStatus: card.familyMilestoneStatus,
  asset: CARD_ASSET_MANIFEST[card.cardId] || null,
});

export const getMissingCardAssetIds = (cardIds: string[]) =>
  cardIds.filter(cardId => !CARD_ASSET_MANIFEST[cardId]);
