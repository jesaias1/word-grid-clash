import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { loadDictionary } from '@/lib/dictionary';
import { scoreGrid } from '@/lib/scoring';

type Player = 1 | 2;
type Letter = string;
type GridCell = Letter | null;
type Grid = GridCell[][];

interface CooldownState {
  [letter: string]: number;
}

interface MultiplayerGameState {
  id: string;
  player1_id: string;
  player2_id: string | null;
  grids: [Grid, Grid];
  currentPlayer: Player;
  turn: number;
  scores: [number, number];
  cooldowns: [CooldownState, CooldownState];
  gameEnded: boolean;
  winner: Player | null;
  usedWords: [Set<string>, Set<string>];
  scoredCells: [Set<string>, Set<string>];
  timeLeft: number;
  gameStatus: string;
  inviteCode: string;
}

interface MultiplayerGameBoardProps {
  gameId: string;
  onBackToLobby: () => void;
}

const GRID_ROWS = 5;
const GRID_COLS = 5;
const COOLDOWN_TURNS = 4;
const TURN_TIME = 30;

// Generate a random pool of letters for each game (12-15 letters)
const generateLetterPool = (): string[] => {
  const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const poolSize = Math.floor(Math.random() * 4) + 12; // 12-15 letters
  const pool: string[] = [];
  
  while (pool.length < poolSize) {
    const randomLetter = allLetters[Math.floor(Math.random() * allLetters.length)];
    if (!pool.includes(randomLetter)) {
      pool.push(randomLetter);
    }
  }
  
  return pool;
};

// Generate starting tiles - 5 predetermined letters, same for both players
const generateStartingTiles = (letterPool: string[]): Array<{ row: number; col: number; letter: string }> => {
  const tiles: Array<{ row: number; col: number; letter: string }> = [];
  
  // Pick 5 random letters from the pool for starting tiles
  const startingLetters = [];
  for (let i = 0; i < 5; i++) {
    const letter = letterPool[Math.floor(Math.random() * letterPool.length)];
    startingLetters.push(letter);
  }
  
  // Place one letter in each row at random column
  for (let row = 0; row < GRID_ROWS; row++) {
    const col = Math.floor(Math.random() * GRID_COLS);
    tiles.push({ row, col, letter: startingLetters[row] });
  }
  
  return tiles;
};

const MultiplayerGameBoard = ({ gameId, onBackToLobby }: MultiplayerGameBoardProps) => {
  const [gameState, setGameState] = useState<MultiplayerGameState | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<Letter>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playerNumber, setPlayerNumber] = useState<Player | null>(null);
  const { toast } = useToast();

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Load game state
  useEffect(() => {
    if (!gameId) return;
    loadGameState();
  }, [gameId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          console.log('Game updated:', payload);
          loadGameState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Timer effect
  useEffect(() => {
    if (!gameState || gameState.gameEnded || gameState.timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setGameState(prev => {
        if (!prev || prev.timeLeft <= 1) {
          // Time's up - automatically pass turn
          passTurn();
          return prev;
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.currentPlayer, gameState?.gameEnded, gameState?.timeLeft]);

  // Keyboard input effect
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!gameState || gameState.gameEnded || !isMyTurn()) return;
      
      const letter = event.key.toUpperCase();
      if (availableLetters.includes(letter) && !isLetterOnCooldown(letter)) {
        setSelectedLetter(letter);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState]);

  const [availableLetters, setAvailableLetters] = useState<string[]>([]);

  const loadGameState = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) throw error;
      if (!data) return;

      // Determine player number
      let playerNum: Player | null = null;
      if (currentUserId === data.player1_id) playerNum = 1;
      else if (currentUserId === data.player2_id) playerNum = 2;
      setPlayerNumber(playerNum);

      // Parse grids and other data
      const grids: [Grid, Grid] = [
        Array.isArray(data.player1_grid) && data.player1_grid.length > 0 
          ? data.player1_grid as Grid
          : Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null)),
        Array.isArray(data.player2_grid) && data.player2_grid.length > 0 
          ? data.player2_grid as Grid
          : Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))
      ];

      const cooldowns: [CooldownState, CooldownState] = [
        (data.player1_cooldowns && typeof data.player1_cooldowns === 'object' && !Array.isArray(data.player1_cooldowns)) 
          ? data.player1_cooldowns as CooldownState : {},
        (data.player2_cooldowns && typeof data.player2_cooldowns === 'object' && !Array.isArray(data.player2_cooldowns)) 
          ? data.player2_cooldowns as CooldownState : {}
      ];

      // Set available letters from database or generate and save if not set
      let gameLetters;
      if ((data as any).available_letters) {
        gameLetters = Array.isArray((data as any).available_letters) ? 
          (data as any).available_letters : 
          JSON.parse((data as any).available_letters);
      } else {
        // Generate new letter pool and starting tiles for new game
        gameLetters = generateLetterPool();
        const startingTiles = generateStartingTiles(gameLetters);
        
        // Initialize grids with starting tiles if they're empty
        if (!Array.isArray(data.player1_grid) || data.player1_grid.length === 0) {
          const grid1: Grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
          const grid2: Grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
          
          startingTiles.forEach(({ row, col, letter }) => {
            grid1[row][col] = letter;
            grid2[row][col] = letter;
          });
          
          // Update database with starting grids and letter pool
          await supabase
            .from('games')
            .update({
              player1_grid: grid1,
              player2_grid: grid2,
              available_letters: gameLetters
            })
            .eq('id', gameId);
            
          grids[0] = grid1;
          grids[1] = grid2;
        }
      }
      setAvailableLetters(gameLetters);

      setGameState({
        id: data.id,
        player1_id: data.player1_id,
        player2_id: data.player2_id,
        grids,
        currentPlayer: data.current_player as Player,
        turn: data.turn_number,
        scores: [data.player1_score, data.player2_score],
        cooldowns,
        gameEnded: data.game_status === 'finished',
        winner: data.winner_id === data.player1_id ? 1 : data.winner_id === data.player2_id ? 2 : null,
        usedWords: [new Set(), new Set()], // TODO: Load from database if needed
        scoredCells: [new Set(), new Set()], // TODO: Load from database if needed  
        timeLeft: TURN_TIME, // TODO: Calculate based on last update time
        gameStatus: data.game_status,
        inviteCode: data.invite_code
      });

    } catch (error) {
      console.error('Error loading game state:', error);
      toast({
        title: "Error",
        description: "Failed to load game state",
        variant: "destructive"
      });
    }
  };

  const isMyTurn = () => {
    return gameState && playerNumber === gameState.currentPlayer;
  };

  const isLetterOnCooldown = (letter: Letter): boolean => {
    if (!gameState || !playerNumber) return false;
    const playerCooldowns = gameState.cooldowns[playerNumber - 1];
    const cooldown = playerCooldowns[letter];
    return cooldown !== undefined && cooldown > 0;
  };

  const getLetterCooldown = (letter: Letter): number => {
    if (!gameState || !playerNumber) return 0;
    const playerCooldowns = gameState.cooldowns[playerNumber - 1];
    return playerCooldowns[letter] || 0;
  };

  const placeLetter = async (row: number, col: number, targetPlayerIndex: number) => {
    if (!selectedLetter || !gameState || gameState.gameEnded || !isMyTurn()) return;
    
    const targetGrid = gameState.grids[targetPlayerIndex];
    
    if (targetGrid[row][col] !== null) return; // Cell already occupied
    if (isLetterOnCooldown(selectedLetter)) return; // Letter on cooldown

    try {
      // Update local state optimistically
      const newGrids: [Grid, Grid] = [
        gameState.grids[0].map(row => [...row]),
        gameState.grids[1].map(row => [...row])
      ];
      
      newGrids[targetPlayerIndex][row][col] = selectedLetter;

      // Update cooldowns
      const newCooldowns: [CooldownState, CooldownState] = [
        { ...gameState.cooldowns[0] },
        { ...gameState.cooldowns[1] }
      ];

      // Decrease existing cooldowns for both players
      [0, 1].forEach(playerIdx => {
        Object.keys(newCooldowns[playerIdx]).forEach(letter => {
          if (newCooldowns[playerIdx][letter] > 0) {
            newCooldowns[playerIdx][letter]--;
            if (newCooldowns[playerIdx][letter] === 0) {
              delete newCooldowns[playerIdx][letter];
            }
          }
        });
      });

      // Set cooldown for used letter for both players
      newCooldowns[0][selectedLetter] = COOLDOWN_TURNS;
      newCooldowns[1][selectedLetter] = COOLDOWN_TURNS;

      // Calculate new scores
      const dict = await loadDictionary();
      const result1 = scoreGrid(newGrids[0], dict, gameState.usedWords[0], 3);
      const result2 = scoreGrid(newGrids[1], dict, gameState.usedWords[1], 3);

      // Check if game should end
      const areAllGridsFull = newGrids.every(grid => 
        grid.every(row => row.every(cell => cell !== null))
      );

      let newStatus = gameState.gameStatus;
      let winnerId = null;
      
      if (areAllGridsFull) {
        newStatus = 'finished';
        if (result1.score > result2.score) {
          winnerId = gameState.player1_id;
        } else if (result2.score > result1.score) {
          winnerId = gameState.player2_id;
        }
      }

      // Update database
      const { error } = await supabase
        .from('games')
        .update({
          player1_grid: newGrids[0],
          player2_grid: newGrids[1],
          player1_cooldowns: newCooldowns[0],
          player2_cooldowns: newCooldowns[1],
          player1_score: result1.score,
          player2_score: result2.score,
          current_player: gameState.currentPlayer === 1 ? 2 : 1,
          turn_number: gameState.turn + 1,
          game_status: newStatus,
          winner_id: winnerId
        })
        .eq('id', gameId);

      if (error) throw error;

      setSelectedLetter('');

    } catch (error) {
      console.error('Error placing letter:', error);
      toast({
        title: "Error",
        description: "Failed to place letter",
        variant: "destructive"
      });
    }
  };

  const passTurn = async () => {
    if (!gameState) return;

    try {
      const { error } = await supabase
        .from('games')
        .update({
          current_player: gameState.currentPlayer === 1 ? 2 : 1,
          turn_number: gameState.turn + 1
        })
        .eq('id', gameId);

      if (error) throw error;
    } catch (error) {
      console.error('Error passing turn:', error);
    }
  };

  const renderGrid = (playerIndex: number) => {
    if (!gameState) return null;

    const grid = gameState.grids[playerIndex];
    const isCurrentPlayer = gameState.currentPlayer === (playerIndex + 1);
    const scoredCells = gameState.scoredCells[playerIndex];
    const isWinner = gameState.gameEnded && gameState.winner === (playerIndex + 1);
    
    return (
      <div className={`grid grid-cols-5 gap-0 p-4 rounded-lg ${
        isCurrentPlayer ? 'bg-gradient-card shadow-lg ring-2 ring-primary/20' : 'bg-card'
      }`}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlaceLetter = !gameState.gameEnded && selectedLetter && !cell && isMyTurn();
            const isScored = scoredCells.has(`${rowIndex}-${colIndex}`);
            
            // Winner highlight effect
            const winnerHighlight = gameState.gameEnded && isScored 
              ? (isWinner ? 'ring-4 ring-yellow-400 shadow-lg shadow-yellow-400/50' : 'ring-2 ring-green-500')
              : (isScored ? 'ring-2 ring-green-500' : '');
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-full aspect-square cursor-pointer flex items-center justify-center transition-all duration-200
                  ${isLightSquare ? 'bg-muted' : 'bg-muted-foreground/20'}
                  ${cell ? (playerIndex === 0 ? 'bg-gradient-player-1' : 'bg-gradient-player-2') : ''}
                  ${canPlaceLetter ? 'hover:scale-105 hover:shadow-lg' : ''}
                  ${!isCurrentPlayer ? 'opacity-75' : ''}
                  ${winnerHighlight}
                `}
                onClick={() => canPlaceLetter && placeLetter(rowIndex, colIndex, playerIndex)}
              >
                {cell && (
                  <span className="font-bold text-lg drop-shadow-lg text-white">
                    {cell}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderLetterCooldowns = () => {
    if (!gameState || !playerNumber) return null;

    const playerCooldowns = gameState.cooldowns[playerNumber - 1];
    const onCooldownLetters = availableLetters.filter(letter => {
      const cooldown = playerCooldowns[letter];
      return cooldown !== undefined && cooldown > 0;
    });
    
    if (onCooldownLetters.length === 0) return null;
    
    return (
      <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-4 mx-auto mb-4 max-w-2xl">
        <div className="text-center mb-2">
          <span className="text-sm font-semibold text-muted-foreground">Letters on Cooldown</span>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {onCooldownLetters.map(letter => (
            <div key={letter} className="bg-muted/50 rounded-lg p-3 border border-muted-foreground/20">
              <div className="text-3xl font-bold text-muted-foreground/60 text-center mb-1">
                {letter}
              </div>
              <div className="text-xs text-center text-muted-foreground">
                {getLetterCooldown(letter)} turns
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!gameState) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading game...</div>
        </div>
      </div>
    );
  }

  if (gameState.gameStatus === 'waiting') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Waiting for player 2...</h2>
          <div className="text-lg font-mono bg-muted p-4 rounded-lg">
            Game Code: <span className="text-accent font-bold">{gameState.inviteCode}</span>
          </div>
          <p className="text-muted-foreground">Share this code with a friend to start playing!</p>
          <Button onClick={onBackToLobby} variant="outline">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen p-3 space-y-3 max-w-6xl mx-auto flex flex-col">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS - Online Game
        </h1>
        <p className="text-xs text-muted-foreground">
          Game Code: {gameState.inviteCode} | You are Player {playerNumber}
        </p>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Player Scores */}
        <Card className="p-3 bg-gradient-card">
          <div className="flex justify-center items-center gap-8">
            <div className={`text-center ${gameState.currentPlayer === 1 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-1">Player 1</div>
              <div className="text-xl font-bold">{gameState.scores[0]}</div>
              {playerNumber === 1 && <div className="text-xs text-accent">You</div>}
            </div>
            <div className={`text-center ${gameState.currentPlayer === 2 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-2">Player 2</div>
              <div className="text-xl font-bold">{gameState.scores[1]}</div>
              {playerNumber === 2 && <div className="text-xs text-accent">You</div>}
            </div>
          </div>
        </Card>

        {/* Timer and Turn Info */}
        <Card className="p-3 bg-gradient-card">
          <div className="text-center space-y-1">
            {gameState.gameEnded ? (
              <div className="space-y-1">
                <div className="text-sm font-bold text-accent">
                  {gameState.winner ? `Player ${gameState.winner} Wins!` : "Tie!"}
                </div>
                <Button onClick={onBackToLobby} variant="default" size="sm">
                  Back to Lobby
                </Button>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">Turn {gameState.turn}</div>
                <div className="text-sm font-semibold">
                  <span className={gameState.currentPlayer === 1 ? 'text-player-1' : 'text-player-2'}>
                    Player {gameState.currentPlayer}
                    {isMyTurn() && <span className="text-accent"> (Your turn)</span>}
                  </span>
                </div>
                <div className={`text-lg font-bold ${gameState.timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-accent'}`}>
                  {gameState.timeLeft}s
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Selected Letter */}
        <Card className="p-3 bg-gradient-card">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Selected</div>
            <div className="text-2xl font-bold text-accent">
              {selectedLetter || '?'}
            </div>
            {!isMyTurn() && !gameState.gameEnded && (
              <div className="text-xs text-muted-foreground">Wait your turn</div>
            )}
          </div>
        </Card>
      </div>

      {/* Cooldown Letters Display */}
      {renderLetterCooldowns()}

      {/* Game Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-1 text-center">
            Player 1 Grid {playerNumber === 1 && '(You)'}
          </h2>
          {renderGrid(0)}
        </div>
        
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-2 text-center">
            Player 2 Grid {playerNumber === 2 && '(You)'}
          </h2>
          {renderGrid(1)}
        </div>
      </div>

      {/* Compact Rules */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          30s per turn • Type letter then click to place • 3+ letter words • Score = letters in valid words
        </div>
      </div>
    </div>
  );
};

export default MultiplayerGameBoard;