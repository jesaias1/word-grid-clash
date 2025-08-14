
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

interface LocalMultiplayerBoardProps {
  onBackToMenu: () => void;
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

const LocalMultiplayerBoard = ({ onBackToMenu }: LocalMultiplayerBoardProps) => {
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [grids, setGrids] = useState<[Grid, Grid]>([
    Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null)),
    Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))
  ]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [turn, setTurn] = useState(1);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [cooldowns, setCooldowns] = useState<[CooldownState, CooldownState]>([{}, {}]);
  const [selectedLetter, setSelectedLetter] = useState<Letter>('');
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [usedWords] = useState<[Set<string>, Set<string>]>([new Set(), new Set()]);
  const [scoredCells] = useState<[Set<string>, Set<string>]>([new Set(), new Set()]);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);

  // Initialize letters on first load
  useEffect(() => {
    setAvailableLetters(generateLetterPool());
  }, []);

  // Timer effect
  useEffect(() => {
    if (gameEnded || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - pass turn
          passTurn();
          return TURN_TIME;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentPlayer, gameEnded, timeLeft]);

  // Keyboard input effect
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (gameEnded) return;
      
      const letter = event.key.toUpperCase();
      if (availableLetters.includes(letter) && !isLetterOnCooldown(letter)) {
        setSelectedLetter(letter);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cooldowns, currentPlayer, gameEnded]);

  const isLetterOnCooldown = (letter: Letter): boolean => {
    const playerCooldowns = cooldowns[currentPlayer - 1];
    const cooldown = playerCooldowns[letter];
    return cooldown !== undefined && cooldown > 0;
  };

  const getLetterCooldown = (letter: Letter): number => {
    const playerCooldowns = cooldowns[currentPlayer - 1];
    return playerCooldowns[letter] || 0;
  };

  const placeLetter = async (row: number, col: number, targetPlayerIndex: number) => {
    if (!selectedLetter || gameEnded) return;
    
    const targetGrid = grids[targetPlayerIndex];
    
    if (targetGrid[row][col] !== null) return; // Cell already occupied
    if (isLetterOnCooldown(selectedLetter)) return; // Letter on cooldown

    try {
      // Update grids
      const newGrids: [Grid, Grid] = [
        grids[0].map(row => [...row]),
        grids[1].map(row => [...row])
      ];
      
      newGrids[targetPlayerIndex][row][col] = selectedLetter;

      // Update cooldowns
      const newCooldowns: [CooldownState, CooldownState] = [
        { ...cooldowns[0] },
        { ...cooldowns[1] }
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
      const result1 = scoreGrid(newGrids[0], dict, usedWords[0], 3);
      const result2 = scoreGrid(newGrids[1], dict, usedWords[1], 3);

      // Check if game should end
      const areAllGridsFull = newGrids.every(grid => 
        grid.every(row => row.every(cell => cell !== null))
      );

      if (areAllGridsFull) {
        setGameEnded(true);
        if (result1.score > result2.score) {
          setWinner(1);
        } else if (result2.score > result1.score) {
          setWinner(2);
        }
      }

      // Update state
      setGrids(newGrids);
      setCooldowns(newCooldowns);
      setScores([result1.score, result2.score]);
      setSelectedLetter('');
      
      // Pass turn
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      setTurn(turn + 1);
      setTimeLeft(TURN_TIME);

    } catch (error) {
      console.error('Error placing letter:', error);
    }
  };

  const passTurn = () => {
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    setTurn(turn + 1);
    setTimeLeft(TURN_TIME);
  };

  const resetGame = () => {
    setAvailableLetters(generateLetterPool());
    setGrids([
      Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null)),
      Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))
    ]);
    setCurrentPlayer(1);
    setTurn(1);
    setScores([0, 0]);
    setCooldowns([{}, {}]);
    setSelectedLetter('');
    setGameEnded(false);
    setWinner(null);
    setTimeLeft(TURN_TIME);
  };

  const renderGrid = (playerIndex: number) => {
    const grid = grids[playerIndex];
    const isCurrentPlayer = currentPlayer === (playerIndex + 1);
    const scoredCells = new Set<string>(); // For now, empty set
    const isWinner = gameEnded && winner === (playerIndex + 1);
    
    return (
      <div className={`grid grid-cols-5 gap-0 p-4 rounded-lg ${
        isCurrentPlayer ? 'bg-gradient-card shadow-lg ring-2 ring-primary/20' : 'bg-card'
      }`}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlaceLetter = !gameEnded && selectedLetter && !cell;
            const isScored = scoredCells.has(`${rowIndex}-${colIndex}`);
            
            // Winner highlight effect
            const winnerHighlight = gameEnded && isScored 
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
    const playerCooldowns = cooldowns[currentPlayer - 1];
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

  return (
    <div className="h-screen p-3 space-y-3 max-w-6xl mx-auto flex flex-col">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS - Local Multiplayer
        </h1>
        <p className="text-xs text-muted-foreground">
          Pass the device between players
        </p>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Player Scores */}
        <Card className="p-3 bg-gradient-card">
          <div className="flex justify-center items-center gap-8">
            <div className={`text-center ${currentPlayer === 1 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-1">Player 1</div>
              <div className="text-xl font-bold">{scores[0]}</div>
            </div>
            <div className={`text-center ${currentPlayer === 2 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-2">Player 2</div>
              <div className="text-xl font-bold">{scores[1]}</div>
            </div>
          </div>
        </Card>

        {/* Timer and Turn Info */}
        <Card className="p-3 bg-gradient-card">
          <div className="text-center space-y-1">
            {gameEnded ? (
              <div className="space-y-1">
                <div className="text-sm font-bold text-accent">
                  {winner ? `Player ${winner} Wins!` : "Tie!"}
                </div>
                <div className="flex gap-2">
                  <Button onClick={resetGame} variant="outline" size="sm">
                    New Game
                  </Button>
                  <Button onClick={onBackToMenu} variant="default" size="sm">
                    Back to Menu
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">Turn {turn}</div>
                <div className="text-sm font-semibold">
                  <span className={currentPlayer === 1 ? 'text-player-1' : 'text-player-2'}>
                    Player {currentPlayer}'s Turn
                  </span>
                </div>
                <div className={`text-lg font-bold ${timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-accent'}`}>
                  {timeLeft}s
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
            <Button onClick={passTurn} variant="outline" size="sm" className="mt-2">
              Pass Turn
            </Button>
          </div>
        </Card>
      </div>

      {/* Cooldown Letters Display */}
      {renderLetterCooldowns()}

      {/* Game Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-1 text-center">
            Player 1 Grid
          </h2>
          {renderGrid(0)}
        </div>
        
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-2 text-center">
            Player 2 Grid
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

export default LocalMultiplayerBoard;
