import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { getDictionary } from '@/game/dictionary';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { useNavigate } from 'react-router-dom';
import { saveSoloGameState, loadSoloGameState, clearSoloGameState, saveGameToHistory } from '@/hooks/useGameStatePersistence';
import WordsList from '@/components/WordsList';
import PlayerSpinner from '@/components/PlayerSpinner';
import { useIsMobile } from '@/hooks/use-mobile';
import lettusLogo from '@/assets/lettuslogo.png';

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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initializedRef = useRef(false);
  const cooldownTurns = 4;
  
  // Try to load saved state
  const savedState = !initializedRef.current ? loadSoloGameState() : null;
  
  // Generate ONE set of starting tiles that both player and AI share (identical starting position)
  const [grids] = useState<{ player: Grid; ai: Grid }>(() => {
    if (savedState?.playerGrid && savedState?.aiGrid) {
      return { player: savedState.playerGrid, ai: savedState.aiGrid };
    }
    // Generate shared starting grid and clone for both players
    const sharedStartingGrid = generateStartingTiles(boardSize);
    const playerGridCopy = sharedStartingGrid.map(row => row.map(cell => ({ ...cell })));
    const aiGridCopy = sharedStartingGrid.map(row => row.map(cell => ({ ...cell })));
    return { player: playerGridCopy, ai: aiGridCopy };
  });
  
  const [playerGrid, setPlayerGrid] = useState<Grid>(() => grids.player);
  const [aiGrid, setAIGrid] = useState<Grid>(() => grids.ai);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(() => (savedState?.currentPlayer as Player) || 1);
  const [playerScore, setPlayerScore] = useState(() => savedState?.playerScore || 0);
  const [aiScore, setAIScore] = useState(() => savedState?.aiScore || 0);
  const [playerCooldowns, setPlayerCooldowns] = useState<CooldownState>(() => savedState?.playerCooldowns || {});
  const [aiCooldowns, setAICooldowns] = useState<CooldownState>(() => savedState?.aiCooldowns || {});
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [gameEnded, setGameEnded] = useState(() => savedState?.gameEnded || false);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(() => savedState?.turnTimeRemaining || TURN_TIME_LIMIT);
  const [playerWords, setPlayerWords] = useState<string[]>(() => savedState?.playerWords || []);
  const [aiWords, setAIWords] = useState<string[]>(() => savedState?.aiWords || []);
  const [difficulty] = useState<DifficultyLevel>('medium');
  const [showSpinner, setShowSpinner] = useState(() => !savedState);
  
  // Mark as initialized
  useEffect(() => {
    initializedRef.current = true;
  }, []);
  
  // Persist game state on changes
  useEffect(() => {
    if (!gameEnded) {
      saveSoloGameState({
        playerGrid,
        aiGrid,
        currentPlayer,
        playerScore,
        aiScore,
        playerCooldowns,
        aiCooldowns,
        playerWords,
        aiWords,
        turnTimeRemaining,
        gameEnded,
        timestamp: Date.now()
      });
    }
  }, [playerGrid, aiGrid, currentPlayer, playerScore, aiScore, playerCooldowns, aiCooldowns, playerWords, aiWords, turnTimeRemaining, gameEnded]);

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
    if (gameEnded || showSpinner) return;

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
  }, [currentPlayer, gameEnded, playerGrid, aiGrid, showSpinner]);

  // AI turn logic
  useEffect(() => {
    if (currentPlayer === 2 && !gameEnded && !showSpinner) {
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
  }, [currentPlayer, gameEnded, aiGrid, showSpinner]);

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

  // Common words the AI prefers to form (realistic play)
  const commonWords = new Set([
    'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT',
    'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO',
    'BOY', 'DID', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'CAT', 'DOG', 'RUN', 'SUN', 'FUN', 'MAN',
    'BIG', 'RED', 'TOP', 'HAT', 'BAT', 'SAT', 'RAT', 'PAN', 'TAN', 'VAN', 'CUP', 'CUT', 'HUT', 'NUT',
    'BED', 'PET', 'SET', 'WET', 'YET', 'NET', 'MET', 'PEN', 'TEN', 'HEN', 'MEN', 'DEN', 'BIN', 'PIN',
    'WIN', 'TIN', 'FIN', 'SIT', 'BIT', 'HIT', 'KIT', 'FIT', 'PIT', 'HOT', 'POT', 'COT', 'DOT', 'GOT',
    'THAT', 'WITH', 'HAVE', 'THIS', 'WILL', 'YOUR', 'FROM', 'THEY', 'BEEN', 'CALL', 'COME', 'MADE',
    'FIND', 'JUST', 'OVER', 'TAKE', 'COME', 'MAKE', 'LIKE', 'BACK', 'ONLY', 'GOOD', 'LOOK', 'GIVE',
    'MOST', 'WANT', 'TIME', 'VERY', 'WHEN', 'THAN', 'SOME', 'INTO', 'YEAR', 'YOUR', 'WORK', 'LIFE',
    'HAND', 'PART', 'WORD', 'EACH', 'HEAR', 'HARD', 'PLAY', 'FEEL', 'HIGH', 'LAST', 'LONG', 'SAME',
    'WORLD', 'THINK', 'STILL', 'WOULD', 'AFTER', 'NEVER', 'COULD', 'GREAT', 'BEING', 'THOSE', 'SMALL',
    'WHERE', 'ABOUT', 'WHICH', 'THEIR', 'THERE', 'FIRST', 'WATER', 'HOUSE', 'EMPTY', 'PLACE', 'WHILE',
    'EVERY', 'RIGHT', 'NIGHT', 'LIGHT', 'POINT', 'THINK', 'THREE', 'YOUNG', 'YEARS', 'UNDER', 'STORY'
  ]);

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
      // Try to find the best scoring move, preferring common words
      let bestScore = -1;
      let bestCommonBonus = 0;
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
          
          // Calculate bonus for forming common words (AI prefers realistic words)
          const commonBonus = result.words.filter(w => commonWords.has(w.text)).length * 5;
          
          // Prefer moves that increase score, with bonus for common words
          const scoreDiff = result.score - aiScore;
          const totalScore = scoreDiff + commonBonus;
          
          // Prefer common words even with slightly lower score
          if (totalScore > bestScore + bestCommonBonus || 
              (totalScore === bestScore + bestCommonBonus && commonBonus > bestCommonBonus)) {
            bestScore = scoreDiff;
            bestCommonBonus = commonBonus;
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
    
    // Words are now shown in the WordsList component instead of toast
    if (newWordsFound.length > 0) {
      playFeedback('score');
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
    
    // Words are now shown in the WordsList component instead of toast
    if (newWordsFound.length > 0) {
      playFeedback('score');
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
    clearSoloGameState();
    playFeedback('gameEnd');
    
    // Determine winner
    const playerWon = playerScore > aiScore;
    const tie = playerScore === aiScore;
    
    // Save to local history
    saveGameToHistory({
      type: 'solo',
      players: [
        { name: 'You', score: playerScore, words: playerWords },
        { name: 'AI', score: aiScore, words: aiWords }
      ],
      winnerIndex: tie ? null : (playerWon ? 0 : 1)
    });
    
    if (playerWon) {
      celebrate();
    }
    setTimeout(() => setShowVictoryDialog(true), 500);
  };

  const handlePlayAgain = () => {
    // Clear saved state and reset
    clearSoloGameState();
    // Generate shared starting grid for both players (identical)
    const sharedStartingGrid = generateStartingTiles(boardSize);
    setPlayerGrid(sharedStartingGrid.map(row => row.map(cell => ({ ...cell }))));
    setAIGrid(sharedStartingGrid.map(row => row.map(cell => ({ ...cell }))));
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
    setShowSpinner(true);
  };

  const handleSpinnerComplete = (selectedPlayer: number) => {
    setCurrentPlayer(selectedPlayer as Player);
    setShowSpinner(false);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
  };

  const renderGrid = (isAI: boolean) => {
    const grid = isAI ? aiGrid : playerGrid;
    const canInteract = !isAI && isMyTurn && !gameEnded;
    const isActiveBoard = isAI ? (!isMyTurn && !gameEnded) : (isMyTurn && !gameEnded);
    
    return (
      <div className={`inline-grid gap-0.5 sm:gap-1 p-1 sm:p-2 md:p-3 rounded-xl shadow-lg transition-all ${
        isActiveBoard ? 'ring-4 ring-primary border-2 border-primary' : 'border-2 border-border/50'
      } bg-card/80`}
      style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlace = canInteract && selectedLetter && !cell.letter;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
              className={`
                  ${isMobile 
                    ? 'w-[8vw] h-[8vw] max-w-9 max-h-9' 
                    : 'w-[min(6vw,120px)] h-[min(6vw,120px)]'
                  } cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/40 rounded-lg
                  ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                  ${cell.letter ? (isAI ? 'bg-gradient-player-2' : 'bg-gradient-player-1') : ''}
                  ${canPlace ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                `}
                onClick={() => canPlace && placeLetter(rowIndex, colIndex)}
              >
                {cell.letter && (
                  <span className="font-bold text-xs sm:text-base md:text-lg lg:text-xl xl:text-2xl drop-shadow-lg text-white">
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
    const row1 = allLetters.slice(0, 13); // A-M
    const row2 = allLetters.slice(13);    // N-Z
    
    const renderLetter = (letter: string) => {
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
            w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded font-bold text-[10px] sm:text-sm md:text-base transition-all duration-200 relative
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
    };
    
    return (
      <div className="flex flex-col gap-1 sm:gap-2 justify-center items-center px-1">
        <div className="flex gap-[2px] sm:gap-1 md:gap-2 justify-center">
          {row1.map(renderLetter)}
        </div>
        <div className="flex gap-[2px] sm:gap-1 md:gap-2 justify-center">
          {row2.map(renderLetter)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Player Spinner for new games */}
      {showSpinner && (
        <PlayerSpinner 
          playerCount={2} 
          onComplete={handleSpinnerComplete}
          playerNames={['You', 'AI']}
        />
      )}
      
    <div className="h-[100dvh] p-1 sm:p-2 md:p-4 pt-safe max-w-7xl mx-auto flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}>
      {/* New Minimal Header */}
      <div className="flex items-center justify-between mb-2 px-2">
        {/* Home Button - Cabbage Logo */}
        <button
          onClick={() => {
            playFeedback('click');
            if (!gameEnded) {
              setShowBackConfirmDialog(true);
            } else {
              clearSoloGameState();
              if (onBackToMenu) {
                onBackToMenu();
              } else {
                navigate('/');
              }
            }
          }}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full hover:scale-110 transition-transform"
        >
          <img src={lettusLogo} alt="Home" className="w-full h-full object-contain" />
        </button>

        {/* Center: Timer and Progress Bar */}
        <div className="flex flex-col items-center flex-1 mx-4">
          <h1 className="text-sm md:text-base font-bold text-foreground mb-1">Solo Game</h1>
          {gameEnded ? (
            <div className="text-lg md:text-xl font-bold text-accent">
              {playerScore > aiScore ? 'You Win!' : playerScore < aiScore ? 'AI Wins' : 'Tie!'}
            </div>
          ) : (
            <>
              <div className={`text-3xl md:text-4xl font-bold tabular-nums ${
                turnTimeRemaining <= WARNING_THRESHOLD ? 'text-destructive animate-pulse' : 'text-foreground'
              }`}>
                {turnTimeRemaining}
              </div>
              <Progress 
                value={(turnTimeRemaining / TURN_TIME_LIMIT) * 100} 
                className="w-32 md:w-48 h-2 mt-1"
              />
            </>
          )}
        </div>

        {/* Spacer to balance layout */}
        <div className="w-10 h-10 md:w-12 md:h-12" />
      </div>

      {/* Game Grids with Word Lists - Side by side on desktop, stacked on mobile */}
      <div 
        className="flex flex-col md:flex-row items-center md:items-start justify-center gap-4 md:gap-8 flex-1 overflow-hidden"
      >
        {/* Your Section */}
        <div className="flex items-start gap-4">
          <WordsList words={playerWords} playerName="You" colorClass="text-player-1" />
          <div className="flex flex-col items-center">
            <div className="px-3 py-1 rounded-lg text-center shadow-md bg-card/80 border border-border mb-1">
              <div className="text-sm font-bold text-player-1">You: {playerScore}</div>
            </div>
            {renderGrid(false)}
          </div>
        </div>

        {/* AI Section */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div className="px-3 py-1 rounded-lg text-center shadow-md bg-card/80 border border-border mb-1">
              <div className="text-sm font-bold text-player-2">AI: {aiScore}</div>
            </div>
            {renderGrid(true)}
          </div>
          <WordsList words={aiWords} playerName="AI" colorClass="text-player-2" />
        </div>
      </div>

      {/* Available Letters - Below the boards */}
      {!gameEnded && (
        <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-1 sm:p-2 mx-1 sm:mx-auto mt-2">
          {renderAvailableLetters()}
        </div>
      )}

      {/* Back Confirmation Dialog */}
      <Dialog open={showBackConfirmDialog} onOpenChange={setShowBackConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">Leave Game?</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to go back? Your current game progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-center mt-4">
            <Button variant="outline" onClick={() => setShowBackConfirmDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                clearSoloGameState();
                setShowBackConfirmDialog(false);
                if (onBackToMenu) {
                  onBackToMenu();
                } else {
                  navigate('/');
                }
              }}
            >
              Leave Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
};

export default GameBoard;
