import { useGame } from '@/game/store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function Scoreboard() {
  const { state } = useGame();

  if (state.players.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-card border-border/30">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Scoreboard</h3>
          <Badge variant="outline" className="text-xs">
            Round {state.round}
          </Badge>
        </div>
        
        <div className="space-y-2">
          {state.players.map((player, index) => {
            const isCurrentPlayer = state.currentPlayer === player.id;
            const roundScore = state.roundScores[player.id] ?? 0;
            const totalScore = state.cumulativeScores[player.id] ?? 0;
            
            return (
              <div
                key={player.id}
                className={`
                  p-3 rounded-lg border transition-all duration-200
                  ${isCurrentPlayer 
                    ? index === 0 
                      ? 'bg-player-1/20 border-player-1/30' 
                      : 'bg-player-2/20 border-player-2/30'
                    : 'bg-card border-border/20'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className={`font-bold text-sm ${
                      index === 0 ? 'text-player-1' : 'text-player-2'
                    }`}>
                      {player.name}
                      {isCurrentPlayer && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Round</div>
                      <div className="text-lg font-bold text-foreground">
                        {roundScore}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className={`text-xl font-bold score-glow ${
                        index === 0 ? 'text-player-1' : 'text-player-2'
                      }`}>
                        {totalScore}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Attack Vowel Display */}
        <div className="pt-2 border-t border-border/20">
          <div className="text-xs text-muted-foreground mb-2">Attack Vowel This Round:</div>
          <Badge 
            variant="destructive" 
            className="text-lg font-bold"
          >
            ⚡{state.attackVowel}
          </Badge>
        </div>
      </div>
    </Card>
  );
}