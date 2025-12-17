import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Trophy, Calendar, Users, Gamepad2, Wifi, Play, Target } from 'lucide-react';
import { format } from 'date-fns';
import { getLocalGameHistory, LocalGameHistoryEntry } from '@/hooks/useGameStatePersistence';
import { getTierEmoji, getTierColor, Tier } from '@/hooks/useDailyChallenge';

interface DailyAttemptEntry {
  id: string;
  challenge_date: string;
  score: number;
  tier_achieved: Tier | null;
  words_found: string[];
  completed: boolean;
  completed_at: string | null;
}

interface OnlineGameHistoryEntry {
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

type CombinedGameEntry = 
  | { type: 'online'; data: OnlineGameHistoryEntry }
  | { type: 'local'; data: LocalGameHistoryEntry }
  | { type: 'daily'; data: DailyAttemptEntry };

const GameHistory = () => {
  const navigate = useNavigate();
  const [onlineGames, setOnlineGames] = useState<OnlineGameHistoryEntry[]>([]);
  const [localGames, setLocalGames] = useState<LocalGameHistoryEntry[]>([]);
  const [dailyAttempts, setDailyAttempts] = useState<DailyAttemptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'online' | 'local' | 'daily'>('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Load local games immediately - filter out incomplete games
        const localHistory = getLocalGameHistory().filter(game => game.completed !== false);
        setLocalGames(localHistory);
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setCurrentUserId(user.id);

          // Fetch daily challenge attempts
          const { data: dailyData, error: dailyError } = await supabase
            .from('daily_challenge_attempts')
            .select('*')
            .eq('user_id', user.id)
            .order('challenge_date', { ascending: false });
          
          if (!dailyError && dailyData) {
            setDailyAttempts(dailyData.map(d => ({
              ...d,
              tier_achieved: d.tier_achieved as Tier | null,
              words_found: (d.words_found as string[]) || []
            })));
          }

          // Fetch finished online games where user participated
          const { data: sessions, error: sessionsError } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('status', 'finished')
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

          if (!sessionsError && sessions && sessions.length > 0) {
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

            setOnlineGames(gamesWithStates);
          }
        }
      } catch (error) {
        console.error('Error in fetchHistory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);
  
  // Calculate daily challenge stats
  const dailyStats = {
    total: dailyAttempts.length,
    completed: dailyAttempts.filter(a => a.completed).length,
    diamond: dailyAttempts.filter(a => a.tier_achieved === 'diamond').length,
    gold: dailyAttempts.filter(a => a.tier_achieved === 'gold').length,
    silver: dailyAttempts.filter(a => a.tier_achieved === 'silver').length,
    bronze: dailyAttempts.filter(a => a.tier_achieved === 'bronze').length,
  };

  // Combine and sort all games
  const allGames: CombinedGameEntry[] = [
    ...onlineGames.map(g => ({ type: 'online' as const, data: g })),
    ...localGames.map(g => ({ type: 'local' as const, data: g })),
    ...dailyAttempts.map(g => ({ type: 'daily' as const, data: { ...g, created_at: g.challenge_date } as DailyAttemptEntry & { created_at: string } }))
  ].sort((a, b) => new Date(b.data.created_at || (b.data as DailyAttemptEntry).challenge_date).getTime() - new Date(a.data.created_at || (a.data as DailyAttemptEntry).challenge_date).getTime());
  
  const filteredGames = filter === 'all' 
    ? allGames 
    : allGames.filter(g => g.type === filter);
  
  const totalGames = allGames.length;

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

  const getOnlineGameResult = (game: OnlineGameHistoryEntry) => {
    if (!currentUserId) return 'Unknown';
    
    const isPlayer1 = game.player1_id === currentUserId;

    if (game.winner_index === null) return 'Draw';
    
    const iWon = (isPlayer1 && game.winner_index === 1) || (!isPlayer1 && game.winner_index === 2);
    return iWon ? 'Won' : 'Lost';
  };
  
  const getLocalGameResult = (game: LocalGameHistoryEntry) => {
    if (game.winnerIndex === null) return 'Draw';
    return game.winnerIndex === 0 ? 'Won' : 'Lost';
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
            {totalGames} {totalGames === 1 ? 'game' : 'games'} played
          </p>
        </div>
        <Button onClick={() => navigate('/')} variant="outline">
          Back to Menu
        </Button>
      </div>
      
      {/* Daily Challenge Stats */}
      {dailyStats.total > 0 && (
        <Card className="p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-orange-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold">Daily Challenge Stats</h3>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold">{dailyStats.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-400">{dailyStats.diamond}</div>
              <div className="text-xs">💎 Diamond</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{dailyStats.gold}</div>
              <div className="text-xs">🥇 Gold</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-300">{dailyStats.silver}</div>
              <div className="text-xs">🥈 Silver</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{dailyStats.bronze}</div>
              <div className="text-xs">🥉 Bronze</div>
            </div>
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      {totalGames > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({allGames.length})
          </Button>
          <Button 
            variant={filter === 'daily' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('daily')}
          >
            <Target className="w-4 h-4 mr-1" />
            Daily ({dailyAttempts.length})
          </Button>
          <Button 
            variant={filter === 'local' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('local')}
          >
            <Gamepad2 className="w-4 h-4 mr-1" />
            Local ({localGames.length})
          </Button>
          <Button 
            variant={filter === 'online' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('online')}
          >
            <Wifi className="w-4 h-4 mr-1" />
            Online ({onlineGames.length})
          </Button>
        </div>
      )}

      {/* Games List */}
      {filteredGames.length === 0 ? (
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
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-3">
            {filteredGames.map((entry, entryIndex) => {
              // Daily challenge entry
              if (entry.type === 'daily') {
                const attempt = entry.data;
                const isExpanded = expandedGames.has(attempt.id);
                const tierEmoji = attempt.tier_achieved ? getTierEmoji(attempt.tier_achieved) : '⬜';
                const tierColor = attempt.tier_achieved ? getTierColor(attempt.tier_achieved) : 'text-muted-foreground';

                return (
                  <Card key={attempt.id} className="p-4 hover:shadow-lg transition-shadow border-orange-500/20">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleGameExpanded(attempt.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs bg-orange-500/10 border-orange-500/30">
                              <Target className="w-3 h-3 mr-1" />
                              Daily
                            </Badge>
                            <Badge className={`font-bold ${tierColor} bg-transparent border`}>
                              {tierEmoji} {attempt.tier_achieved || 'In Progress'}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(attempt.challenge_date), 'MMM d, yyyy')}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">{attempt.score}</div>
                              <div className="text-xs text-muted-foreground">points</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold">{attempt.words_found?.length || 0}</div>
                              <div className="text-xs text-muted-foreground">words</div>
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
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-2">Words Found</h4>
                          <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {(attempt.words_found || []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(attempt.words_found || []).map((word: string, idx: number) => (
                                  <span 
                                    key={idx} 
                                    className="bg-orange-500/20 text-orange-200 px-2 py-0.5 rounded text-xs font-medium"
                                  >
                                    {word}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No words found</p>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              }
              else if (entry.type === 'online') {
                const game = entry.data;
                const isPlayer1 = game.player1_id === currentUserId;
                const myName = isPlayer1 ? game.player1_name : game.player2_name;
                const opponentName = isPlayer1 ? game.player2_name : game.player1_name;
                const myScore = isPlayer1 ? game.player1_state?.score : game.player2_state?.score;
                const opponentScore = isPlayer1 ? game.player2_state?.score : game.player1_state?.score;
                const myWords = isPlayer1 ? game.player1_state?.words_found : game.player2_state?.words_found;
                const opponentWords = isPlayer1 ? game.player2_state?.words_found : game.player1_state?.words_found;
                const result = getOnlineGameResult(game);
                const isExpanded = expandedGames.has(game.id);

                return (
                  <Card key={game.id} className="p-4 hover:shadow-lg transition-shadow">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleGameExpanded(game.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              <Wifi className="w-3 h-3 mr-1" />
                              Online
                            </Badge>
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
                          </div>

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
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            <span>Board: {game.board_size}×{game.board_size}</span>
                            <span>•</span>
                            <span>{format(new Date(game.created_at), 'h:mm a')}</span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/replay/${game.id}`)}
                            className="flex items-center gap-1"
                          >
                            <Play className="w-4 h-4" />
                            Watch Replay
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              } else {
                // Local game
                const game = entry.data;
                const result = getLocalGameResult(game);
                const isExpanded = expandedGames.has(game.id);
                const gameTypeLabel = game.type === 'solo' ? 'vs AI' : `${game.playerCount || 2} Players`;

                return (
                  <Card key={game.id} className="p-4 hover:shadow-lg transition-shadow">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleGameExpanded(game.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              <Gamepad2 className="w-3 h-3 mr-1" />
                              {gameTypeLabel}
                            </Badge>
                            <Badge className={`${getResultColor(result)} font-bold`}>
                              {result}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(game.created_at), 'MMM d, yyyy')}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 flex-wrap">
                            {game.players.map((player, idx) => (
                              <div key={idx} className="text-center">
                                <div className="font-bold text-sm">{player.name}</div>
                                <div className={`text-xl font-bold ${idx === 0 ? 'text-primary' : 'text-secondary'}`}>
                                  {player.score}
                                </div>
                              </div>
                            ))}
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
                        <div className={`grid gap-4 pt-4 border-t`} style={{ gridTemplateColumns: `repeat(${Math.min(game.players.length, 3)}, 1fr)` }}>
                          {game.players.map((player, idx) => (
                            <div key={idx}>
                              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {player.name}
                              </h4>
                              <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                                {player.words.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {player.words.map((word: string, wordIdx: number) => (
                                      <span 
                                        key={wordIdx} 
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                                          idx === 0 ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                                        }`}
                                      >
                                        {word}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">No words found</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 text-xs text-muted-foreground">
                          {format(new Date(game.created_at), 'h:mm a')}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              }
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default GameHistory;
