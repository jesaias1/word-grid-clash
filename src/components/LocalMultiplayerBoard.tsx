import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

type Player = number;
type GridCell = { letter: string | null };
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

const TURN_TIME_LIMIT = 30;
const WARNING_THRESHOLD = 5;

const generateLetterPool = (): string[] => {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
};

const generateStartingTiles = (boardSize: number): Grid => {
  const grid: Grid = Array(boardSize).fill(null).map(() => 
    Array(boardSize).fill(null).map(() => ({ letter: null }))
  );
  
  const letterPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const startingLetters: string[] = [];
  for (let i = 0; i < Math.min(5, boardSize); i++) {
    const letter = letterPool[Math.floor(Math.random() * letterPool.length)];
    startingLetters.push(letter);
  }
  
  for (let row = 0; row < Math.min(5, boardSize); row++) {
    const col = Math.floor(Math.random() * boardSize);
    grid[row][col] = { letter: startingLetters[row] };
  }
  
  return grid;
};

const LocalMultiplayerBoard = ({ onBackToMenu, boardSize = 5, playerCount = 2, cooldownTurns = 4 }: LocalMultiplayerBoardProps) => {
  const { playFeedback } = useSoundEffects(true, true);
  const { celebrate } = useVictoryCelebration();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Generate ONE set of starting tiles that all players will share
  const [grids, setGrids] = useState<Grid[]>(() => {
    const sharedStartingGrid = generateStartingTiles(boardSize);
    return Array(playerCount).fill(null).map(() => 
      sharedStartingGrid.map(row => row.map(cell => ({ ...cell })))
    );
  });
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [scores, setScores] = useState<number[]>(Array(playerCount).fill(0));
  const [cooldowns, setCooldowns] = useState<CooldownState>({}); // Shared cooldowns
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [playerWords, setPlayerWords] = useState<string[][]>(Array(playerCount).fill(null).map(() => []));
  const [winner, setWinner] = useState<Player | null>(null);

  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showVictoryDialog || gameEnded) return;

      const key = e.key.toUpperCase();
      
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        const isOnCooldown = (cooldowns[key] || 0) > 0;
        
        if (!isOnCooldown) {
          setSelectedLetter(key);
          playFeedback('select');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showVictoryDialog, gameEnded, cooldowns, playFeedback]);

  // Check if a player's grid is full
  const isPlayerGridFull = (playerIndex: number, gridState: Grid[] = grids) => {
    return gridState[playerIndex].every(row => row.every(cell => cell.letter !== null));
  };

  // Find next player who can still play
  const getNextActivePlayer = (fromPlayer: number, gridState: Grid[] = grids): number | null => {
    for (let i = 0; i < playerCount; i++) {
      const nextPlayer = ((fromPlayer - 1 + i) % playerCount) + 1;
      if (!isPlayerGridFull(nextPlayer - 1, gridState)) {
        return nextPlayer;
      }
    }
    return null; // All players' boards are full
  };

  // Turn timer
  useEffect(() => {
    if (gameEnded) return;

    // Skip turn immediately if current player's board is full
    if (isPlayerGridFull(currentPlayer - 1)) {
      const nextPlayer = getNextActivePlayer(currentPlayer + 1);
      if (nextPlayer === null) {
        // All boards full - end game
        setGameEnded(true);
        playFeedback('gameEnd');
        const maxScore = Math.max(...scores);
        const winnersCount = scores.filter(s => s === maxScore).length;
        if (winnersCount === 1) {
          const winnerIdx = scores.indexOf(maxScore);
          setWinner(winnerIdx + 1);
          celebrate();
        }
        setTimeout(() => setShowVictoryDialog(true), 500);
      } else {
        setCurrentPlayer(nextPlayer);
        setTurnTimeRemaining(TURN_TIME_LIMIT);
      }
      return;
    }

    const timer = setInterval(() => {
      setTurnTimeRemaining(prev => {
        if (prev <= 1) {
          handleTurnTimeout();
          return TURN_TIME_LIMIT;
        }
        if (prev === 6) {
          playFeedback('timerWarning');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentPlayer, gameEnded, grids]);

  const handleTurnTimeout = () => {
    const newScores = [...scores];
    newScores[currentPlayer - 1] = Math.max(0, scores[currentPlayer - 1] - 5);
    setScores(newScores);
    
    const nextPlayer = getNextActivePlayer(currentPlayer + 1);
    if (nextPlayer === null) {
      // All boards full
      setGameEnded(true);
      playFeedback('gameEnd');
      const maxScore = Math.max(...newScores);
      const winnersCount = newScores.filter(s => s === maxScore).length;
      if (winnersCount === 1) {
        const winnerIdx = newScores.indexOf(maxScore);
        setWinner(winnerIdx + 1);
        celebrate();
      }
      setTimeout(() => setShowVictoryDialog(true), 500);
    } else {
      setCurrentPlayer(nextPlayer);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
    }
  };

  const handlePlayAgain = () => {
    // Reset all game state - generate ONE new starting grid for all players
    const sharedStartingGrid = generateStartingTiles(boardSize);
    setGrids(Array(playerCount).fill(null).map(() => 
      sharedStartingGrid.map(row => row.map(cell => ({ ...cell })))
    ));
    setCurrentPlayer(1);
    setScores(Array(playerCount).fill(0));
    setCooldowns({});
    setSelectedLetter(null);
    setGameEnded(false);
    setShowVictoryDialog(false);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    setPlayerWords(Array(playerCount).fill(null).map(() => []));
    setWinner(null);
  };

  const placeLetter = (playerIndex: number, row: number, col: number) => {
    if (!selectedLetter || currentPlayer !== playerIndex + 1 || gameEnded) return;
    
    if (grids[playerIndex][row][col].letter !== null) {
      playFeedback('invalid');
      return;
    }
    
    playFeedback('place');
    
    const newGrids = grids.map((grid, idx) => 
      idx === playerIndex 
        ? grid.map((r, rIdx) => r.map((c, cIdx) => 
            rIdx === row && cIdx === col ? { letter: selectedLetter } : { ...c }
          ))
        : grid.map(row => row.map(cell => ({ ...cell })))
    );
    
    // Calculate scores for all players
    const newScores = newGrids.map(grid => {
      const gridForScoring = grid.map(row => row.map(cell => cell.letter || ''));
      const result = calculateScore(gridForScoring, SCORE_OPTS());
      return result.score;
    });
    
    // Get words for current player
    const gridForScoring = newGrids[playerIndex].map(row => row.map(cell => cell.letter || ''));
    const result = calculateScore(gridForScoring, SCORE_OPTS());
    
    // Find new words
    const existingWords = new Set(playerWords[playerIndex] || []);
    const newWordsFound = result.words.filter(w => !existingWords.has(w.text));
    const newScore = newWordsFound.reduce((s, w) => s + w.text.length, 0);
    
    const newPlayerWords = [...playerWords];
    newPlayerWords[playerIndex] = result.words.map(w => w.text);
    
    setPlayerWords(newPlayerWords);
    setScores(newScores);
    setGrids(newGrids);
    
    // Show toast for new words
    if (newWordsFound.length > 0) {
      toast({
        title: `Player ${playerIndex + 1}: +${newScore} points!`,
        description: newWordsFound.map(w => `${w.text} (${w.text.length})`).join(', ')
      });
    }
    
    // Update shared cooldowns
    const newCooldowns = { ...cooldowns };
    Object.keys(newCooldowns).forEach(letter => {
      if (newCooldowns[letter] > 0) {
        newCooldowns[letter]--;
        if (newCooldowns[letter] === 0) {
          delete newCooldowns[letter];
        }
      }
    });
    newCooldowns[selectedLetter] = cooldownTurns;
    setCooldowns(newCooldowns);
    setSelectedLetter(null);
    
    // Check if game ended - find next active player
    const nextPlayer = getNextActivePlayer(currentPlayer + 1, newGrids);
    
    if (nextPlayer === null) {
      // All boards full - game over
      setGameEnded(true);
      playFeedback('gameEnd');
      
      const maxScore = Math.max(...newScores);
      const winnersCount = newScores.filter(s => s === maxScore).length;
      
      if (winnersCount === 1) {
        const winnerIdx = newScores.indexOf(maxScore);
        setWinner(winnerIdx + 1);
        celebrate();
      }
      
      setTimeout(() => setShowVictoryDialog(true), 500);
    } else {
      setCurrentPlayer(nextPlayer);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      playFeedback('turnChange');
    }
  };

  const renderGrid = (playerIndex: number) => {
    const grid = grids[playerIndex];
    const isCurrentPlayer = currentPlayer === playerIndex + 1;
    const canInteract = isCurrentPlayer && !gameEnded;
    
    return (
      <div className={`inline-grid gap-0.5 sm:gap-1 p-1 sm:p-2 md:p-3 rounded-xl border-2 shadow-lg transition-all ${
        canInteract ? 'bg-gradient-card ring-2 ring-primary/30 border-primary/40' : 'bg-card/80 border-border'
      }`} 
      style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlace = canInteract && selectedLetter && !cell.letter;
            
            const playerColors = [
              'bg-gradient-player-1',
              'bg-gradient-player-2', 
              'bg-gradient-player-3'
            ];
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  ${playerCount === 3 ? 'w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10' : 'w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12'} cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/40 rounded-lg
                  ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                  ${cell.letter ? playerColors[playerIndex] || 'bg-gradient-primary' : ''}
                  ${canPlace ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                `}
                onClick={() => canPlace && placeLetter(playerIndex, rowIndex, colIndex)}
              >
                {cell.letter && (
                  <span className={`font-bold ${playerCount === 3 ? 'text-[10px] sm:text-xs md:text-sm' : 'text-xs sm:text-base md:text-lg'} drop-shadow-lg text-white`}>
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
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    return (
      <div className="flex flex-wrap gap-0.5 sm:gap-1 md:gap-2 justify-center max-w-2xl mx-auto">
        {allLetters.map((letter: string) => {
          const cooldown = cooldowns[letter] || 0;
          const isOnCooldown = cooldown > 0;
          const isSelected = selectedLetter === letter;
          const canSelect = !isOnCooldown && !gameEnded;
          
          return (
            <button
              key={letter}
              onClick={() => {
                if (canSelect) {
                  setSelectedLetter(letter);
                  playFeedback('select');
                }
              }}
              disabled={!canSelect}
              className={`
                w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded font-bold text-xs sm:text-sm md:text-base transition-all duration-200 relative
                ${isSelected && canSelect
                  ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                  : isOnCooldown
                    ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                    : canSelect
                      ? 'bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-105 border border-border'
                      : 'bg-card text-muted-foreground cursor-not-allowed opacity-50 border border-border'
                }
                ${cooldown === 1 ? 'ring-2 ring-yellow-500/70' : ''}
              `}
            >
              {letter}
              {isOnCooldown && (
                <div className={`absolute -top-1 -right-1 rounded-full w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center text-[9px] sm:text-[10px] font-bold shadow-lg border border-background ${
                  cooldown === 1 
                    ? 'bg-yellow-500 text-yellow-950' 
                    : 'bg-destructive text-destructive-foreground'
                }`}>
                  {cooldown}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const getPlayerColor = (index: number) => {
    const colors = ['text-player-1', 'text-player-2', 'text-player-3'];
    return colors[index] || 'text-player-1';
  };

  const getPlayerBgColor = (index: number, isActive: boolean) => {
    const activeColors = [
      'bg-player-1/20 border-2 border-player-1/30',
      'bg-player-2/20 border-2 border-player-2/30',
      'bg-player-3/20 border-2 border-player-3/30'
    ];
    return isActive 
      ? `${activeColors[index] || activeColors[0]} scale-105 animate-fade-in`
      : 'bg-card/80 border border-border opacity-70';
  };

  return (
    <div className="min-h-screen p-0.5 sm:p-1 md:p-2 space-y-0.5 sm:space-y-1 max-w-7xl mx-auto flex flex-col">
      {/* Header */}
      <div className="text-center mb-0">
        <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS - {playerCount} Player Local
        </h1>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        <Card className="p-1 sm:p-2 bg-gradient-card">
          <Button 
            onClick={() => {
              playFeedback('click');
              onBackToMenu();
            }} 
            variant="outline" 
            className="w-full text-xs h-7 sm:h-8"
          >
            Back
          </Button>
        </Card>

        <Card className="p-1 sm:p-2 bg-gradient-card">
          <div className="text-center">
            {gameEnded ? (
              <div className="text-xs sm:text-sm font-bold text-accent">
                {winner ? `Player ${winner} Wins!` : 'Tie!'}
              </div>
            ) : (
              <div className="text-xs sm:text-sm font-semibold">
                <span className="text-primary animate-pulse">Player {currentPlayer}'s Turn</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-1 sm:p-2 bg-gradient-card">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Selected</div>
            <div className="text-lg sm:text-xl font-bold text-accent">
              {selectedLetter || '?'}
            </div>
          </div>
        </Card>
      </div>

      {/* Available Letters */}
      {!gameEnded && (
        <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-0.5 sm:p-1 mx-auto">
          {renderAvailableLetters()}
        </div>
      )}

      {/* Game Grids */}
      <div className="flex flex-col items-center gap-0">
        {/* Player Score Cards with Timer in center (2-player) */}
        {playerCount === 2 ? (
          <div className="flex justify-center items-center gap-1 sm:gap-2 w-full max-w-2xl mb-0.5 sm:mb-1">
            <div className={`p-1 sm:p-2 rounded-lg text-center shadow-md transition-all duration-500 flex-1 ${getPlayerBgColor(0, currentPlayer === 1 && !gameEnded)}`}>
              <div className={`text-xs sm:text-sm font-bold ${getPlayerColor(0)}`}>P1</div>
              <div className="text-base sm:text-xl md:text-2xl font-bold score-glow">{scores[0]}</div>
            </div>

            {/* Timer in center for 2-player */}
            {!gameEnded && (
              <Card className={`p-0.5 sm:p-1 md:p-2 shadow-lg border-2 transition-all min-w-[50px] ${
                turnTimeRemaining <= WARNING_THRESHOLD
                  ? 'border-destructive bg-destructive/10 animate-pulse' 
                  : 'border-primary bg-primary/5'
              }`}>
                <div className="text-center">
                  <div className={`text-base sm:text-xl md:text-2xl font-bold ${
                    turnTimeRemaining <= WARNING_THRESHOLD 
                      ? 'text-destructive' 
                      : 'text-primary'
                  }`}>
                    {turnTimeRemaining}s
                  </div>
                </div>
              </Card>
            )}

            {/* VS text when game ended */}
            {gameEnded && (
              <div className="flex items-center justify-center px-2">
                <div className="text-base sm:text-xl md:text-2xl font-bold text-muted-foreground">VS</div>
              </div>
            )}

            <div className={`p-1 sm:p-2 rounded-lg text-center shadow-md transition-all duration-500 flex-1 ${getPlayerBgColor(1, currentPlayer === 2 && !gameEnded)}`}>
              <div className={`text-xs sm:text-sm font-bold ${getPlayerColor(1)}`}>P2</div>
              <div className="text-base sm:text-xl md:text-2xl font-bold score-glow">{scores[1]}</div>
            </div>
          </div>
        ) : (
          /* 3-player layout */
          <div className="flex flex-row gap-1 sm:gap-2 w-full max-w-4xl mb-0.5 sm:mb-1 flex-wrap justify-center">
            {Array.from({ length: playerCount }).map((_, idx) => {
              const isActive = currentPlayer === idx + 1;
              return (
                <div key={idx} className={`p-1 sm:p-2 rounded-lg text-center shadow-md transition-all duration-500 flex-1 min-w-[80px] ${getPlayerBgColor(idx, isActive && !gameEnded)}`}>
                  <div className={`text-xs sm:text-sm font-bold ${getPlayerColor(idx)}`}>P{idx + 1}</div>
                  <div className="text-base sm:text-xl md:text-2xl font-bold score-glow">{scores[idx]}</div>
                </div>
              );
            })}
            
            {/* Timer for 3-player */}
            {!gameEnded && (
              <Card className={`p-0.5 sm:p-1 md:p-2 shadow-lg border-2 transition-all min-w-[50px] w-16 sm:w-20 ${
                turnTimeRemaining <= WARNING_THRESHOLD
                  ? 'border-destructive bg-destructive/10 animate-pulse' 
                  : 'border-primary bg-primary/5'
              }`}>
                <div className="text-center">
                  <div className={`text-base sm:text-xl md:text-2xl font-bold ${
                    turnTimeRemaining <= WARNING_THRESHOLD 
                      ? 'text-destructive' 
                      : 'text-primary'
                  }`}>
                    {turnTimeRemaining}s
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Grids */}
        <div className={`flex ${playerCount === 3 ? 'flex-wrap justify-center' : 'flex-row justify-center items-start'} gap-1 sm:gap-2 md:gap-3 w-full`}>
          {grids.map((_, idx) => {
            const isActive = currentPlayer === idx + 1;
            return (
              <div key={idx} className={`flex flex-col items-center transition-all duration-500 ${
                isActive && !gameEnded ? 'scale-102 animate-fade-in' : 'opacity-90'
              } ${playerCount === 3 ? 'w-auto' : ''}`}>
                {renderGrid(idx)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Victory Dialog */}
      <Dialog open={showVictoryDialog} onOpenChange={setShowVictoryDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-3xl text-center">
              {winner ? `🎉 Player ${winner} Wins! 🎉` : '🤝 Tie Game!'}
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              {winner ? `Congratulations to the winner!` : `All players tied!`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="flex justify-around text-center flex-wrap">
              {scores.map((score, idx) => (
                <div key={idx} className="flex-1 min-w-[100px]">
                  <p className="text-sm text-muted-foreground">Player {idx + 1}</p>
                  <p className="text-3xl font-bold">{score}</p>
                </div>
              ))}
            </div>

            <div className={`grid ${playerCount === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
              {playerWords.map((words, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold mb-2 text-center">Player {idx + 1}'s Words</h3>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {words.length > 0 ? (
                      words.map((word, wIdx) => (
                        <div key={wIdx} className="text-sm bg-accent/50 rounded px-2 py-1">
                          {word} <span className="text-muted-foreground">({word.length})</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">No words</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={handlePlayAgain} size="lg">
                ⚡ Quick Rematch
              </Button>
              <Button onClick={() => {
                setShowVictoryDialog(false);
                onBackToMenu();
              }} variant="outline" size="lg">
                Home
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocalMultiplayerBoard;
