import { describe, expect, it } from 'vitest';
import { normalizeAudioSettings } from './audio';

describe('audio settings', () => {
  it('uses safe defaults for missing or malformed values', () => {
    expect(normalizeAudioSettings(null)).toEqual({ musicEnabled: true, soundEnabled: true, volume: 0.55 });
    expect(normalizeAudioSettings({ volume: 3 })).toEqual({ musicEnabled: true, soundEnabled: true, volume: 1 });
  });

  it('keeps legacy mute settings and supports independent controls', () => {
    expect(normalizeAudioSettings({ enabled: false, volume: -1 })).toEqual({ musicEnabled: false, soundEnabled: false, volume: 0 });
    expect(normalizeAudioSettings({ musicEnabled: false, soundEnabled: true })).toEqual({ musicEnabled: false, soundEnabled: true, volume: 0.55 });
  });
});
