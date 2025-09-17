import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function AlphabetBar() {
  const { state } = useGame();
  const { onPickLetter } = useGameEvents();

  return (
    <Card className="p-4 bg-gradient-card border-border/30 sticky bottom-0 z-10">
      <div className="flex flex-wrap gap-1 justify-center">
        {ALPHABET.map(letter => {
          const isSelected = state.pendingLetter === letter;
          const isAttackLetter = state.isAttacking && letter === state.attackVowel;
          const isDisabled = state.isAttacking && letter !== state.attackVowel;
          
          return (
            <Button
              key={letter}
              variant={isSelected ? "default" : isAttackLetter ? "destructive" : "outline"}
              size="sm"
              className={`
                min-w-[32px] h-8 p-1 font-bold text-xs
                ${isSelected ? 'ring-2 ring-primary' : ''}
                ${isDisabled ? 'opacity-50' : ''}
              `}
              onClick={() => onPickLetter(letter)}
              disabled={isDisabled}
            >
              {letter}
            </Button>
          );
        })}
      </div>
      
      {state.isAttacking && (
        <div className="text-center mt-2 text-sm text-muted-foreground">
          Attack mode: Only {state.attackVowel} can be placed
        </div>
      )}
    </Card>
  );
}