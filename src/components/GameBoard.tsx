import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getDictionary } from '@/game/dictionary';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

type Player = 1 | 2;
type Letter = string;
type GridCell = { letter: string | null };
type Grid = GridCell[][];

interface CooldownState {
  [letter: string]: number;
}

const TURN_TIME_LIMIT = 30;
const WARNING_THRESHOLD = 5;

type DifficultyLevel = 'easy' | 'medium' | 'hard';

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

interface GameBoardProps {
  boardSize?: number;
  onBackToMenu?: () => void;
}

const GameBoard = ({ boardSize = 5, onBackToMenu }: GameBoardProps) => {
  const { playFeedback } = useSoundEffects(true, true);
  const { celebrate } = useVictoryCelebration();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [playerGrid, setPlayerGrid] = useState<Grid>(() => generateStartingTiles(boardSize));
  const [aiGrid, setAIGrid] = useState<Grid>(() => generateStartingTiles(boardSize));
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAIScore] = useState(0);
  const [playerCooldowns, setPlayerCooldowns] = useState<CooldownState>({});
  const [aiCooldowns, setAICooldowns] = useState<CooldownState>({});
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [playerWords, setPlayerWords] = useState<string[]>([]);
  const [aiWords, setAIWords] = useState<string[]>([]);
  const [difficulty] = useState<DifficultyLevel>('medium');

  const isMyTurn = currentPlayer === 1;
  
  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isMyTurn || showVictoryDialog || gameEnded) return;

      const key = e.key.toUpperCase();
      
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        const isOnCooldown = (playerCooldowns[key] || 0) > 0 || (aiCooldowns[key] || 0) > 0;
        
        if (!isOnCooldown) {
          setSelectedLetter(key);
          playFeedback('select');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isMyTurn, showVictoryDialog, gameEnded, playerCooldowns, aiCooldowns, playFeedback]);

  // Helper functions for board-full detection
  const isPlayerGridFull = playerGrid.every(row => row.every(cell => cell.letter !== null));
  const isAIGridFull = aiGrid.every(row => row.every(cell => cell.letter !== null));

  // Turn timer
  useEffect(() => {
    if (gameEnded) return;

    // Skip turn if current player's grid is full
    if (currentPlayer === 1 && isPlayerGridFull) {
      if (isAIGridFull) {
        endGame();
      } else {
        setCurrentPlayer(2);
        setTurnTimeRemaining(TURN_TIME_LIMIT);
      }
      return;
    }
    if (currentPlayer === 2 && isAIGridFull) {
      if (isPlayerGridFull) {
        endGame();
      } else {
        setCurrentPlayer(1);
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
  }, [currentPlayer, gameEnded, playerGrid, aiGrid]);

  // AI turn logic
  useEffect(() => {
    if (currentPlayer === 2 && !gameEnded) {
      // Skip AI turn if its grid is full
      const aiFull = aiGrid.every(row => row.every(cell => cell.letter !== null));
      if (aiFull) {
        return; // Will be handled by the turn timer effect
      }
      
      const aiDelay = Math.random() * 1500 + 3000; // 3-4.5 seconds thinking time
      const timer = setTimeout(() => {
        makeAIMove();
      }, aiDelay);
      
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameEnded, aiGrid]);

  const handleTurnTimeout = () => {
    if (currentPlayer === 1) {
      const newScore = Math.max(0, playerScore - 5);
      setPlayerScore(newScore);
    } else {
      const newScore = Math.max(0, aiScore - 5);
      setAIScore(newScore);
    }
    
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
  };

  const makeAIMove = async () => {
    const dict = getDictionary();
    const availableCells: Array<{row: number, col: number}> = [];
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (aiGrid[row][col].letter === null) {
          availableCells.push({row, col});
        }
      }
    }
    
    if (availableCells.length === 0) {
      endGame();
      return;
    }
    
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const availableLetters = allLetters.filter(letter => 
      (playerCooldowns[letter] || 0) === 0 && (aiCooldowns[letter] || 0) === 0
    );
    
    if (availableLetters.length === 0) {
      setCurrentPlayer(1);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      return;
    }
    
    // Medium difficulty AI: 60% strategic, 40% random
    const useStrategy = Math.random() > 0.4;
    let cell, letter;
    
    if (useStrategy) {
      // Try to find the best scoring move
      let bestScore = -1;
      let bestCell = availableCells[0];
      let bestLetter = availableLetters[0];
      
      // Sample a subset of moves to balance performance and strategy
      const cellsToCheck = availableCells.slice(0, Math.min(15, availableCells.length));
      const lettersToCheck = availableLetters.slice(0, Math.min(10, availableLetters.length));
      
      for (const testCell of cellsToCheck) {
        for (const testLetter of lettersToCheck) {
          const testGrid = aiGrid.map(row => row.map(cell => ({ ...cell })));
          testGrid[testCell.row][testCell.col] = { letter: testLetter };
          
          const gridForScoring = testGrid.map(row => row.map(cell => cell.letter || ''));
          const result = calculateScore(gridForScoring, SCORE_OPTS());
          
          // Prefer moves that increase score
          const scoreDiff = result.score - aiScore;
          if (scoreDiff > bestScore) {
            bestScore = scoreDiff;
            bestCell = testCell;
            bestLetter = testLetter;
          }
        }
      }
      
      cell = bestCell;
      letter = bestLetter;
    } else {
      // Random move (40% of the time)
      cell = availableCells[Math.floor(Math.random() * availableCells.length)];
      letter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
    }
    
    const newGrid = aiGrid.map(row => row.map(cell => ({ ...cell })));
    newGrid[cell.row][cell.col] = { letter };
    
    // Calculate score - convert to string[][]
    const gridForScoring = newGrid.map(row => row.map(cell => cell.letter || ''));
    const result = calculateScore(gridForScoring, SCORE_OPTS());
    
    // Find new words for AI
    const existingWords = new Set(aiWords);
    const newWordsFound = result.words.filter(w => !existingWords.has(w.text));
    const newScore = newWordsFound.reduce((s, w) => s + w.text.length, 0);
    
    setAIScore(result.score);
    setAIWords(result.words.map(w => w.text));
    setAIGrid(newGrid);
    
    // Show toast for AI's new words
    if (newWordsFound.length > 0) {
      toast({
        title: `AI: +${newScore} points!`,
        description: newWordsFound.map(w => `${w.text} (${w.text.length})`).join(', ')
      });
    }
    
    // Update cooldowns
    const newPlayerCooldowns = { ...playerCooldowns };
    const newAICooldowns = { ...aiCooldowns };
    
    Object.keys(newPlayerCooldowns).forEach(l => {
      if (newPlayerCooldowns[l] > 0) newPlayerCooldowns[l]--;
    });
    Object.keys(newAICooldowns).forEach(l => {
      if (newAICooldowns[l] > 0) newAICooldowns[l]--;
    });
    
    newPlayerCooldowns[letter] = 4;
    newAICooldowns[letter] = 4;
    
    setPlayerCooldowns(newPlayerCooldowns);
    setAICooldowns(newAICooldowns);
    
    // Check if game ended
    const playerFull = playerGrid.every(row => row.every(cell => cell.letter !== null));
    const aiFull = newGrid.every(row => row.every(cell => cell.letter !== null));
    
    if (playerFull && aiFull) {
      endGame();
    } else {
      setCurrentPlayer(1);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      playFeedback('turnChange');
    }
  };

  const placeLetter = (row: number, col: number) => {
    if (!selectedLetter || !isMyTurn || gameEnded) return;
    
    if (playerGrid[row][col].letter !== null) {
      playFeedback('invalid');
      return;
    }
    
    playFeedback('place');
    
    const newGrid = playerGrid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col] = { letter: selectedLetter };
    
    // Calculate score - convert to string[][]
    const gridForScoring = newGrid.map(row => row.map(cell => cell.letter || ''));
    const result = calculateScore(gridForScoring, SCORE_OPTS());
    
    // Find new words
    const existingWords = new Set(playerWords);
    const newWordsFound = result.words.filter(w => !existingWords.has(w.text));
    const newScore = newWordsFound.reduce((s, w) => s + w.text.length, 0);
    
    setPlayerScore(result.score);
    setPlayerWords(result.words.map(w => w.text));
    setPlayerGrid(newGrid);
    
    // Show toast for new words
    if (newWordsFound.length > 0) {
      toast({
        title: `+${newScore} points!`,
        description: newWordsFound.map(w => `${w.text} (${w.text.length})`).join(', ')
      });
    }
    
    // Update cooldowns
    const newPlayerCooldowns = { ...playerCooldowns };
    const newAICooldowns = { ...aiCooldowns };
    
    Object.keys(newPlayerCooldowns).forEach(l => {
      if (newPlayerCooldowns[l] > 0) newPlayerCooldowns[l]--;
    });
    Object.keys(newAICooldowns).forEach(l => {
      if (newAICooldowns[l] > 0) newAICooldowns[l]--;
    });
    
    newPlayerCooldowns[selectedLetter] = 4;
    newAICooldowns[selectedLetter] = 4;
    
    setPlayerCooldowns(newPlayerCooldowns);
    setAICooldowns(newAICooldowns);
    setSelectedLetter(null);
    
    // Check if game ended
    const playerFull = newGrid.every(row => row.every(cell => cell.letter !== null));
    const aiFull = aiGrid.every(row => row.every(cell => cell.letter !== null));
    
    if (playerFull && aiFull) {
      endGame();
    } else {
      setCurrentPlayer(2);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      playFeedback('turnChange');
    }
  };

  const endGame = () => {
    setGameEnded(true);
    playFeedback('gameEnd');
    if (playerScore > aiScore) {
      celebrate();
    }
    setTimeout(() => setShowVictoryDialog(true), 500);
  };

  const handlePlayAgain = () => {
    // Reset all game state
    setPlayerGrid(generateStartingTiles(boardSize));
    setAIGrid(generateStartingTiles(boardSize));
    setPlayerScore(0);
    setAIScore(0);
    setPlayerWords([]);
    setAIWords([]);
    setPlayerCooldowns({});
    setAICooldowns({});
    setSelectedLetter(null);
    setCurrentPlayer(1);
    setGameEnded(false);
    setShowVictoryDialog(false);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
  };

  const renderGrid = (isAI: boolean) => {
    const grid = isAI ? aiGrid : playerGrid;
    const canInteract = !isAI && isMyTurn && !gameEnded;
    
    return (
      <div className={`inline-grid gap-0.5 sm:gap-1 p-1 sm:p-2 md:p-3 rounded-xl border-2 shadow-lg transition-all ${
        canInteract ? 'bg-gradient-card ring-2 ring-primary/30 border-primary/40' : 'bg-card/80 border-border'
      }`} 
      style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlace = canInteract && selectedLetter && !cell.letter;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/40 rounded-lg
                  ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                  ${cell.letter ? (isAI ? 'bg-gradient-player-2' : 'bg-gradient-player-1') : ''}
                  ${canPlace ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                `}
                onClick={() => canPlace && placeLetter(rowIndex, colIndex)}
              >
                {cell.letter && (
                  <span className="font-bold text-xs sm:text-base md:text-lg drop-shadow-lg text-white">
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
          const playerCooldown = playerCooldowns[letter] || 0;
          const aiCooldown = aiCooldowns[letter] || 0;
          const cooldown = Math.max(playerCooldown, aiCooldown);
          const isOnCooldown = cooldown > 0;
          const isSelected = selectedLetter === letter;
          const canSelect = !isOnCooldown && isMyTurn && !gameEnded;
          
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

  return (
    <div className="min-h-screen p-0.5 sm:p-1 md:p-2 space-y-0.5 sm:space-y-1 max-w-7xl mx-auto flex flex-col">
      {/* Header */}
      <div className="text-center mb-0">
        <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS - Solo Game
        </h1>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        <Card className="p-1 sm:p-2 bg-gradient-card">
          <Button 
            onClick={() => {
              playFeedback('click');
              if (onBackToMenu) {
                onBackToMenu();
              } else {
                navigate('/');
              }
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
                {playerScore > aiScore ? 'You Win!' : playerScore < aiScore ? 'AI Wins' : 'Tie!'}
              </div>
            ) : (
              <div className="text-xs sm:text-sm font-semibold">
                {isMyTurn ? (
                  <span className="text-primary animate-pulse">Your Turn</span>
                ) : (
                  <span className="text-muted-foreground">AI's Turn</span>
                )}
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
        <div className="flex justify-center items-center gap-1 sm:gap-2 w-full max-w-2xl mb-0.5 sm:mb-1">
          <div className={`p-1 sm:p-2 rounded-lg text-center shadow-md transition-all duration-500 flex-1 ${
            isMyTurn 
              ? 'bg-player-1/20 border-2 border-player-1/30 scale-105 animate-fade-in' 
              : 'bg-card/80 border border-border opacity-70'
          }`}>
            <div className="text-xs sm:text-sm font-bold text-player-1">You</div>
            <div className="text-base sm:text-xl md:text-2xl font-bold score-glow">{playerScore}</div>
          </div>

          {!gameEnded && (
            <Card className={`p-0.5 sm:p-1 md:p-2 shadow-lg border-2 transition-all min-w-[50px] ${
              isMyTurn && turnTimeRemaining <= WARNING_THRESHOLD
                ? 'border-destructive bg-destructive/10 animate-pulse' 
                : 'border-primary bg-primary/5'
            }`}>
              <div className="text-center">
                <div className={`text-base sm:text-xl md:text-2xl font-bold ${
                  isMyTurn && turnTimeRemaining <= WARNING_THRESHOLD 
                    ? 'text-destructive' 
                    : 'text-primary'
                }`}>
                  {turnTimeRemaining}s
                </div>
              </div>
            </Card>
          )}

          {gameEnded && (
            <div className="flex items-center justify-center px-2">
              <div className="text-base sm:text-xl md:text-2xl font-bold text-muted-foreground">VS</div>
            </div>
          )}

          <div className={`p-1 sm:p-2 rounded-lg text-center shadow-md transition-all duration-500 flex-1 ${
            !isMyTurn && !gameEnded
              ? 'bg-player-2/20 border-2 border-player-2/30 scale-105 animate-fade-in' 
              : 'bg-card/80 border border-border opacity-70'
          }`}>
            <div className="text-xs sm:text-sm font-bold text-player-2">AI</div>
            <div className="text-base sm:text-xl md:text-2xl font-bold score-glow">{aiScore}</div>
          </div>
        </div>

        <div className="flex flex-row justify-center items-start gap-1 sm:gap-2 md:gap-3 w-full">
          <div className={`flex flex-col items-center transition-all duration-500 ${
            isMyTurn ? 'scale-102 animate-fade-in' : 'opacity-90'
          }`}>
            {renderGrid(false)}
          </div>
          <div className={`flex flex-col items-center transition-all duration-500 ${
            !isMyTurn && !gameEnded ? 'scale-102 animate-fade-in' : 'opacity-90'
          }`}>
            {renderGrid(true)}
          </div>
        </div>
      </div>

      {/* Victory Dialog */}
      <Dialog open={showVictoryDialog} onOpenChange={setShowVictoryDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl text-center">
              {playerScore > aiScore ? '🎉 Victory! 🎉' : playerScore < aiScore ? '😔 Defeat' : '🤝 Tie!'}
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              Final Score: You {playerScore} - {aiScore} AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="flex justify-around text-center">
              <div>
                <p className="text-sm text-muted-foreground">You</p>
                <p className="text-3xl font-bold">{playerScore}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI</p>
                <p className="text-3xl font-bold">{aiScore}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2 text-center">Your Words</h3>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                  {playerWords.length > 0 ? (
                    playerWords.map((word, idx) => (
                      <div key={idx} className="text-sm bg-accent/50 rounded px-2 py-1">
                        {word} <span className="text-muted-foreground">({word.length})</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No words</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-center">AI's Words</h3>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                  {aiWords.length > 0 ? (
                    aiWords.map((word, idx) => (
                      <div key={idx} className="text-sm bg-accent/50 rounded px-2 py-1">
                        {word} <span className="text-muted-foreground">({word.length})</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No words</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={handlePlayAgain} size="lg">
                🔄 Play Again
              </Button>
              <Button onClick={() => {
                setShowVictoryDialog(false);
                navigate('/');
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

export default GameBoard;
