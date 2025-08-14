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

// Generate starting tiles - one per row, same for both players
const generateStartingTiles = (letterPool: string[]): Array<{ row: number; col: number; letter: string }> => {
  const tiles: Array<{ row: number; col: number; letter: string }> = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const col = Math.floor(Math.random() * GRID_COLS);
    const letter = letterPool[Math.floor(Math.random() * letterPool.length)];
    tiles.push({ row, col, letter });
  }
  return tiles;
};

const GameBoard = () => {
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);

  // Initialize game with starting tiles
  const initializeGame = () => {
    const letterPool = generateLetterPool();
    setAvailableLetters(letterPool);
    const startingTiles = generateStartingTiles(letterPool);
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

  // Keyboard input effect
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (gameState.gameEnded) return;
      
      const letter = event.key.toUpperCase();
      if (availableLetters.includes(letter) && !isLetterOnCooldown(letter)) {
        setSelectedLetter(letter);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState.gameEnded, gameState.sharedCooldowns]);

  

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
    const isWinner = gameState.gameEnded && gameState.winner === (playerIndex + 1);
    
    return (
      <div className={`grid grid-cols-5 gap-0 p-4 rounded-lg ${
        isCurrentPlayer ? 'bg-gradient-card shadow-lg ring-2 ring-primary/20' : 'bg-card'
      }`}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlaceLetter = !gameState.gameEnded && selectedLetter && !cell;
            const isScored = scoredCells.has(`${rowIndex}-${colIndex}`);
            
            // Winner highlight effect - bright gold/yellow for winner, green for others
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
                onClick={() => !gameState.gameEnded && placeLetter(rowIndex, colIndex, playerIndex)}
              >
                {cell && (
                  <span className={`font-bold text-lg drop-shadow-lg ${isScored ? 'text-white' : 'text-white'}`}>
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
    const onCooldownLetters = availableLetters.filter(letter => isLetterOnCooldown(letter));
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

  return (
    <div className="h-screen p-3 space-y-3 max-w-6xl mx-auto flex flex-col">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS
        </h1>
        <p className="text-xs text-muted-foreground">Type a letter, then click to place it</p>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Player Scores */}
        <Card className="p-3 bg-gradient-card">
          <div className="flex justify-center items-center gap-8">
            <div className={`text-center ${gameState.currentPlayer === 1 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-1">Player 1</div>
              <div className="text-xl font-bold">{gameState.scores[0]}</div>
            </div>
            <div className={`text-center ${gameState.currentPlayer === 2 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-2">Player 2</div>
              <div className="text-xl font-bold">{gameState.scores[1]}</div>
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
                <Button onClick={resetGame} variant="default" size="sm">
                  New Game
                </Button>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">Turn {gameState.turn}</div>
                <div className="text-sm font-semibold">
                  <span className={gameState.currentPlayer === 1 ? 'text-player-1' : 'text-player-2'}>
                    Player {gameState.currentPlayer}
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
          </div>
        </Card>

        {/* Empty slot to maintain grid layout */}
        <div></div>
      </div>

      {/* Cooldown Letters Display */}
      {renderLetterCooldowns()}

      {/* Game Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-1 text-center">Player 1 Grid</h2>
          {renderGrid(0)}
        </div>
        
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-2 text-center">Player 2 Grid</h2>
          {renderGrid(1)}
        </div>
      </div>

      {/* Compact Rules */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          30s per turn • 3+ letter words • Each word once per player • Score = letters in valid words
        </div>
      </div>
    </div>
  );
};

export default GameBoard;