export type AudioCue = 'dice' | 'card' | 'cash-in' | 'cash-out' | 'turn' | 'happiness' | 'winner';

export interface AudioSettings {
  enabled: boolean;
  volume: number;
}

export const AUDIO_SETTINGS_KEY = 'hf_audio_settings_v1';
export const AUDIO_SETTINGS_EVENT = 'hf-audio-settings-change';

const DEFAULT_AUDIO_SETTINGS: AudioSettings = { enabled: true, volume: 0.55 };

export const normalizeAudioSettings = (value: unknown): AudioSettings => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_AUDIO_SETTINGS };
  const candidate = value as Partial<AudioSettings>;
  return {
    enabled: candidate.enabled !== false,
    volume: typeof candidate.volume === 'number'
      ? Math.min(1, Math.max(0, candidate.volume))
      : DEFAULT_AUDIO_SETTINGS.volume,
  };
};

export const getAudioSettings = (): AudioSettings => {
  if (typeof window === 'undefined') return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const stored = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    return stored ? normalizeAudioSettings(JSON.parse(stored)) : { ...DEFAULT_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
};

export const setAudioSettings = (patch: Partial<AudioSettings>): AudioSettings => {
  const next = normalizeAudioSettings({ ...getAudioSettings(), ...patch });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(AUDIO_SETTINGS_EVENT, { detail: next }));
    } catch {
      // Audio preferences are optional; playback still works for this session.
    }
  }
  return next;
};

type AudioContextWithLegacy = AudioContext & { webkitResume?: () => Promise<void> };

const CUE_PROFILES: Record<AudioCue, { frequencies: number[]; duration: number; gap: number; type: OscillatorType }> = {
  dice: { frequencies: [180, 240, 320], duration: 0.07, gap: 0.045, type: 'square' },
  card: { frequencies: [420, 560, 720], duration: 0.11, gap: 0.055, type: 'sine' },
  'cash-in': { frequencies: [520, 680], duration: 0.12, gap: 0.06, type: 'sine' },
  'cash-out': { frequencies: [360, 240], duration: 0.14, gap: 0.07, type: 'triangle' },
  turn: { frequencies: [440, 660], duration: 0.16, gap: 0.08, type: 'sine' },
  happiness: { frequencies: [520, 660, 880], duration: 0.1, gap: 0.055, type: 'sine' },
  winner: { frequencies: [440, 660, 880, 1100], duration: 0.14, gap: 0.07, type: 'sine' },
};

class NativeAudioManager {
  private context: AudioContextWithLegacy | null = null;
  private playedEventIds = new Set<string>();

  private getContext() {
    if (typeof window === 'undefined') return null;
    if (this.context) return this.context;
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    this.context = new AudioContextConstructor() as AudioContextWithLegacy;
    return this.context;
  }

  async unlock() {
    const context = this.getContext();
    if (!context || context.state === 'running') return;
    await (context.webkitResume ? context.webkitResume() : context.resume());
  }

  playOnce(cue: AudioCue, eventId: string) {
    if (this.playedEventIds.has(eventId)) return;
    this.playedEventIds.add(eventId);
    if (this.playedEventIds.size > 200) {
      const oldest = this.playedEventIds.values().next().value;
      if (oldest) this.playedEventIds.delete(oldest);
    }
    this.play(cue);
  }

  play(cue: AudioCue) {
    const settings = getAudioSettings();
    if (!settings.enabled || settings.volume <= 0) return;
    const context = this.getContext();
    if (!context || context.state !== 'running') return;
    const profile = CUE_PROFILES[cue];
    const now = context.currentTime;
    profile.frequencies.forEach((frequency, index) => {
      const start = now + index * (profile.duration + profile.gap);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = profile.type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, settings.volume * 0.12), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + profile.duration + 0.01);
    });
  }
}

export const audioManager = new NativeAudioManager();
