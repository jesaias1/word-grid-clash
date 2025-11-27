import { useCallback, useRef } from 'react';

type SoundType = 'select' | 'place' | 'score' | 'turnChange' | 'timerWarning' | 'gameEnd' | 'click' | 'invalid';

export const useSoundEffects = (enabled: boolean = true, hapticsEnabled: boolean = true) => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (!enabled) return;

    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (type) {
        case 'select':
          // Subtle beep for letter selection
          oscillator.frequency.setValueAtTime(500, now);
          gainNode.gain.setValueAtTime(0.03, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          oscillator.start(now);
          oscillator.stop(now + 0.06);
          break;

        case 'place':
          // Soft click for placing letter
          oscillator.frequency.setValueAtTime(380, now);
          oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.04);
          gainNode.gain.setValueAtTime(0.05, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          oscillator.start(now);
          oscillator.stop(now + 0.05);
          break;

        case 'score':
          // Gentle success chime
          oscillator.frequency.setValueAtTime(523, now); // C5
          oscillator.frequency.setValueAtTime(659, now + 0.08); // E5
          gainNode.gain.setValueAtTime(0.04, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;

        case 'turnChange':
          // Subtle transition
          oscillator.frequency.setValueAtTime(320, now);
          oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
          gainNode.gain.setValueAtTime(0.035, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;

        case 'timerWarning':
          // Gentle alert
          oscillator.frequency.setValueAtTime(650, now);
          gainNode.gain.setValueAtTime(0.05, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          oscillator.start(now);
          oscillator.stop(now + 0.08);
          break;

        case 'gameEnd':
          // Soft victory sound
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);

          oscillator.frequency.setValueAtTime(523, now); // C5
          osc2.frequency.setValueAtTime(659, now); // E5
          gainNode.gain.setValueAtTime(0.04, now);
          gain2.gain.setValueAtTime(0.04, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          
          oscillator.start(now);
          osc2.start(now);
          oscillator.stop(now + 0.35);
          osc2.stop(now + 0.35);
          break;

        case 'click':
          // Very soft click for buttons
          oscillator.frequency.setValueAtTime(340, now);
          gainNode.gain.setValueAtTime(0.025, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          oscillator.start(now);
          oscillator.stop(now + 0.04);
          break;

        case 'invalid':
          // Gentle error sound
          oscillator.frequency.setValueAtTime(220, now);
          gainNode.gain.setValueAtTime(0.04, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;
      }
    } catch (error) {
      console.warn('Sound effect failed:', error);
    }
  }, [enabled, getAudioContext]);

  const playHaptic = useCallback((type: SoundType) => {
    if (!hapticsEnabled || !navigator.vibrate) return;

    try {
      switch (type) {
        case 'select':
          // Light tap for selection
          navigator.vibrate(10);
          break;

        case 'place':
          // Slightly stronger tap for placement
          navigator.vibrate(15);
          break;

        case 'score':
          // Triple pulse for scoring
          navigator.vibrate([20, 50, 20, 50, 20]);
          break;

        case 'turnChange':
          // Double pulse for turn change
          navigator.vibrate([30, 50, 30]);
          break;

        case 'timerWarning':
          // Quick alert pulse
          navigator.vibrate(40);
          break;

        case 'gameEnd':
          // Victory pattern
          navigator.vibrate([50, 100, 50, 100, 100]);
          break;

        case 'click':
          // Subtle tap for UI interactions
          navigator.vibrate(8);
          break;

        case 'invalid':
          // Short buzz for error
          navigator.vibrate([30, 30, 30]);
          break;
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }, [hapticsEnabled]);

  const playFeedback = useCallback((type: SoundType) => {
    playSound(type);
    playHaptic(type);
  }, [playSound, playHaptic]);

  return { playSound, playHaptic, playFeedback };
};
