import { useEffect } from 'react';
import { useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';

export function useKeyboard() {
  const { state } = useGame();
  const { onPickLetter } = useGameEvents();

  useEffect(() => {
    // Only enable keyboard for passplay mode
    if (state.mode !== 'passplay') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        onPickLetter(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.mode, onPickLetter]);
}