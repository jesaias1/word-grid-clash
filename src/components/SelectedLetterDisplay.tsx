import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useGame } from '@/game/store';

export function SelectedLetterDisplay() {
  const { state } = useGame();
  
  const displayLetter = state.isAttacking ? state.attackVowel : (state.selectedLetter || '?');
  const isAttacking = state.isAttacking;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">
        {isAttacking ? 'Attack Letter:' : 'Selected:'}
      </span>
      <Badge 
        variant={isAttacking ? "destructive" : state.selectedLetter ? "default" : "secondary"} 
        className="text-lg font-bold px-3 py-1"
      >
        {displayLetter}
      </Badge>
    </div>
  );
}