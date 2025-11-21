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
          // Short beep for letter selection
          oscillator.frequency.setValueAtTime(600, now);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;

        case 'place':
          // Click sound for placing letter
          oscillator.frequency.setValueAtTime(400, now);
          oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.05);
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          oscillator.start(now);
          oscillator.stop(now + 0.08);
          break;

        case 'score':
          // Success chime for scoring
          oscillator.frequency.setValueAtTime(523, now); // C5
          oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
          oscillator.frequency.setValueAtTime(784, now + 0.2); // G5
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          oscillator.start(now);
          oscillator.stop(now + 0.3);
          break;

        case 'turnChange':
          // Transition sound
          oscillator.frequency.setValueAtTime(300, now);
          oscillator.frequency.exponentialRampToValueAtTime(450, now + 0.15);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          oscillator.start(now);
          oscillator.stop(now + 0.15);
          break;

        case 'timerWarning':
          // Alert beep
          oscillator.frequency.setValueAtTime(800, now);
          gainNode.gain.setValueAtTime(0.12, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;

        case 'gameEnd':
          // Victory fanfare
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);

          oscillator.frequency.setValueAtTime(523, now); // C5
          osc2.frequency.setValueAtTime(659, now); // E5
          gainNode.gain.setValueAtTime(0.1, now);
          gain2.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          
          oscillator.start(now);
          osc2.start(now);
          oscillator.stop(now + 0.5);
          osc2.stop(now + 0.5);
          break;

        case 'click':
          // Soft click for buttons
          oscillator.frequency.setValueAtTime(350, now);
          gainNode.gain.setValueAtTime(0.08, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          oscillator.start(now);
          oscillator.stop(now + 0.05);
          break;

        case 'invalid':
          // Error sound
          oscillator.frequency.setValueAtTime(200, now);
          gainNode.gain.setValueAtTime(0.12, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          oscillator.start(now);
          oscillator.stop(now + 0.15);
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
