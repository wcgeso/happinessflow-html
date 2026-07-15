export type AudioCue =
  | 'dice'
  | 'card'
  | 'cash-in'
  | 'cash-out'
  | 'turn'
  | 'happiness'
  | 'winner'
  | 'move-step'
  | 'land'
  | 'bank-land'
  | 'school-land'
  | 'hospital-land'
  | 'repair-land'
  | 'shared'
  | 'pause'
  | 'warning';

export interface AudioSettings {
  enabled: boolean;
  volume: number;
}

export const AUDIO_SETTINGS_KEY = 'hf_audio_settings_v1';
export const AUDIO_SETTINGS_EVENT = 'hf-audio-settings-change';
export const MAIN_MAP_BGM_SRC = '/audio/happinessflow-bgm-main-map.m4a';

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
  'move-step': { frequencies: [190, 250], duration: 0.045, gap: 0.018, type: 'triangle' },
  land: { frequencies: [300, 390], duration: 0.09, gap: 0.04, type: 'triangle' },
  'bank-land': { frequencies: [330, 495, 660], duration: 0.1, gap: 0.045, type: 'sine' },
  'school-land': { frequencies: [523, 659, 784], duration: 0.12, gap: 0.05, type: 'sine' },
  'hospital-land': { frequencies: [240, 320, 400], duration: 0.13, gap: 0.06, type: 'triangle' },
  'repair-land': { frequencies: [280, 420, 560], duration: 0.11, gap: 0.05, type: 'triangle' },
  shared: { frequencies: [392, 494, 587], duration: 0.14, gap: 0.06, type: 'sine' },
  pause: { frequencies: [300, 220], duration: 0.12, gap: 0.08, type: 'triangle' },
  warning: { frequencies: [240, 180], duration: 0.16, gap: 0.08, type: 'triangle' },
};

class NativeAudioManager {
  private context: AudioContextWithLegacy | null = null;
  private backgroundMusic: HTMLAudioElement | null = null;
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
    if (!this.play(cue)) return;
    this.playedEventIds.add(eventId);
    if (this.playedEventIds.size > 200) {
      const oldest = this.playedEventIds.values().next().value;
      if (oldest) this.playedEventIds.delete(oldest);
    }
  }

  private playDiceRoll(context: AudioContextWithLegacy, volume: number) {
    const now = context.currentTime;
    const impacts = [0, 0.08, 0.17, 0.29, 0.42];

    impacts.forEach((offset, index) => {
      const duration = 0.055;
      const start = now + offset;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const channel = buffer.getChannelData(0);

      for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
        const progress = sampleIndex / channel.length;
        channel[sampleIndex] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.2);
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(0.92 + index * 0.025, start);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1150 + index * 170, start);
      filter.Q.setValueAtTime(0.9, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.075), start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start(start);
      source.stop(start + duration + 0.01);
    });

    const settle = context.createOscillator();
    const settleGain = context.createGain();
    settle.type = 'triangle';
    settle.frequency.setValueAtTime(175, now + 0.47);
    settle.frequency.exponentialRampToValueAtTime(125, now + 0.54);
    settleGain.gain.setValueAtTime(0.0001, now + 0.47);
    settleGain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.045), now + 0.48);
    settleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);
    settle.connect(settleGain);
    settleGain.connect(context.destination);
    settle.start(now + 0.47);
    settle.stop(now + 0.57);

    return true;
  }

  play(cue: AudioCue) {
    const settings = getAudioSettings();
    if (!settings.enabled || settings.volume <= 0) return false;
    const context = this.getContext();
    if (!context || context.state !== 'running') return false;
    if (cue === 'dice') return this.playDiceRoll(context, settings.volume);
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
    return true;
  }

  startBackgroundMusic() {
    if (typeof window === 'undefined') return Promise.resolve();

    if (!this.backgroundMusic) {
      this.backgroundMusic = new Audio(MAIN_MAP_BGM_SRC);
      this.backgroundMusic.loop = true;
      this.backgroundMusic.preload = 'auto';
    }

    const settings = getAudioSettings();
    this.backgroundMusic.volume = settings.enabled ? settings.volume * 0.32 : 0;
    if (!settings.enabled || !this.backgroundMusic.paused) return Promise.resolve();

    return this.backgroundMusic.play().catch(() => undefined);
  }

  syncBackgroundMusic() {
    if (!this.backgroundMusic) return;
    const settings = getAudioSettings();
    this.backgroundMusic.volume = settings.enabled ? settings.volume * 0.32 : 0;
    if (!settings.enabled) {
      this.backgroundMusic.pause();
      return;
    }
    void this.startBackgroundMusic();
  }

  stopBackgroundMusic() {
    if (!this.backgroundMusic) return;
    this.backgroundMusic.pause();
    this.backgroundMusic.currentTime = 0;
  }
}

export const audioManager = new NativeAudioManager();
