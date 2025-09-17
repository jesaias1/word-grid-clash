import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';

export function AttackBar() {
  const { state } = useGame();
  const { onToggleAttack } = useGameEvents();

  if (!state.activePlayerId) return null;

  const currentPlayerAttacks = state.attacksRemaining[state.activePlayerId] ?? 0;

  return (
    <Card className="p-4 bg-gradient-card border-border/30">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Attack vowel this round:</span>
          <Badge variant="secondary" className="text-lg font-bold">
            {state.attackVowel}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Attacks left:</span>
          <Badge variant={currentPlayerAttacks > 0 ? "default" : "secondary"} className="text-lg font-bold">
            {currentPlayerAttacks}
          </Badge>
        </div>
        
        <Button
          variant={state.isAttacking ? "destructive" : "outline"}
          size="sm"
          onClick={onToggleAttack}
          disabled={currentPlayerAttacks <= 0}
          className="font-bold"
        >
          {state.isAttacking ? "Cancel Attack" : "Attack Mode"}
        </Button>
      </div>
    </Card>
  );
}