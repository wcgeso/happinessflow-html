import { describe, expect, it } from 'vitest';
import {
  PHOTO_PROMOTION_CONSENT_VERSION,
  getPhotoPromotionConsentStatus,
  requiresPhotoPromotionConsent,
} from './photoPromotionConsent';

describe('photo promotion consent', () => {
  it('requires a response when missing or outdated', () => {
    expect(requiresPhotoPromotionConsent(undefined)).toBe(true);
    expect(requiresPhotoPromotionConsent({ choice: 'agreed', documentVersion: 'old' })).toBe(true);
  });

  it('accepts both choices for the current document version', () => {
    expect(getPhotoPromotionConsentStatus({ choice: 'agreed', documentVersion: PHOTO_PROMOTION_CONSENT_VERSION })).toBe('agreed');
    expect(getPhotoPromotionConsentStatus({ choice: 'declined', documentVersion: PHOTO_PROMOTION_CONSENT_VERSION })).toBe('declined');
    expect(requiresPhotoPromotionConsent({ choice: 'declined', documentVersion: PHOTO_PROMOTION_CONSENT_VERSION })).toBe(false);
  });

  it('treats malformed stored data as missing', () => {
    expect(getPhotoPromotionConsentStatus({ choice: 'maybe', documentVersion: PHOTO_PROMOTION_CONSENT_VERSION })).toBe('missing');
  });
});
