import { useCallback, useSyncExternalStore } from 'react';

export type SoundType =
  | 'select' | 'place' | 'score' | 'turnChange' | 'timerWarning' | 'gameEnd' | 'click' | 'invalid'
  | 'combo' | 'bigScore' | 'achievement' | 'levelUp' | 'tick' | 'defeat';

// --- Global sound settings (shared by every component, saved in this browser)
const SOUND_KEY = 'lettus_sound_on';
const HAPTIC_KEY = 'lettus_haptics_on';

const readFlag = (key: string) => {
  try { return localStorage.getItem(key) !== 'false'; } catch { return true; }
};

let settings = { sound: readFlag(SOUND_KEY), haptics: readFlag(HAPTIC_KEY) };
const listeners = new Set<() => void>();

export const setSoundEnabled = (on: boolean) => {
  settings = { ...settings, sound: on };
  try { localStorage.setItem(SOUND_KEY, String(on)); } catch { /* ignore */ }
  listeners.forEach(l => l());
};

export const setHapticsEnabled = (on: boolean) => {
  settings = { ...settings, haptics: on };
  try { localStorage.setItem(HAPTIC_KEY, String(on)); } catch { /* ignore */ }
  listeners.forEach(l => l());
};

export const useSoundSettings = () =>
  useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => settings);

// --- One audio context for the whole app
let ctx: AudioContext | null = null;
const audio = () => {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

type ToneOpts = { type?: OscillatorType; volume?: number; slideTo?: number; attack?: number };

// A single soft tone with a quick attack and a smooth decay
function tone(freq: number, start: number, duration: number, opts: ToneOpts = {}) {
  const ac = audio();
  const { type = 'sine', volume = 0.05, slideTo, attack = 0.008 } = opts;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

// Notes of a C major pentatonic scale, so any run of them sounds pleasant
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

function play(type: SoundType, intensity: number) {
  const now = audio().currentTime;
  switch (type) {
    case 'select':
      tone(660, now, 0.07, { type: 'triangle', volume: 0.035 });
      break;
    case 'place':
      tone(300, now, 0.09, { type: 'triangle', volume: 0.07, slideTo: 180 });
      tone(1200, now, 0.03, { volume: 0.015 });
      break;
    case 'score': {
      // Rising notes, one per point band
      const steps = Math.min(5, Math.max(2, intensity));
      for (let i = 0; i < steps; i++) tone(SCALE[i], now + i * 0.06, 0.18, { type: 'triangle', volume: 0.045 });
      break;
    }
    case 'combo': {
      const steps = Math.min(SCALE.length, 3 + intensity * 2);
      for (let i = 0; i < steps; i++) tone(SCALE[i], now + i * 0.045, 0.22, { type: 'triangle', volume: 0.05 });
      tone(SCALE[Math.min(SCALE.length - 1, steps)], now + steps * 0.045, 0.45, { volume: 0.05 });
      break;
    }
    case 'bigScore':
      [0, 2, 4, 7].forEach((n, i) => tone(SCALE[n % SCALE.length] / 2, now + i * 0.08, 0.5, { type: 'sawtooth', volume: 0.018 }));
      [0, 2, 4, 5].forEach((n, i) => tone(SCALE[n + 3], now + i * 0.08, 0.4, { type: 'triangle', volume: 0.045 }));
      break;
    case 'turnChange':
      tone(392, now, 0.09, { volume: 0.03 });
      tone(523, now + 0.07, 0.12, { volume: 0.03 });
      break;
    case 'tick':
      tone(1000, now, 0.04, { type: 'square', volume: 0.012 });
      break;
    case 'timerWarning':
      tone(880, now, 0.1, { type: 'square', volume: 0.025 });
      tone(880, now + 0.15, 0.1, { type: 'square', volume: 0.025 });
      break;
    case 'gameEnd':
      [0, 2, 4, 5, 7].forEach((n, i) => tone(SCALE[n], now + i * 0.11, 0.5, { type: 'triangle', volume: 0.05 }));
      tone(SCALE[5] / 2, now + 0.55, 0.9, { volume: 0.04 });
      break;
    case 'defeat':
      [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, now + i * 0.16, 0.4, { type: 'triangle', volume: 0.04 }));
      break;
    case 'achievement':
      [4, 7, 9].forEach((n, i) => tone(SCALE[n], now + i * 0.09, 0.35, { volume: 0.045 }));
      tone(SCALE[9] * 1.5, now + 0.3, 0.6, { volume: 0.02 });
      break;
    case 'levelUp':
      [0, 2, 4, 5, 7, 9].forEach((n, i) => tone(SCALE[n], now + i * 0.07, 0.3, { type: 'triangle', volume: 0.05 }));
      [5, 7, 9].forEach(n => tone(SCALE[n], now + 0.5, 0.8, { volume: 0.03 }));
      break;
    case 'click':
      tone(520, now, 0.04, { type: 'triangle', volume: 0.025 });
      break;
    case 'invalid':
      tone(200, now, 0.12, { type: 'square', volume: 0.025, slideTo: 150 });
      break;
  }
}

const HAPTICS: Partial<Record<SoundType, number | number[]>> = {
  select: 8, place: 15, score: [20, 40, 20], combo: [25, 40, 25, 40, 40], bigScore: [40, 40, 60],
  turnChange: [20, 40, 20], timerWarning: 40, gameEnd: [50, 100, 50, 100, 100], defeat: 80,
  click: 6, invalid: [30, 30, 30], achievement: [30, 50, 30], levelUp: [40, 60, 40, 60, 80],
};

export const useSoundEffects = (enabled: boolean = true, hapticsEnabled: boolean = true) => {
  const { sound, haptics } = useSoundSettings();

  const playSound = useCallback((type: SoundType, intensity: number = 1) => {
    if (!enabled || !sound) return;
    try { play(type, intensity); } catch (error) { console.warn('Sound effect failed:', error); }
  }, [enabled, sound]);

  const playHaptic = useCallback((type: SoundType) => {
    if (!hapticsEnabled || !haptics || !navigator.vibrate) return;
    const pattern = HAPTICS[type];
    if (pattern === undefined) return;
    try { navigator.vibrate(pattern); } catch { /* not supported */ }
  }, [hapticsEnabled, haptics]);

  const playFeedback = useCallback((type: SoundType, intensity: number = 1) => {
    playSound(type, intensity);
    playHaptic(type);
  }, [playSound, playHaptic]);

  return { playSound, playHaptic, playFeedback };
};
