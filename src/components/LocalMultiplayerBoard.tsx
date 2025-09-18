
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { loadDictionary } from '@/lib/dictionary';
import { scoreGrid } from '@/lib/scoring';
import { calculateScore } from '@/game/scoring';

type Player = 1 | 2;
type Letter = string;
type GridCell = Letter | null;
type Grid = GridCell[][];

interface CooldownState {
  [letter: string]: number;
}

interface LocalMultiplayerBoardProps {
  onBackToMenu: () => void;
  boardSize?: number;
}

const COOLDOWN_TURNS = 4;
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

const LocalMultiplayerBoard = ({ onBackToMenu, boardSize = 5 }: LocalMultiplayerBoardProps) => {
  // Helper function to safely get display value from cell
  const getCellDisplay = (cell: GridCell): string => {
    if (!cell) return '';
    if (typeof cell === 'object') {
      return (cell as { letter: string }).letter;
    }
    return cell;
  };
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [crossGridPlacements, setCrossGridPlacements] = useState<[number, number]>([1, 1]); // Each player starts with 1 attack per game
  
  // Initialize game with starting tiles
  const initializeGame = () => {
    const letterPool = generateLetterPool();
    const startingTiles = generateStartingTiles(letterPool, boardSize);
    const grid1: Grid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    const grid2: Grid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    
    // Place starting tiles on both grids
    startingTiles.forEach(({ row, col, letter }) => {
      grid1[row][col] = letter;
      grid2[row][col] = letter;
    });
    
    return {
      letterPool,
      grids: [grid1, grid2] as [Grid, Grid]
    };
  };

  const [grids, setGrids] = useState<[Grid, Grid]>(() => {
    const gameData = initializeGame();
    setAvailableLetters(gameData.letterPool);
    return gameData.grids;
  });
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [turn, setTurn] = useState(1);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [cooldowns, setCooldowns] = useState<[CooldownState, CooldownState]>([{}, {}]);
  const [selectedLetter, setSelectedLetter] = useState<Letter>('');
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [usedWords, setUsedWords] = useState<[Set<string>, Set<string>]>([new Set(), new Set()]);
  const [scoredCells, setScoredCells] = useState<[Set<string>, Set<string>]>([new Set(), new Set()]);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [allFoundWords, setAllFoundWords] = useState<[string[], string[]]>([[], []]);

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
    const isPlacingOnOpponentGrid = targetPlayerIndex !== (currentPlayer - 1);
    
    if (targetGrid[row][col] !== null) return; // Cell already occupied
    if (isLetterOnCooldown(selectedLetter)) return; // Letter on cooldown
    
    // Check if placing on opponent's grid and if cross-placements available
    if (isPlacingOnOpponentGrid && crossGridPlacements[currentPlayer - 1] <= 0) return;

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

      // Update cross-grid placements if placing on opponent's grid
      const newCrossGridPlacements: [number, number] = [...crossGridPlacements];
      if (isPlacingOnOpponentGrid) {
        newCrossGridPlacements[currentPlayer - 1]--;
      }

      // Calculate new scores using the new scoring system
      const dict = await loadDictionary();
      const result1 = calculateScore(newGrids[0], { dictionary: dict, useDictionary: true, minLen: 3 });
      const result2 = calculateScore(newGrids[1], { dictionary: dict, useDictionary: true, minLen: 3 });
      
      // Convert to old format for compatibility
      const score1 = { score: result1.score, newUsedWords: new Set(result1.words.map(w => w.text)), scoredCells: new Set<string>(), allFoundWords: result1.words.map(w => w.text) };
      const score2 = { score: result2.score, newUsedWords: new Set(result2.words.map(w => w.text)), scoredCells: new Set<string>(), allFoundWords: result2.words.map(w => w.text) };
      
      // Mark scored cells
      result1.words.forEach(word => {
        word.path.forEach(cell => {
          score1.scoredCells.add(`${cell.r}-${cell.c}`);
        });
      });
      result2.words.forEach(word => {
        word.path.forEach(cell => {
          score2.scoredCells.add(`${cell.r}-${cell.c}`);
        });
      });

      // Update used words
      const newUsedWords: [Set<string>, Set<string>] = [score1.newUsedWords, score2.newUsedWords];
      setUsedWords(newUsedWords);
      setScoredCells([score1.scoredCells, score2.scoredCells]);
      setAllFoundWords([score1.allFoundWords, score2.allFoundWords]);

      // Check if game should end
      const areAllGridsFull = newGrids.every(grid => 
        grid.every(row => row.every(cell => cell !== null))
      );

      if (areAllGridsFull) {
        setGameEnded(true);
        if (score1.score > score2.score) {
          setWinner(1);
        } else if (score2.score > score1.score) {
          setWinner(2);
        }
        setTimeout(() => setShowWinnerDialog(true), 500);
      }

      // Update state
      setGrids(newGrids);
      setCooldowns(newCooldowns);
      setScores([score1.score, score2.score]);
      setCrossGridPlacements(newCrossGridPlacements);
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
    const gameData = initializeGame();
    setAvailableLetters(gameData.letterPool);
    setGrids(gameData.grids);
    setCurrentPlayer(1);
    setTurn(1);
    setScores([0, 0]);
    setCooldowns([{}, {}]);
    setCrossGridPlacements([1, 1]); // One attack per game for each player
    setSelectedLetter('');
    setGameEnded(false);
    setWinner(null);
    setTimeLeft(TURN_TIME);
  };

  const renderGrid = (playerIndex: number) => {
    const grid = grids[playerIndex];
    const isCurrentPlayer = currentPlayer === (playerIndex + 1);
    const playerScoredCells = scoredCells[playerIndex];
    const isWinner = gameEnded && winner === (playerIndex + 1);
    const canPlaceOnThisGrid = isCurrentPlayer || crossGridPlacements[currentPlayer - 1] > 0;
    
    return (
      <div className={`inline-grid gap-px p-2 rounded-lg border-2 ${
        isCurrentPlayer ? 'bg-gradient-card shadow-lg ring-2 ring-primary/20 border-primary/30' : 'bg-card border-border'
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
              boxShadow: '0 0 8px hsl(var(--highlight-cell) / 0.4)'
            } : {};
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-14 h-14 cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/30
                  ${isLightSquare ? 'bg-muted/80' : 'bg-muted-foreground/10'}
                  ${cell ? (playerIndex === 0 ? 'bg-gradient-player-1' : 'bg-gradient-player-2') : ''}
                  ${canPlaceLetter ? 'hover:scale-105 hover:shadow-lg hover:bg-accent/20' : ''}
                  ${!canPlaceOnThisGrid ? 'cursor-not-allowed' : ''}
                  ${winnerHighlight}
                `}
                style={highlightStyle}
                onClick={() => canPlaceLetter && placeLetter(rowIndex, colIndex, playerIndex)}
              >
                {cell && (
                  <span className="font-bold text-base drop-shadow-lg text-white">
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
                onClick={() => !isOnCooldown && !gameEnded && setSelectedLetter(letter)}
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
                  {winner === 1 ? (
                    <span className="text-player-1 font-bold">Player 1 Wins!</span>
                  ) : winner === 2 ? (
                    <span className="text-player-2 font-bold">Player 2 Wins!</span>
                  ) : (
                    <span className="font-bold">It's a Tie!</span>
                  )}
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-2">Final Scores:</div>
                  <div className="flex justify-center gap-8">
                  <div className="text-center">
                    <div className="text-sm font-medium text-player-1">Player 1</div>
                    <div className="text-2xl font-bold">{scores[0]}</div>
                    <div className="text-xs text-muted-foreground">points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-player-2">Player 2</div>
                    <div className="text-2xl font-bold">{scores[1]}</div>
                    <div className="text-xs text-muted-foreground">points</div>
                  </div>
                  </div>
                </div>

                {/* Words Found Section */}
                <div className="bg-muted rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="text-sm text-muted-foreground mb-3">All Words Found:</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="font-medium text-player-1">Player 1 Words ({allFoundWords[0].length})</div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {allFoundWords[0].sort().map((word, idx) => (
                          <div key={idx} className="bg-background/50 rounded px-2 py-1">
                            {word.toUpperCase()}
                          </div>
                        ))}
                        {allFoundWords[0].length === 0 && (
                          <div className="text-muted-foreground italic">No words found</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-player-2">Player 2 Words ({allFoundWords[1].length})</div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {allFoundWords[1].sort().map((word, idx) => (
                          <div key={idx} className="bg-background/50 rounded px-2 py-1">
                            {word.toUpperCase()}
                          </div>
                        ))}
                        {allFoundWords[1].length === 0 && (
                          <div className="text-muted-foreground italic">No words found</div>
                        )}
                      </div>
                    </div>
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

      {/* Available Letters */}
      {renderAvailableLetters()}

      {/* Cooldown Letters Display */}
      {renderLetterCooldowns()}

      {/* Game Grids */}
      <div className="flex justify-center items-start gap-6 flex-1">
        {/* Player 1 Grid */}
        <div className="flex flex-col items-center">
          <div className={`mb-2 p-2 rounded-lg text-center ${currentPlayer === 1 ? 'bg-player-1/20 border border-player-1/30' : 'bg-card'}`}>
            <div className="text-lg font-bold text-player-1">Player 1</div>
            <div className="text-2xl font-bold">{scores[0]}</div>
          </div>
          {/* Player 1 Attack Indicators */}
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-medium text-muted-foreground">Attacks:</span>
            {[0, 1, 2].map(i => (
              <div key={i} className={`w-4 h-4 flex items-center justify-center text-xs font-bold border rounded ${
                i < crossGridPlacements[0] ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-muted text-muted-foreground border-muted-foreground'
              }`}>
                ✕
              </div>
            ))}
          </div>
          {renderGrid(0)}
        </div>

        {/* Player 2 Grid */}
        <div className="flex flex-col items-center">
          <div className={`mb-2 p-2 rounded-lg text-center ${currentPlayer === 2 ? 'bg-player-2/20 border border-player-2/30' : 'bg-card'}`}>
            <div className="text-lg font-bold text-player-2">Player 2</div>
            <div className="text-2xl font-bold">{scores[1]}</div>
          </div>
          {/* Player 2 Attack Indicators */}
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-medium text-muted-foreground">Attacks:</span>
            {[0, 1, 2].map(i => (
              <div key={i} className={`w-4 h-4 flex items-center justify-center text-xs font-bold border rounded ${
                i < crossGridPlacements[1] ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-muted text-muted-foreground border-muted-foreground'
              }`}>
                ✕
              </div>
            ))}
          </div>
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
