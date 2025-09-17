import React from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function AlphabetBar() {
  const { state } = useGame();
  const { onPickLetter } = useGameEvents();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-2 safe-area-pb">
      <div className="grid grid-cols-13 gap-1 max-w-4xl mx-auto">
        {LETTERS.map((letter) => (
          <Button
            key={letter}
            variant={state.selectedLetter === letter ? "default" : "outline"}
            size="sm"
            onClick={() => onPickLetter(letter)}
            className="h-8 text-xs font-semibold"
          >
            {letter}
          </Button>
        ))}
      </div>
    </div>
  );
}