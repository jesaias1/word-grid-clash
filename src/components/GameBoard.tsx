import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { loadDictionary } from '@/lib/dictionary';
import { scoreGrid } from '@/lib/scoring';

type Player = 1 | 2;
type Letter = string;
type GridCell = Letter | null;
type Grid = GridCell[][];

interface CooldownState {
  [letter: string]: number;
}

interface GameState {
  grids: [Grid, Grid];
  currentPlayer: Player;
  turn: number;
  scores: [number, number];
  sharedCooldowns: CooldownState; // Shared cooldowns for both players
  gameEnded: boolean;
  winner: Player | null;
  usedWords: [Set<string>, Set<string>]; // Track used words per player
  scoredCells: [Set<string>, Set<string>]; // Track which cells contribute to score per player
  timeLeft: number; // Time left in current turn (seconds)
}

const GRID_ROWS = 5;
const GRID_COLS = 5;
const COOLDOWN_TURNS = 4;
const TURN_TIME = 30; // 30 seconds per turn

// High-playability letters for starting tiles
const HIGH_PLAYABILITY_LETTERS = ['A', 'E', 'S', 'T', 'N', 'R', 'L'];

// Generate starting tiles - one per row, same for both players
const generateStartingTiles = (): Array<{ row: number; col: number; letter: string }> => {
  const tiles: Array<{ row: number; col: number; letter: string }> = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const col = Math.floor(Math.random() * GRID_COLS);
    const letter = HIGH_PLAYABILITY_LETTERS[Math.floor(Math.random() * HIGH_PLAYABILITY_LETTERS.length)];
    tiles.push({ row, col, letter });
  }
  return tiles;
};

const GameBoard = () => {
  // Initialize game with starting tiles
  const initializeGame = () => {
    const startingTiles = generateStartingTiles();
    const grid1: Grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    const grid2: Grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    
    // Place starting tiles on both grids
    startingTiles.forEach(({ row, col, letter }) => {
      grid1[row][col] = letter;
      grid2[row][col] = letter;
    });
    
    return {
      grids: [grid1, grid2] as [Grid, Grid],
      currentPlayer: 1 as Player,
      turn: 1,
      scores: [0, 0] as [number, number],
      sharedCooldowns: {} as CooldownState,
      gameEnded: false,
      winner: null as Player | null,
      usedWords: [new Set<string>(), new Set<string>()] as [Set<string>, Set<string>],
      scoredCells: [new Set<string>(), new Set<string>()] as [Set<string>, Set<string>],
      timeLeft: TURN_TIME
    };
  };

  const [gameState, setGameState] = useState<GameState>(initializeGame());

  const [selectedLetter, setSelectedLetter] = useState<Letter>('');

  // Preload dictionary in the background
  useEffect(() => {
    loadDictionary();
  }, []);

  // Timer effect
  useEffect(() => {
    if (gameState.gameEnded || gameState.timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 1) {
          // Time's up - automatically pass turn
          return {
            ...prev,
            currentPlayer: prev.currentPlayer === 1 ? 2 : 1,
            turn: prev.turn + 1,
            timeLeft: TURN_TIME
          };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.currentPlayer, gameState.gameEnded, gameState.timeLeft]);

  const availableLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const isLetterOnCooldown = (letter: Letter): boolean => {
    const cooldown = gameState.sharedCooldowns[letter];
    return cooldown !== undefined && cooldown > 0;
  };

  const getLetterCooldown = (letter: Letter): number => {
    return gameState.sharedCooldowns[letter] || 0;
  };

  const placeLetter = (row: number, col: number, targetPlayerIndex: number) => {
    if (!selectedLetter || gameState.gameEnded) return;
    
    const targetGrid = gameState.grids[targetPlayerIndex];
    
    if (targetGrid[row][col] !== null) return; // Cell already occupied
    if (isLetterOnCooldown(selectedLetter)) return; // Letter on shared cooldown

    setGameState(prev => {
      const newGrids: [Grid, Grid] = [
        prev.grids[0].map(row => [...row]),
        prev.grids[1].map(row => [...row])
      ];
      
      // Place the letter on the target grid
      newGrids[targetPlayerIndex][row][col] = selectedLetter;
      
      // Update scores (only current player gets points)
      const currentPlayerIndex = prev.currentPlayer - 1;
      const newScores: [number, number] = [...prev.scores];
      newScores[currentPlayerIndex]++;
      
      // Update shared cooldowns
      const newSharedCooldowns: CooldownState = { ...prev.sharedCooldowns };
      
      // Decrease existing shared cooldowns each turn
      Object.keys(newSharedCooldowns).forEach(letter => {
        if (newSharedCooldowns[letter] > 0) {
          newSharedCooldowns[letter]--;
          if (newSharedCooldowns[letter] === 0) {
            delete newSharedCooldowns[letter];
          }
        }
      });
      
      // Set cooldown for used letter (affects both players) AFTER decrement so it starts at full duration
      newSharedCooldowns[selectedLetter] = COOLDOWN_TURNS;

      // Check if both grids are full (game ends when no empty tiles left for either player)
      const areAllGridsFull = newGrids.every(grid => 
        grid.every(row => row.every(cell => cell !== null))
      );
      
      let gameEnded = false;
      let winner: Player | null = null;
      
      if (areAllGridsFull) {
        gameEnded = true;
        winner = newScores[0] > newScores[1] ? 1 : newScores[1] > newScores[0] ? 2 : null;
      }

      return {
        ...prev,
        grids: newGrids,
        currentPlayer: prev.currentPlayer === 1 ? 2 : 1,
        turn: prev.turn + 1,
        scores: newScores,
        sharedCooldowns: newSharedCooldowns,
        gameEnded,
        winner,
        usedWords: prev.usedWords,
        scoredCells: prev.scoredCells,
        timeLeft: TURN_TIME // Reset timer for next player
      };
    });

    setSelectedLetter('');
  };

  const resetGame = () => {
    setGameState(initializeGame());
    setSelectedLetter('');
  };

  // Compute scores based on valid words whenever grids change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dict = await loadDictionary();
      if (cancelled) return;
      
      const result1 = scoreGrid(gameState.grids[0], dict, gameState.usedWords[0], 3);
      const result2 = scoreGrid(gameState.grids[1], dict, gameState.usedWords[1], 3);
      
      setGameState(prev => ({
        ...prev,
        scores: [result1.score, result2.score],
        usedWords: [result1.newUsedWords, result2.newUsedWords],
        scoredCells: [result1.scoredCells, result2.scoredCells],
        winner: prev.gameEnded ? (result1.score > result2.score ? 1 : result2.score > result1.score ? 2 : null) : prev.winner,
      }));
    })();
    return () => { cancelled = true; };
  }, [gameState.grids]);

  const renderGrid = (playerIndex: number) => {
    const grid = gameState.grids[playerIndex];
    const isCurrentPlayer = gameState.currentPlayer === (playerIndex + 1);
    const scoredCells = gameState.scoredCells[playerIndex];
    
    return (
      <div className={`grid grid-cols-5 gap-0 p-4 rounded-lg ${
        isCurrentPlayer ? 'bg-gradient-card shadow-lg ring-2 ring-primary/20' : 'bg-card'
      }`}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlaceLetter = !gameState.gameEnded && selectedLetter && !cell;
            const isScored = scoredCells.has(`${rowIndex}-${colIndex}`);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-full aspect-square cursor-pointer flex items-center justify-center transition-all duration-200
                  ${isLightSquare ? 'bg-muted' : 'bg-muted-foreground/20'}
                  ${cell ? 'letter-tile' : ''}
                  ${canPlaceLetter ? 'hover:scale-105 hover:shadow-lg' : ''}
                  ${!isCurrentPlayer ? 'opacity-75' : ''}
                  ${isScored ? 'ring-2 ring-accent ring-inset' : ''}
                `}
                onClick={() => !gameState.gameEnded && placeLetter(rowIndex, colIndex, playerIndex)}
              >
                {cell && (
                  <span className={`font-bold text-lg drop-shadow-lg ${isScored ? 'text-accent-foreground' : 'text-white'}`}>
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

  const renderLetterSelector = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center">
          Player {gameState.currentPlayer} - Choose a Letter
        </h3>
        <div className="grid grid-cols-6 gap-0 overflow-hidden rounded-md border border-border">
          {availableLetters.map(letter => {
            const onCooldown = isLetterOnCooldown(letter);
            const cooldownTurns = getLetterCooldown(letter);
            
            return (
              <Button
                key={letter}
                variant={selectedLetter === letter ? "default" : "outline"}
                disabled={onCooldown || gameState.gameEnded}
                onClick={() => setSelectedLetter(letter)}
                className={`
                  relative w-full aspect-square rounded-none p-0 flex items-center justify-center
                  ${onCooldown ? 'opacity-50 cursor-not-allowed' : ''}
                  ${selectedLetter === letter ? 'ring-2 ring-primary' : ''}
                `}
              >
                <span className="font-bold">{letter}</span>
                {onCooldown && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-2 -right-2 w-6 h-6 text-xs p-0 flex items-center justify-center cooldown-indicator"
                  >
                    {cooldownTurns}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-2 space-y-3 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS
        </h1>
        <p className="text-sm text-muted-foreground">The Ultimate Duel of Wits and Words</p>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Player Scores */}
        <Card className="p-4 bg-gradient-card">
          <div className="flex justify-between items-center">
            <div className={`text-center ${gameState.currentPlayer === 1 ? 'score-glow' : ''}`}>
              <div className="text-lg font-bold text-player-1">Player 1</div>
              <div className="text-2xl font-bold">{gameState.scores[0]}</div>
            </div>
            <div className={`text-center ${gameState.currentPlayer === 2 ? 'score-glow' : ''}`}>
              <div className="text-lg font-bold text-player-2">Player 2</div>
              <div className="text-2xl font-bold">{gameState.scores[1]}</div>
            </div>
          </div>
        </Card>

        {/* Timer and Turn Info */}
        <Card className="p-4 bg-gradient-card">
          <div className="text-center space-y-2">
            {gameState.gameEnded ? (
              <div className="space-y-2">
                <div className="text-lg font-bold text-accent">
                  {gameState.winner ? `Player ${gameState.winner} Wins!` : "It's a Tie!"}
                </div>
                <Button onClick={resetGame} variant="default" size="sm">
                  New Game
                </Button>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">Turn {gameState.turn}</div>
                <div className="text-lg font-semibold">
                  <span className={gameState.currentPlayer === 1 ? 'text-player-1' : 'text-player-2'}>
                    Player {gameState.currentPlayer}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${gameState.timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-accent'}`}>
                  {gameState.timeLeft}s
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Game Rules */}
        <Card className="p-4 bg-gradient-card">
          <h3 className="text-sm font-semibold mb-2">Rules</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• 30s per turn to place a letter</div>
            <div>• 3+ letter words only</div>
            <div>• Each word usable once per player</div>
            <div>• Score = letters in valid words</div>
          </div>
        </Card>
      </div>

      {/* Game Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-player-1 text-center">Player 1 Grid</h2>
          {renderGrid(0)}
        </div>
        
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-player-2 text-center">Player 2 Grid</h2>
          {renderGrid(1)}
        </div>
      </div>

      {/* Letter Selector */}
      {!gameState.gameEnded && (
        <Card className="p-4 bg-gradient-card">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-center">
              Player {gameState.currentPlayer} - Choose a Letter
            </h3>
            <div className="grid grid-cols-13 gap-1 max-w-4xl mx-auto">
              {availableLetters.map(letter => {
                const onCooldown = isLetterOnCooldown(letter);
                const cooldownTurns = getLetterCooldown(letter);
                
                return (
                  <Button
                    key={letter}
                    variant={selectedLetter === letter ? "default" : "outline"}
                    disabled={onCooldown || gameState.gameEnded}
                    onClick={() => setSelectedLetter(letter)}
                    className={`
                      relative w-full aspect-square rounded-none p-0 flex items-center justify-center text-xs
                      ${onCooldown ? 'opacity-50 cursor-not-allowed' : ''}
                      ${selectedLetter === letter ? 'ring-2 ring-primary' : ''}
                    `}
                  >
                    <span className="font-bold">{letter}</span>
                    {onCooldown && (
                      <Badge 
                        variant="secondary" 
                        className="absolute -top-1 -right-1 w-4 h-4 text-xs p-0 flex items-center justify-center cooldown-indicator"
                      >
                        {cooldownTurns}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GameBoard;