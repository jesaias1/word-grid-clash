
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { loadDictionary } from '@/lib/dictionary';
import { scoreGrid } from '@/lib/scoring';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';

type Player = number;
type Letter = string;
type GridCell = Letter | null;
type Grid = GridCell[][];

interface CooldownState {
  [letter: string]: number;
}

interface LocalMultiplayerBoardProps {
  onBackToMenu: () => void;
  boardSize?: number;
  playerCount?: number;
  cooldownTurns?: number;
}

const TURN_TIME = 30;

// Use the full alphabet for local multiplayer
const generateLetterPool = (): string[] => {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
};

// Generate starting tiles - 5 predetermined letters, same for both players
const generateStartingTiles = (letterPool: string[], boardSize: number): Array<{ row: number; col: number; letter: string }> => {
  const tiles: Array<{ row: number; col: number; letter: string }> = [];
  
  // Pick 5 random letters from the pool for starting tiles
  const startingLetters = [];
  for (let i = 0; i < Math.min(5, boardSize); i++) {
    const letter = letterPool[Math.floor(Math.random() * letterPool.length)];
    startingLetters.push(letter);
  }
  
  // Place one letter in each row at random column
  for (let row = 0; row < Math.min(5, boardSize); row++) {
    const col = Math.floor(Math.random() * boardSize);
    tiles.push({ row, col, letter: startingLetters[row] });
  }
  
  return tiles;
};

const LocalMultiplayerBoard = ({ onBackToMenu, boardSize = 5, playerCount = 2, cooldownTurns = 4 }: LocalMultiplayerBoardProps) => {
  const { playFeedback } = useSoundEffects(true, true);
  const { celebrate } = useVictoryCelebration();
  
  // Helper function to safely get display value from cell
  const getCellDisplay = (cell: GridCell): string => {
    if (!cell) return '';
    if (typeof cell === 'object') {
      return (cell as { letter: string }).letter;
    }
    return cell;
  };

  // Helper functions for player-specific styling
  const getPlayerTextClass = (playerIdx: number): string => {
    const classes = ['text-player-1', 'text-player-2', 'text-player-3'];
    return classes[playerIdx] || 'text-player-1';
  };

  const getPlayerGradientClass = (playerIdx: number): string => {
    const classes = ['bg-gradient-player-1', 'bg-gradient-player-2', 'bg-gradient-player-3'];
    return classes[playerIdx] || 'bg-gradient-player-1';
  };

  const getPlayerBgClass = (playerIdx: number): string => {
    const classes = [
      'bg-player-1/20 border border-player-1/30',
      'bg-player-2/20 border border-player-2/30',
      'bg-player-3/20 border border-player-3/30'
    ];
    return classes[playerIdx] || 'bg-card';
  };
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  
  // Initialize game with starting tiles
  const initializeGame = () => {
    const letterPool = generateLetterPool();
    const startingTiles = generateStartingTiles(letterPool, boardSize);
    const grids: Grid[] = Array(playerCount).fill(null).map(() => {
      const grid: Grid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
      // Place starting tiles on each grid
      startingTiles.forEach(({ row, col, letter }) => {
        grid[row][col] = letter;
      });
      return grid;
    });
    
    return {
      letterPool,
      grids
    };
  };

  const [grids, setGrids] = useState<Grid[]>(() => {
    const gameData = initializeGame();
    setAvailableLetters(gameData.letterPool);
    return gameData.grids;
  });
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [turn, setTurn] = useState(1);
  const [scores, setScores] = useState<number[]>(Array(playerCount).fill(0));
  const [cooldowns, setCooldowns] = useState<CooldownState[]>(Array(playerCount).fill(null).map(() => ({})));
  const [selectedLetter, setSelectedLetter] = useState<Letter>('');
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>[]>(Array(playerCount).fill(null).map(() => new Set()));
  const [scoredCells, setScoredCells] = useState<Set<string>[]>(Array(playerCount).fill(null).map(() => new Set()));
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [allFoundWords, setAllFoundWords] = useState<string[][]>(Array(playerCount).fill(null).map(() => []));
  const [lastBoardTotal, setLastBoardTotal] = useState<{ [playerId: string]: number }>(() => {
    const obj: { [key: string]: number } = {};
    for (let i = 1; i <= playerCount; i++) obj[i.toString()] = 0;
    return obj;
  });
  const [roundScores, setRoundScores] = useState<{ [playerId: string]: number }>(() => {
    const obj: { [key: string]: number } = {};
    for (let i = 1; i <= playerCount; i++) obj[i.toString()] = 0;
    return obj;
  });
  const [cumulativeScores, setCumulativeScores] = useState<{ [playerId: string]: number }>(() => {
    const obj: { [key: string]: number } = {};
    for (let i = 1; i <= playerCount; i++) obj[i.toString()] = 0;
    return obj;
  });

  // Preload dictionary in the background
  useEffect(() => {
    loadDictionary();
  }, []);

  // Timer effect
  useEffect(() => {
    if (gameEnded || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - deduct points and pass turn
          const pointDeduction = 5;
          const newScores = [...scores];
          newScores[currentPlayer - 1] = scores[currentPlayer - 1] - pointDeduction;
          setScores(newScores);
          
          // Update cumulative scores
          const newCumulativeScores = { ...cumulativeScores };
          newCumulativeScores[currentPlayer.toString()] = (cumulativeScores[currentPlayer.toString()] || 0) - pointDeduction;
          setCumulativeScores(newCumulativeScores);
          
          passTurn();
          return TURN_TIME;
        }
        // Warning sound at 5 seconds
        if (prev === 6) {
          playFeedback('timerWarning');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentPlayer, gameEnded, timeLeft, scores, cumulativeScores]);

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
    
    if (targetGrid[row][col] !== null) {
      playFeedback('invalid');
      return; // Cell already occupied
    }
    if (isLetterOnCooldown(selectedLetter)) {
      playFeedback('invalid');
      return; // Letter on cooldown
    }

    try {
      // Play placement sound
      playFeedback('place');
      
      // Update grids - copy all grids dynamically
      const newGrids: Grid[] = grids.map(grid => grid.map(row => [...row]));
      
      newGrids[targetPlayerIndex][row][col] = selectedLetter;

      // Update cooldowns
      const newCooldowns: CooldownState[] = cooldowns.map(cd => ({ ...cd }));

      // Decrease existing cooldowns for all players
      cooldowns.forEach((_, playerIdx) => {
        Object.keys(newCooldowns[playerIdx]).forEach(letter => {
          if (newCooldowns[playerIdx][letter] > 0) {
            newCooldowns[playerIdx][letter]--;
            if (newCooldowns[playerIdx][letter] === 0) {
              delete newCooldowns[playerIdx][letter];
            }
          }
        });
      });

      // Set cooldown for used letter for all players
      newCooldowns.forEach((_, idx) => {
        newCooldowns[idx][selectedLetter] = cooldownTurns;
      });

      // Calculate new scores using the sub-word scoring system for all players
      const playerResults = newGrids.map(grid => calculateScore(grid, SCORE_OPTS()));
      const newTotals = playerResults.map(r => r.score);
      
      // Calculate deltas for all players
      const newRoundScores: { [playerId: string]: number } = {};
      const newCumulativeScores: { [playerId: string]: number } = {};
      const newLastBoardTotal: { [playerId: string]: number } = {};
      
      let anyScored = false;
      playerResults.forEach((result, idx) => {
        const playerId = (idx + 1).toString();
        const prevTotal = lastBoardTotal[playerId] ?? 0;
        const delta = Math.max(0, result.score - prevTotal);
        
        if (delta > 0) anyScored = true;
        
        newRoundScores[playerId] = (roundScores[playerId] ?? 0) + delta;
        newCumulativeScores[playerId] = (cumulativeScores[playerId] ?? 0) + delta;
        newLastBoardTotal[playerId] = result.score;
      });
      
      // Play score sound if any player scored
      if (anyScored) {
        playFeedback('score');
      }
      
      // Create scored cells sets for all players
      const newScoredCells = playerResults.map(result => {
        const cells = new Set<string>();
        result.words.forEach(word => {
          word.path.forEach(cell => {
            cells.add(`${cell.r}-${cell.c}`);
          });
        });
        return cells;
      });
      
      // Update used words and found words
      const newUsedWords = playerResults.map(result => new Set(result.words.map(w => w.text)));
      const newAllFoundWords = playerResults.map(result => result.words.map(w => w.text));
      
      setUsedWords(newUsedWords);
      setScoredCells(newScoredCells);
      setAllFoundWords(newAllFoundWords);

      // Check if game should end
      const areAllGridsFull = newGrids.every(grid => 
        grid.every(row => row.every(cell => cell !== null))
      );

      if (areAllGridsFull) {
        setGameEnded(true);
        playFeedback('gameEnd');
        // Find winner (highest score)
        const finalScores = Object.entries(newCumulativeScores).map(([id, score]) => ({ id: parseInt(id), score }));
        const maxScore = Math.max(...finalScores.map(s => s.score));
        const winners = finalScores.filter(s => s.score === maxScore);
        if (winners.length === 1) {
          setWinner(winners[0].id);
          celebrate();
        }
        setTimeout(() => setShowWinnerDialog(true), 500);
      }

      // Update state
      setGrids(newGrids);
      setCooldowns(newCooldowns);
      setScores(Object.values(newCumulativeScores));
      setSelectedLetter('');
      setLastBoardTotal(newLastBoardTotal);
      setRoundScores(newRoundScores);
      setCumulativeScores(newCumulativeScores);
      
      // Pass turn (cycle through players)
      setCurrentPlayer(currentPlayer === playerCount ? 1 : currentPlayer + 1);
      setTurn(turn + 1);
      setTimeLeft(TURN_TIME);
      playFeedback('turnChange');

    } catch (error) {
      console.error('Error placing letter:', error);
    }
  };

  const passTurn = () => {
    // Deduct 5 points for passing turn
    const pointDeduction = 5;
    const newScores = [...scores];
    newScores[currentPlayer - 1] = scores[currentPlayer - 1] - pointDeduction;
    setScores(newScores);
    
    // Update cumulative scores
    const newCumulativeScores = { ...cumulativeScores };
    newCumulativeScores[currentPlayer.toString()] = (cumulativeScores[currentPlayer.toString()] || 0) - pointDeduction;
    setCumulativeScores(newCumulativeScores);
    
    setCurrentPlayer(currentPlayer === playerCount ? 1 : currentPlayer + 1);
    setTurn(turn + 1);
    setTimeLeft(TURN_TIME);
  };

  const resetGame = () => {
    const gameData = initializeGame();
    setAvailableLetters(gameData.letterPool);
    setGrids(gameData.grids);
    setCurrentPlayer(1);
    setTurn(1);
    setScores(Array(playerCount).fill(0));
    setCooldowns(Array(playerCount).fill(null).map(() => ({})));
    setSelectedLetter('');
    const initialScores: { [key: string]: number } = {};
    for (let i = 1; i <= playerCount; i++) initialScores[i.toString()] = 0;
    setLastBoardTotal(initialScores);
    setRoundScores(initialScores);
    setCumulativeScores(initialScores);
    setGameEnded(false);
    setWinner(null);
    setTimeLeft(TURN_TIME);
  };

  const renderGrid = (playerIndex: number) => {
    const grid = grids[playerIndex];
    const isCurrentPlayer = currentPlayer === (playerIndex + 1);
    const playerScoredCells = scoredCells[playerIndex];
    const isWinner = gameEnded && winner === (playerIndex + 1);
    const canPlaceOnThisGrid = isCurrentPlayer;
    
    // Adjust cell size based on player count for better fit
    const cellSize = playerCount === 3 ? 'w-12 h-12' : 'w-14 h-14';
    
    return (
      <div className={`inline-grid gap-1 p-3 rounded-xl border-2 shadow-lg ${
        isCurrentPlayer ? 'bg-gradient-card ring-2 ring-primary/30 border-primary/40' : 'bg-card/80 border-border'
      } ${!canPlaceOnThisGrid ? 'opacity-50' : ''}`} style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlaceLetter = !gameEnded && selectedLetter && !cell && canPlaceOnThisGrid;
            const isScored = playerScoredCells.has(`${rowIndex}-${colIndex}`);
            
            // Winner highlight effect - use darker green for better visibility
            const winnerHighlight = gameEnded && isScored 
              ? (isWinner ? 'ring-4 ring-yellow-400 shadow-lg shadow-yellow-400/50' : 'ring-2')
              : (isScored ? 'ring-2' : '');
            
            const highlightStyle = isScored ? { 
              borderColor: 'hsl(var(--highlight-cell))',
              boxShadow: '0 0 12px hsl(var(--highlight-cell) / 0.5)'
            } : {};
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  ${cellSize} cursor-pointer flex items-center justify-center transition-all duration-300 border border-border/40 rounded-lg
                  ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                  ${cell ? getPlayerGradientClass(playerIndex) : ''}
                  ${canPlaceLetter ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                  ${!canPlaceOnThisGrid ? 'cursor-not-allowed' : ''}
                  ${winnerHighlight}
                `}
                style={highlightStyle}
                onClick={() => canPlaceLetter && placeLetter(rowIndex, colIndex, playerIndex)}
              >
                {cell && (
                  <span className="font-bold text-lg drop-shadow-lg text-white">
                    {getCellDisplay(cell)}
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
    const availableToSelect = availableLetters.filter(letter => !isLetterOnCooldown(letter));
    
    return (
      <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-2 mx-auto mb-2">
        <div className="text-center mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Available Letters</span>
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {availableLetters.map(letter => {
            const isOnCooldown = isLetterOnCooldown(letter);
            const isSelected = selectedLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => {
                  if (!isOnCooldown && !gameEnded) {
                    setSelectedLetter(letter);
                    playFeedback('select');
                  }
                }}
                disabled={isOnCooldown || gameEnded}
                className={`
                  w-8 h-8 rounded font-bold text-sm transition-all duration-200
                  ${isSelected ? 'bg-primary text-primary-foreground scale-110 shadow-lg' : ''}
                  ${isOnCooldown ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed' : 
                    'bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-105'}
                  ${!isOnCooldown && !isSelected ? 'border border-border' : ''}
                `}
              >
                {letter}
                {isOnCooldown && (
                  <div className="text-xs">{getLetterCooldown(letter)}</div>
                )}
              </button>
            );
          })}
        </div>
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
      <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-1 mx-auto mb-1">
        <div className="text-center mb-1">
          <span className="text-xs font-semibold text-muted-foreground">On Cooldown</span>
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {onCooldownLetters.map(letter => (
            <div key={letter} className="bg-muted/50 rounded p-1 border border-muted-foreground/20">
              <div className="text-xs font-bold text-muted-foreground/60 text-center">
                {letter} ({getLetterCooldown(letter)})
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-2 space-y-2 max-w-5xl mx-auto flex flex-col">
      {/* Winner Dialog */}
      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">
              🎉 Game Over! 🎉
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-center space-y-4">
                <div className="text-lg">
                  {winner ? (
                    <span className={`font-bold ${winner === 1 ? 'text-player-1' : winner === 2 ? 'text-player-2' : 'text-player-3'}`}>
                      Player {winner} Wins!
                    </span>
                  ) : (
                    <span className="font-bold">It's a Tie!</span>
                  )}
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-2">Final Scores:</div>
                  <div className="flex justify-center gap-4 flex-wrap">
                    {scores.map((score, idx) => (
                      <div key={idx} className="text-center">
                        <div className={`text-sm font-medium ${getPlayerTextClass(idx)}`}>Player {idx + 1}</div>
                        <div className="text-2xl font-bold">{score}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Words Found Section */}
                <div className="bg-muted rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="text-sm text-muted-foreground mb-3">All Words Found:</div>
                  <div className={`grid gap-4 text-xs ${playerCount === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {allFoundWords.map((words, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className={`font-medium ${getPlayerTextClass(idx)}`}>Player {idx + 1} Words ({words.length})</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {words.sort().map((word, wordIdx) => (
                            <div key={wordIdx} className="bg-background/50 rounded px-2 py-1">
                              {word.toUpperCase()}
                            </div>
                          ))}
                          {words.length === 0 && (
                            <div className="text-muted-foreground italic">No words found</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {winner ? 
                    `Player ${winner} found more valid words!` :
                    'Both players found the same number of letters!'
                  }
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={resetGame} className="flex-1" size="lg">
                    Play Again
                  </Button>
                  <Button onClick={onBackToMenu} variant="outline" className="flex-1" size="lg">
                    Back to Menu
                  </Button>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

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
          <div className="flex justify-center items-center gap-4 flex-wrap">
            {scores.map((score, idx) => (
              <div key={idx} className={`text-center ${currentPlayer === idx + 1 ? 'score-glow' : ''}`}>
                <div className={`text-sm font-bold ${getPlayerTextClass(idx)}`}>Player {idx + 1}</div>
                <div className="text-xl font-bold">{score}</div>
              </div>
            ))}
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
                  <span className={getPlayerTextClass(currentPlayer - 1)}>
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

      {/* Available Letters */}
      {renderAvailableLetters()}

      {/* Cooldown Letters Display */}
      {renderLetterCooldowns()}

      {/* Game Grids */}
      {playerCount === 2 ? (
        <div className="flex flex-col items-center gap-4">
          {/* Player cards with timer in the middle */}
          <div className="flex justify-center items-center gap-4">
            {/* Player 1 */}
            <div className={`p-4 rounded-xl text-center shadow-md transition-all duration-300 ${currentPlayer === 1 ? `${getPlayerBgClass(0)} border-2 scale-105` : 'bg-card/80 border border-border'}`}>
              <div className={`text-xl font-bold ${getPlayerTextClass(0)}`}>Player 1</div>
              <div className="text-3xl font-bold score-glow">{scores[0]}</div>
            </div>

            {/* Timer */}
            {!gameEnded && (
              <Card className={`p-4 shadow-lg border-2 transition-all ${
                timeLeft <= 10 
                  ? 'border-destructive bg-destructive/10 animate-pulse' 
                  : 'border-primary bg-primary/5'
              }`}>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Time Left</div>
                  <div className={`text-4xl font-bold ${
                    timeLeft <= 10 ? 'text-destructive' : 'text-primary'
                  }`}>
                    {timeLeft}s
                  </div>
                </div>
              </Card>
            )}

            {/* VS text when game ended */}
            {gameEnded && (
              <div className="flex items-center justify-center px-6">
                <div className="text-3xl font-bold text-muted-foreground">VS</div>
              </div>
            )}

            {/* Player 2 */}
            <div className={`p-4 rounded-xl text-center shadow-md transition-all duration-300 ${currentPlayer === 2 ? `${getPlayerBgClass(1)} border-2 scale-105` : 'bg-card/80 border border-border'}`}>
              <div className={`text-xl font-bold ${getPlayerTextClass(1)}`}>Player 2</div>
              <div className="text-3xl font-bold score-glow">{scores[1]}</div>
            </div>
          </div>

          {/* Grids side by side */}
          <div className="flex justify-center items-start gap-6">
            <div className="flex flex-col items-center">
              {renderGrid(0)}
            </div>
            <div className="flex flex-col items-center">
              {renderGrid(1)}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-start gap-6 flex-1 flex-wrap">
          {grids.map((grid, playerIdx) => (
            <div key={playerIdx} className="flex flex-col items-center">
              <div className={`mb-4 p-4 rounded-xl text-center shadow-md transition-all duration-300 ${currentPlayer === playerIdx + 1 ? `${getPlayerBgClass(playerIdx)} border-2 scale-105` : 'bg-card/80 border border-border'}`}>
                <div className={`text-xl font-bold ${getPlayerTextClass(playerIdx)}`}>Player {playerIdx + 1}</div>
                <div className="text-3xl font-bold score-glow">{scores[playerIdx]}</div>
              </div>
              {renderGrid(playerIdx)}
            </div>
          ))}
        </div>
      )}

      {/* Compact Rules */}
      <div className="text-center mt-4">
        <div className="text-sm text-muted-foreground font-medium">
          30s per turn • Type letter then click to place • 3+ letter words • Score = letters in valid words
        </div>
      </div>
    </div>
  );
};

export default LocalMultiplayerBoard;
