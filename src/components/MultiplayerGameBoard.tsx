import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Copy, Users, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadDictionary } from '@/lib/dictionary';
import { scoreGrid } from '@/lib/scoring';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Player = 1 | 2;
type Letter = string;
type GridCell = {
  letter: Letter | null;
  player: Player | null;
} | null;
type Grid = GridCell[][];

type GameState = Tables<'games'> & {
  player1_grid: Grid;
  player2_grid: Grid;
  player1_cooldowns: Record<string, number>;
  player2_cooldowns: Record<string, number>;
  letter_pool: string[];
  starting_tiles: Array<{ row: number; col: number; letter: string }>;
};

const MultiplayerGameBoard = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const playerNumber = parseInt(searchParams.get('player') || '1') as Player;
  const username = searchParams.get('username') || `Player ${playerNumber}`;
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<Letter>('');
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameStartCountdown, setGameStartCountdown] = useState(0);

  // Load game data
  useEffect(() => {
    if (!gameId) return;
    
    loadGame();
    
    // Auto-join if game is waiting and user isn't assigned
    const autoJoinIfNeeded = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        const { data: game } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (game && game.game_status === 'waiting' && !game.player1_id && !game.player2_id) {
          // Assign current user as player 1 if no players
          await supabase
            .from('games')
            .update({ player1_id: user.user?.id || null })
            .eq('id', gameId);
        } else if (game && game.game_status === 'waiting' && game.player1_id && !game.player2_id && game.player1_id !== user.user?.id) {
          // Assign current user as player 2
          await supabase
            .from('games')
            .update({ 
              player2_id: user.user?.id || null
            })
            .eq('id', gameId);
        }
      } catch (error) {
        console.error('Error auto-joining game:', error);
      }
    };

    autoJoinIfNeeded();
    
    // Set up realtime subscription
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log('Game updated:', payload);
          loadGame();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Timer effect
  useEffect(() => {
    if (!gameState || gameState.game_status !== 'active') return;
    
    const isMyTurn = gameState?.current_player === playerNumber;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - pass turn to opponent
          if (isMyTurn) {
            passTurn();
          }
          return TURN_TIME;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.current_player, gameState?.game_status, playerNumber]);

  // Reset timer when turn changes
  useEffect(() => {
    setTimeLeft(TURN_TIME);
  }, [gameState?.current_player]);

  // Game start countdown effect
  useEffect(() => {
    if (gameStartCountdown > 0) {
      const timer = setTimeout(() => {
        setGameStartCountdown(prev => {
          if (prev <= 1) {
            // Start the game and place starting tiles
            if (gameId) {
              supabase
                .from('games')
                .update({ game_status: 'active' })
                .eq('id', gameId)
                .then(() => {
                  // The realtime subscription will trigger loadGame which will place starting tiles
                });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [gameStartCountdown, gameId]);

  // Check if both players have joined and start countdown
  useEffect(() => {
    if (gameState && gameState.game_status === 'waiting' && gameState.player1_id && gameState.player2_id && gameStartCountdown === 0) {
      console.log('Starting countdown - both players joined');
      setGameStartCountdown(3);
    }
  }, [gameState?.player1_id, gameState?.player2_id, gameState?.game_status, gameStartCountdown]);

  const loadGame = async () => {
    if (!gameId) return;
    
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) throw error;
      
      if (data) {
        const gameData = {
          ...data,
          player1_grid: Array.isArray(data.player1_grid) ? data.player1_grid as Grid : createEmptyGrid(data.board_size || 5),
          player2_grid: Array.isArray(data.player2_grid) ? data.player2_grid as Grid : createEmptyGrid(data.board_size || 5),
          player1_cooldowns: typeof data.player1_cooldowns === 'object' && data.player1_cooldowns ? data.player1_cooldowns as Record<string, number> : {},
          player2_cooldowns: typeof data.player2_cooldowns === 'object' && data.player2_cooldowns ? data.player2_cooldowns as Record<string, number> : {},
          letter_pool: Array.isArray(data.letter_pool) ? data.letter_pool as string[] : ['A', 'B', 'C', 'D', 'E'],
          starting_tiles: Array.isArray(data.starting_tiles) ? data.starting_tiles as Array<{ row: number; col: number; letter: string }> : [],
        };
        
        setGameState(gameData);
        
        // Place starting tiles on grids when game becomes active
        if (data.game_status === 'active' && Array.isArray(data.starting_tiles) && data.starting_tiles.length > 0) {
          const shouldPlaceStartingTiles = gameData.player1_grid.every(row => row.every(cell => cell === null)) && 
                                          gameData.player2_grid.every(row => row.every(cell => cell === null));
          
          if (shouldPlaceStartingTiles) {
            placeStartingTiles(gameData);
          }
        }
        
        // Check if both players joined and start countdown
        if (data.game_status === 'waiting' && data.player1_id && data.player2_id && gameStartCountdown === 0) {
          setGameStartCountdown(3);
        }
        
        if (data.game_status === 'finished' && data.winner_id) {
          setShowWinnerDialog(true);
        }
      }
    } catch (error) {
      console.error('Error loading game:', error);
      toast({
        title: "Error",
        description: "Failed to load game",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createEmptyGrid = (size: number = 5): Grid => {
    return Array(size).fill(null).map(() => Array(size).fill(null));
  };

  const placeStartingTiles = async (gameData: GameState) => {
    if (!gameId || !gameData.starting_tiles || gameData.starting_tiles.length === 0) return;
    
    try {
      const newPlayer1Grid = gameData.player1_grid.map(row => [...row]);
      const newPlayer2Grid = gameData.player2_grid.map(row => [...row]);
      
      // Place starting tiles on both grids
      gameData.starting_tiles.forEach((tile: any) => {
        const { row, col, letter } = tile;
        if (row < gameData.board_size && col < gameData.board_size) {
          newPlayer1Grid[row][col] = { letter, player: 1 };
          newPlayer2Grid[row][col] = { letter, player: 2 };
        }
      });
      
      await supabase
        .from('games')
        .update({
          player1_grid: newPlayer1Grid,
          player2_grid: newPlayer2Grid,
        })
        .eq('id', gameId);
        
    } catch (error) {
      console.error('Error placing starting tiles:', error);
    }
  };

  // Get board size and game constants based on game state
  const boardSize = gameState?.board_size || 5;
  const COOLDOWN_TURNS = 5;
  const TURN_TIME = 30;
  const WINNING_SCORE = boardSize * boardSize; // Adjust winning score based on board size

  const isMyTurn = gameState?.current_player === playerNumber;
  const myGrid = playerNumber === 1 ? gameState?.player1_grid : gameState?.player2_grid;
  const opponentGrid = playerNumber === 1 ? gameState?.player2_grid : gameState?.player1_grid;
  const myCooldowns = playerNumber === 1 ? gameState?.player1_cooldowns : gameState?.player2_cooldowns;
  const myScore = playerNumber === 1 ? gameState?.player1_score : gameState?.player2_score;
  const opponentScore = playerNumber === 1 ? gameState?.player2_score : gameState?.player1_score;

  const isLetterOnCooldown = (letter: Letter): boolean => {
    if (!myCooldowns) return false;
    const cooldown = myCooldowns[letter];
    return cooldown !== undefined && cooldown > 0;
  };

  const getLetterCooldown = (letter: Letter): number => {
    return myCooldowns?.[letter] || 0;
  };

  const placeLetter = async (row: number, col: number) => {
    if (!selectedLetter || !gameState || !isMyTurn || !myGrid) return;
    
    if (myGrid[row][col] !== null) return; // Cell already occupied
    if (isLetterOnCooldown(selectedLetter)) return; // Letter on cooldown

    try {
      const dict = await loadDictionary();
      
      // Create updated grids
      const newMyGrid = myGrid.map(gridRow => [...gridRow]);
      newMyGrid[row][col] = { letter: selectedLetter, player: playerNumber };
      
      // Convert to simple grid format for scoring
      const simpleGrid = newMyGrid.map(row => 
        row.map(cell => cell ? cell.letter : null)
      );
      
      // Calculate new score
      const result = scoreGrid(simpleGrid, dict, new Set(), 3);
      
      // Update cooldowns - decrease all existing and add new one
      const newCooldowns: Record<string, number> = myCooldowns && typeof myCooldowns === 'object' ? { ...myCooldowns } : {};
      Object.keys(newCooldowns).forEach(letter => {
        if (newCooldowns[letter] > 0) {
          newCooldowns[letter]--;
          if (newCooldowns[letter] === 0) {
            delete newCooldowns[letter];
          }
        }
      });
      newCooldowns[selectedLetter] = COOLDOWN_TURNS;

      // Prepare update data
      const updateData: any = {
        current_player: playerNumber === 1 ? 2 : 1,
        turn_number: gameState.turn_number + 1,
      };

      if (playerNumber === 1) {
        updateData.player1_grid = newMyGrid;
        updateData.player1_score = result.score;
        updateData.player1_cooldowns = newCooldowns;
      } else {
        updateData.player2_grid = newMyGrid;
        updateData.player2_score = result.score;
        updateData.player2_cooldowns = newCooldowns;
      }

      // Check for winner
      if (result.score >= WINNING_SCORE) {
        updateData.game_status = 'finished';
        updateData.winner_id = playerNumber === 1 ? gameState.player1_id : gameState.player2_id;
      }

      const { error } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', gameId);

      if (error) throw error;

      setSelectedLetter('');
      
      if (result.score >= WINNING_SCORE) {
        setTimeout(() => setShowWinnerDialog(true), 500);
      }

    } catch (error) {
      console.error('Error making move:', error);
      toast({
        title: "Error",
        description: "Failed to make move",
        variant: "destructive",
      });
    }
  };

  const passTurn = async () => {
    if (!gameState || !gameId) return;

    try {
      const { error } = await supabase
        .from('games')
        .update({
          current_player: playerNumber === 1 ? 2 : 1,
          turn_number: gameState.turn_number + 1,
        })
        .eq('id', gameId);

      if (error) throw error;
    } catch (error) {
      console.error('Error passing turn:', error);
    }
  };

  const copyInviteLink = () => {
    if (!gameState) return;
    const link = `${window.location.origin}/multiplayer-join/${gameState.invite_code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    });
  };

  const renderGrid = (grid: Grid | undefined, isMyGrid: boolean) => {
    if (!grid) return null;

    return (
      <div className={`grid gap-0 p-4 rounded-lg ${
        isMyGrid && isMyTurn ? 'bg-gradient-card shadow-lg ring-2 ring-primary/20' : 'bg-card'
      }`} style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlaceLetter = isMyGrid && isMyTurn && selectedLetter && !cell;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-full aspect-square cursor-pointer flex items-center justify-center transition-all duration-200
                  ${isLightSquare ? 'bg-muted' : 'bg-muted-foreground/20'}
                  ${cell ? (isMyGrid ? 'bg-gradient-player-1' : 'bg-gradient-player-2') : ''}
                  ${canPlaceLetter ? 'hover:scale-105 hover:shadow-lg' : ''}
                `}
                onClick={() => isMyGrid && isMyTurn && placeLetter(rowIndex, colIndex)}
              >
                {cell && cell.letter && (
                  <span className="font-bold text-lg drop-shadow-lg text-white">
                    {cell.letter}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderAvailableLetters = () => {
    if (!gameState?.letter_pool) return null;
    
    return (
      <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-4 mx-auto mb-4 max-w-2xl">
        <div className="text-center mb-3">
          <span className="text-sm font-semibold text-muted-foreground">Available Letters</span>
        </div>
        <div className="flex justify-center gap-2">
          {gameState.letter_pool.map(letter => {
            const isOnCooldown = isLetterOnCooldown(letter);
            const isSelected = selectedLetter === letter;
            const cooldownTurns = getLetterCooldown(letter);
            
            return (
              <button
                key={letter}
                onClick={() => !isOnCooldown && isMyTurn && setSelectedLetter(letter)}
                disabled={isOnCooldown || !isMyTurn}
                className={`
                  relative rounded-lg font-bold transition-all duration-200 flex flex-col items-center justify-center
                  ${isOnCooldown ? 
                    'w-16 h-16 bg-destructive/20 text-destructive border-2 border-destructive/50 cursor-not-allowed' : 
                    'w-14 h-14'}
                  ${isSelected && !isOnCooldown ? 'bg-primary text-primary-foreground scale-110 shadow-lg' : ''}
                  ${!isOnCooldown && !isSelected && isMyTurn ? 'bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-105 border-2 border-border' : ''}
                  ${!isMyTurn ? 'opacity-50' : ''}
                `}
              >
                <span className={`${isOnCooldown ? 'text-lg' : 'text-xl'}`}>
                  {letter}
                </span>
                {isOnCooldown && (
                  <span className="text-xs font-normal">{cooldownTurns}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p>Game not found</p>
          <Button onClick={() => navigate('/multiplayer')}>
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen p-3 space-y-3 max-w-6xl mx-auto flex flex-col">
      {/* Winner Dialog */}
      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">
              🎉 Game Over! 🎉
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-center space-y-4">
                <div className="text-lg">
                  {gameState.winner_id === (playerNumber === 1 ? gameState.player1_id : gameState.player2_id) ? (
                    <span className="text-player-1 font-bold">You Win!</span>
                  ) : (
                    <span className="text-player-2 font-bold">Opponent Wins!</span>
                  )}
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-2">Final Scores:</div>
                  <div className="flex justify-center gap-8">
                    <div className="text-center">
                      <div className="text-sm font-medium">You</div>
                      <div className="text-2xl font-bold">{myScore}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">Opponent</div>
                      <div className="text-2xl font-bold">{opponentScore}</div>
                    </div>
                  </div>
                </div>
                
                <Button onClick={() => navigate('/multiplayer')} className="w-full" size="lg">
                  Back to Lobby
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/multiplayer')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Lobby
        </Button>
        
        <div className="text-center">
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            LETTUS Multiplayer
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>Code: {gameState.invite_code}</span>
            <Button variant="ghost" size="sm" onClick={copyInviteLink}>
              <Copy className="w-4 h-4" />
            </Button>
            <Badge variant="secondary">
              {boardSize}×{boardSize} {boardSize === 5 ? 'Classic' : boardSize === 7 ? 'Medium' : 'Large'}
            </Badge>
          </div>
        </div>
        
        <div className="text-right">
          <Badge variant={isMyTurn ? "default" : "secondary"}>
            {isMyTurn ? "Your Turn" : "Opponent's Turn"}
          </Badge>
        </div>
      </div>

      {/* Game Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-gradient-card">
          <div className="text-center">
            <div className="text-sm font-medium">You ({username})</div>
            <div className="text-xl font-bold">{myScore}</div>
          </div>
        </Card>
        
        <Card className="p-3 bg-gradient-card">
          <div className="text-center">
            <div className="text-sm font-medium">Turn {gameState.turn_number}</div>
            <div className="text-lg font-bold">
              {gameState.game_status === 'waiting' ? 'Waiting...' : 
               gameState.game_status === 'finished' ? 'Finished' : 
               isMyTurn ? 'Your Move' : 'Opponent Move'}
            </div>
            {gameState.game_status === 'active' && (
              <div className={`text-sm font-medium mt-1 ${timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>
                {timeLeft}s left
              </div>
            )}
          </div>
        </Card>
        
        <Card className="p-3 bg-gradient-card">
          <div className="text-center">
            <div className="text-sm font-medium">Opponent</div>
            <div className="text-xl font-bold">{opponentScore}</div>
          </div>
        </Card>
      </div>

      {/* Available Letters */}
      {(gameState.game_status === 'active' || gameState.game_status === 'waiting') && renderAvailableLetters()}

      {/* Game Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-center">Your Grid</h2>
          {renderGrid(myGrid, true)}
        </div>
        
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-center">Opponent's Grid</h2>
          {renderGrid(opponentGrid, false)}
        </div>
      </div>

      {/* Game Status */}
      {gameState.game_status === 'waiting' && gameStartCountdown === 0 && (
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-muted-foreground">
            Waiting for opponent to join. Share the invite code: <strong>{gameState.invite_code}</strong>
          </p>
        </div>
      )}
      
      {/* Game Start Countdown */}
      {gameStartCountdown > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-8 rounded-lg text-center space-y-4">
            <h2 className="text-2xl font-bold">Game Starting!</h2>
            <div className="text-6xl font-bold text-primary animate-pulse">
              {gameStartCountdown}
            </div>
            <p className="text-muted-foreground">Get ready to play!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiplayerGameBoard;