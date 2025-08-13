import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
}

const GRID_ROWS = 5;
const GRID_COLS = 5;
const COOLDOWN_TURNS = 3;

const GameBoard = () => {
  const [gameState, setGameState] = useState<GameState>({
    grids: [
      Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null)),
      Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))
    ],
    currentPlayer: 1,
    turn: 1,
    scores: [0, 0],
    sharedCooldowns: {}, // Single shared cooldown object
    gameEnded: false,
    winner: null
  });

  const [selectedLetter, setSelectedLetter] = useState<Letter>('');

  const availableLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const isLetterOnCooldown = (letter: Letter): boolean => {
    const cooldown = gameState.sharedCooldowns[letter];
    return cooldown !== undefined && cooldown > 0;
  };

  const getLetterCooldown = (letter: Letter): number => {
    return gameState.sharedCooldowns[letter] || 0;
  };

  const placeLetter = (row: number, col: number) => {
    if (!selectedLetter || gameState.gameEnded) return;
    
    const playerIndex = gameState.currentPlayer - 1;
    const grid = gameState.grids[playerIndex];
    
    if (grid[row][col] !== null) return; // Cell already occupied
    if (isLetterOnCooldown(selectedLetter)) return; // Letter on shared cooldown

    setGameState(prev => {
      const newGrids: [Grid, Grid] = [
        prev.grids[0].map(row => [...row]),
        prev.grids[1].map(row => [...row])
      ];
      
      // Place the letter
      newGrids[playerIndex][row][col] = selectedLetter;
      
      // Update scores
      const newScores: [number, number] = [...prev.scores];
      newScores[playerIndex]++;
      
      // Update shared cooldowns
      const newSharedCooldowns: CooldownState = { ...prev.sharedCooldowns };
      
      // Set cooldown for used letter (affects both players)
      newSharedCooldowns[selectedLetter] = COOLDOWN_TURNS;
      
      // Decrease all shared cooldowns each turn
      Object.keys(newSharedCooldowns).forEach(letter => {
        if (newSharedCooldowns[letter] > 0) {
          newSharedCooldowns[letter]--;
          if (newSharedCooldowns[letter] === 0) {
            delete newSharedCooldowns[letter];
          }
        }
      });

      // Check if grid is full
      const isGridFull = newGrids[playerIndex].every(row => 
        row.every(cell => cell !== null)
      );
      
      let gameEnded = false;
      let winner: Player | null = null;
      
      if (isGridFull) {
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
        winner
      };
    });

    setSelectedLetter('');
  };

  const resetGame = () => {
    setGameState({
      grids: [
        Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null)),
        Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))
      ],
      currentPlayer: 1,
      turn: 1,
      scores: [0, 0],
      sharedCooldowns: {}, // Reset shared cooldowns
      gameEnded: false,
      winner: null
    });
    setSelectedLetter('');
  };

  const renderGrid = (playerIndex: number) => {
    const grid = gameState.grids[playerIndex];
    const isCurrentPlayer = gameState.currentPlayer === (playerIndex + 1);
    
    return (
      <div className={`grid grid-cols-5 gap-0 p-4 rounded-lg ${
        isCurrentPlayer ? 'bg-gradient-card shadow-lg ring-2 ring-primary/20' : 'bg-card'
      }`}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`
                w-12 h-12 grid-cell rounded-md cursor-pointer flex items-center justify-center
                ${cell ? 'letter-tile' : ''}
                ${isCurrentPlayer && selectedLetter && !cell ? 'hover:scale-105 hover:shadow-lg' : ''}
                ${!isCurrentPlayer ? 'opacity-75' : ''}
              `}
              onClick={() => isCurrentPlayer && placeLetter(rowIndex, colIndex)}
            >
              {cell && (
                <span className="font-bold text-lg text-white drop-shadow-lg">
                  {cell}
                </span>
              )}
            </div>
          ))
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
        <div className="grid grid-cols-6 gap-2">
          {availableLetters.map(letter => {
            const onCooldown = isLetterOnCooldown(letter);
            const cooldownTurns = getLetterCooldown(letter);
            
            return (
              <Button
                key={letter}
                variant={selectedLetter === letter ? "default" : "outline"}
                size="sm"
                disabled={onCooldown || gameState.gameEnded}
                onClick={() => setSelectedLetter(letter)}
                className={`
                  relative h-12 
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
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS
        </h1>
        <p className="text-muted-foreground">The Ultimate Duel of Wits and Words</p>
      </div>

      {/* Game Stats */}
      <Card className="p-6 bg-gradient-card">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="flex gap-8">
              <div className={`text-center ${gameState.currentPlayer === 1 ? 'score-glow' : ''}`}>
                <div className="text-2xl font-bold text-player-1">Player 1</div>
                <div className="text-3xl font-bold">{gameState.scores[0]}</div>
              </div>
              <div className={`text-center ${gameState.currentPlayer === 2 ? 'score-glow' : ''}`}>
                <div className="text-2xl font-bold text-player-2">Player 2</div>
                <div className="text-3xl font-bold">{gameState.scores[1]}</div>
              </div>
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">Turn {gameState.turn}</div>
            {gameState.gameEnded ? (
              <div className="space-y-2">
                <div className="text-xl font-bold text-accent">
                  {gameState.winner ? `Player ${gameState.winner} Wins!` : "It's a Tie!"}
                </div>
                <Button onClick={resetGame} variant="default">
                  New Game
                </Button>
              </div>
            ) : (
              <div className="text-lg font-semibold">
                Current Player: <span className={gameState.currentPlayer === 1 ? 'text-player-1' : 'text-player-2'}>
                  Player {gameState.currentPlayer}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Game Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-player-1 text-center">Player 1 Grid</h2>
          {renderGrid(0)}
        </div>
        
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-player-2 text-center">Player 2 Grid</h2>
          {renderGrid(1)}
        </div>
      </div>

      {/* Letter Selector */}
      {!gameState.gameEnded && (
        <Card className="p-6 bg-gradient-card">
          {renderLetterSelector()}
        </Card>
      )}

      {/* Game Rules */}
      <Card className="p-6 bg-gradient-card">
        <h3 className="text-lg font-semibold mb-4">Game Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            • Each player has a 5×5 grid (25 spaces)
            • Place 1 letter per turn in any empty space
            • Each letter placed = 1 point
          </div>
          <div>
            • When ANY player uses a letter, BOTH players can't use it for 3 turns
            • Game ends when one grid is full
            • Highest score wins the duel!
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GameBoard;