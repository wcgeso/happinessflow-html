export const PHOTO_PROMOTION_CONSENT_VERSION = '2026-09-07-v1';

export type PhotoPromotionConsentChoice = 'agreed' | 'declined';

export interface PhotoPromotionConsent {
  choice: PhotoPromotionConsentChoice;
  documentVersion: string;
  respondedAt?: unknown;
}

export type PhotoPromotionConsentStatus = 'agreed' | 'declined' | 'missing' | 'outdated';

export const normalizePhotoPromotionConsent = (value: unknown): PhotoPromotionConsent | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<PhotoPromotionConsent>;
  if (candidate.choice !== 'agreed' && candidate.choice !== 'declined') return undefined;
  if (typeof candidate.documentVersion !== 'string') return undefined;
  return {
    choice: candidate.choice,
    documentVersion: candidate.documentVersion,
    respondedAt: candidate.respondedAt,
  };
};

export const getPhotoPromotionConsentStatus = (value: unknown): PhotoPromotionConsentStatus => {
  const consent = normalizePhotoPromotionConsent(value);
  if (!consent) return 'missing';
  if (consent.documentVersion !== PHOTO_PROMOTION_CONSENT_VERSION) return 'outdated';
  return consent.choice;
};

export const requiresPhotoPromotionConsent = (value: unknown): boolean => {
  const status = getPhotoPromotionConsentStatus(value);
  return status === 'missing' || status === 'outdated';
};
