import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Trophy, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';

interface GameHistoryEntry {
  id: string;
  created_at: string;
  player1_name: string;
  player2_name: string;
  winner_index: number | null;
  player1_id: string;
  player2_id: string;
  board_size: number;
  player1_state?: {
    score: number;
    words_found: string[];
  };
  player2_state?: {
    score: number;
    words_found: string[];
  };
}

const GameHistory = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      setCurrentUserId(user.id);

      // Fetch finished games where user participated
      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('status', 'finished')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (sessions) {
        // Fetch game states for each session
        const gamesWithStates = await Promise.all(
          sessions.map(async (session) => {
            const { data: states } = await supabase
              .from('game_state')
              .select('*')
              .eq('session_id', session.id);

            const player1State = states?.find(s => s.player_index === 1);
            const player2State = states?.find(s => s.player_index === 2);

            return {
              ...session,
              player1_state: player1State ? {
                score: player1State.score,
                words_found: (player1State.words_found as string[]) || []
              } : undefined,
              player2_state: player2State ? {
                score: player2State.score,
                words_found: (player2State.words_found as string[]) || []
              } : undefined
            };
          })
        );

        setGames(gamesWithStates);
      }

      setLoading(false);
    };

    fetchHistory();
  }, [navigate]);

  const toggleGameExpanded = (gameId: string) => {
    setExpandedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };

  const getGameResult = (game: GameHistoryEntry) => {
    if (!currentUserId) return 'Unknown';
    
    const isPlayer1 = game.player1_id === currentUserId;
    const myScore = isPlayer1 ? game.player1_state?.score : game.player2_state?.score;
    const opponentScore = isPlayer1 ? game.player2_state?.score : game.player1_state?.score;

    if (game.winner_index === null) return 'Draw';
    
    const iWon = (isPlayer1 && game.winner_index === 1) || (!isPlayer1 && game.winner_index === 2);
    return iWon ? 'Won' : 'Lost';
  };

  const getResultColor = (result: string) => {
    if (result === 'Won') return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50';
    if (result === 'Lost') return 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/50';
    return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/50';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading game history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Game History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {games.length} {games.length === 1 ? 'game' : 'games'} played
          </p>
        </div>
        <Button onClick={() => navigate('/')} variant="outline">
          Back to Menu
        </Button>
      </div>

      {/* Games List */}
      {games.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-semibold mb-2">No games yet</h3>
          <p className="text-muted-foreground mb-4">
            Start playing to build your game history!
          </p>
          <Button onClick={() => navigate('/')}>
            Play Now
          </Button>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3">
            {games.map((game) => {
              const isPlayer1 = game.player1_id === currentUserId;
              const myName = isPlayer1 ? game.player1_name : game.player2_name;
              const opponentName = isPlayer1 ? game.player2_name : game.player1_name;
              const myScore = isPlayer1 ? game.player1_state?.score : game.player2_state?.score;
              const opponentScore = isPlayer1 ? game.player2_state?.score : game.player1_state?.score;
              const myWords = isPlayer1 ? game.player1_state?.words_found : game.player2_state?.words_found;
              const opponentWords = isPlayer1 ? game.player2_state?.words_found : game.player1_state?.words_found;
              const result = getGameResult(game);
              const isExpanded = expandedGames.has(game.id);

              return (
                <Card key={game.id} className="p-4 hover:shadow-lg transition-shadow">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleGameExpanded(game.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${getResultColor(result)} font-bold`}>
                            {result}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(game.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className="font-bold text-lg">{myName}</div>
                            <div className="text-2xl font-bold text-primary">{myScore ?? 0}</div>
                          </div>
                          
                          <div className="text-muted-foreground font-bold">vs</div>
                          
                          <div className="text-center">
                            <div className="font-bold text-lg">{opponentName}</div>
                            <div className="text-2xl font-bold text-secondary">{opponentScore ?? 0}</div>
                          </div>
                        </div>
                      </div>

                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="ml-2">
                          <ChevronDown 
                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          />
                        </Button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="mt-4">
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        {/* Your words */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {myName}
                          </h4>
                          <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {(myWords || []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(myWords || []).map((word: string, idx: number) => (
                                  <span 
                                    key={idx} 
                                    className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs font-medium"
                                  >
                                    {word}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No words found</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(myWords || []).length} words
                          </p>
                        </div>

                        {/* Opponent's words */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {opponentName}
                          </h4>
                          <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {(opponentWords || []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(opponentWords || []).map((word: string, idx: number) => (
                                  <span 
                                    key={idx} 
                                    className="bg-secondary/20 text-secondary px-2 py-0.5 rounded text-xs font-medium"
                                  >
                                    {word}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No words found</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(opponentWords || []).length} words
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3">
                        <span>Board: {game.board_size}×{game.board_size}</span>
                        <span>•</span>
                        <span>{format(new Date(game.created_at), 'h:mm a')}</span>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default GameHistory;
