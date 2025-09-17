import { useEffect } from 'react';
import { useGameEvents } from '@/game/events';

export function useKeyboard() {
  const { onPickLetter } = useGameEvents();

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle A-Z keys
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        onPickLetter(event.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onPickLetter]);
}