import { describe, expect, it } from 'vitest';
import { normalizeAudioSettings } from './audio';

describe('audio settings', () => {
  it('uses safe defaults for missing or malformed values', () => {
    expect(normalizeAudioSettings(null)).toEqual({ enabled: true, volume: 0.55 });
    expect(normalizeAudioSettings({ volume: 3 })).toEqual({ enabled: true, volume: 1 });
  });

  it('clamps volume and preserves the mute preference', () => {
    expect(normalizeAudioSettings({ enabled: false, volume: -1 })).toEqual({ enabled: false, volume: 0 });
  });
});
