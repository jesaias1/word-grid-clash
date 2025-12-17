import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { useNavigate } from 'react-router-dom';
import { saveLocalMultiplayerState, loadLocalMultiplayerState, clearLocalMultiplayerState, saveGameToHistory } from '@/hooks/useGameStatePersistence';
import WordsList from '@/components/WordsList';
import PlayerSpinner from '@/components/PlayerSpinner';
import { useIsMobile } from '@/hooks/use-mobile';
import lettusLogo from '@/assets/lettuslogo.png';

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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initializedRef = useRef(false);
  
  // Try to load saved state
  const savedState = !initializedRef.current ? loadLocalMultiplayerState(playerCount) : null;
  
  // Generate ONE set of starting tiles that all players will share
  const [grids, setGrids] = useState<Grid[]>(() => {
    if (savedState?.grids) return savedState.grids;
    const sharedStartingGrid = generateStartingTiles(boardSize);
    return Array(playerCount).fill(null).map(() => 
      sharedStartingGrid.map(row => row.map(cell => ({ ...cell })))
    );
  });
  const [currentPlayer, setCurrentPlayer] = useState<Player>(() => savedState?.currentPlayer || 1);
  const [scores, setScores] = useState<number[]>(() => savedState?.scores || Array(playerCount).fill(0));
  const [cooldowns, setCooldowns] = useState<CooldownState>(() => savedState?.cooldowns || {}); // Shared cooldowns
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(() => savedState?.gameEnded || false);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(() => savedState?.turnTimeRemaining || TURN_TIME_LIMIT);
  const [playerWords, setPlayerWords] = useState<string[][]>(() => savedState?.playerWords || Array(playerCount).fill(null).map(() => []));
  const [winner, setWinner] = useState<Player | null>(null);
  const [showTurnTransition, setShowTurnTransition] = useState(false);
  const [transitionToPlayer, setTransitionToPlayer] = useState<number | null>(null);
  
  // Show spinner only for new games (no saved state)
  const [showSpinner, setShowSpinner] = useState(() => !savedState);
  
  // Mark as initialized
  useEffect(() => {
    initializedRef.current = true;
  }, []);
  
  // Persist game state on changes
  useEffect(() => {
    if (!gameEnded) {
      saveLocalMultiplayerState({
        grids,
        currentPlayer,
        scores,
        cooldowns,
        playerWords,
        turnTimeRemaining,
        gameEnded,
        timestamp: Date.now()
      }, playerCount);
    }
  }, [grids, currentPlayer, scores, cooldowns, playerWords, turnTimeRemaining, gameEnded, playerCount]);

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
    if (gameEnded || showSpinner) return;

    // Skip turn immediately if current player's board is full
    if (isPlayerGridFull(currentPlayer - 1)) {
      const nextPlayer = getNextActivePlayer(currentPlayer + 1);
      if (nextPlayer === null) {
        // All boards full - end game
        endLocalGame(scores, playerWords);
      } else {
        // Show turn transition animation
        setTransitionToPlayer(nextPlayer);
        setShowTurnTransition(true);
        setTimeout(() => {
          setShowTurnTransition(false);
          setTransitionToPlayer(null);
          setCurrentPlayer(nextPlayer);
          setTurnTimeRemaining(TURN_TIME_LIMIT);
        }, 1200);
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
  }, [currentPlayer, gameEnded, grids, showSpinner]);
  
  const endLocalGame = (finalScores: number[], finalWords: string[][]) => {
    setGameEnded(true);
    clearLocalMultiplayerState(playerCount);
    playFeedback('gameEnd');
    
    const maxScore = Math.max(...finalScores);
    const winnersCount = finalScores.filter(s => s === maxScore).length;
    const isTie = winnersCount > 1;
    const winnerIdx = isTie ? null : finalScores.indexOf(maxScore);
    
    if (!isTie) {
      setWinner(winnerIdx! + 1);
      celebrate();
    }
    
    // Save to local history
    saveGameToHistory({
      type: 'local',
      playerCount,
      players: finalScores.map((score, idx) => ({
        name: `Player ${idx + 1}`,
        score,
        words: finalWords[idx] || []
      })),
      winnerIndex: winnerIdx
    });
    
    setTimeout(() => setShowVictoryDialog(true), 500);
  };

  const handleTurnTimeout = () => {
    const newScores = [...scores];
    newScores[currentPlayer - 1] = Math.max(0, scores[currentPlayer - 1] - 5);
    setScores(newScores);
    
    const nextPlayer = getNextActivePlayer(currentPlayer + 1);
    if (nextPlayer === null) {
      // All boards full
      endLocalGame(newScores, playerWords);
    } else {
      // Show turn transition animation
      setTransitionToPlayer(nextPlayer);
      setShowTurnTransition(true);
      setTimeout(() => {
        setShowTurnTransition(false);
        setTransitionToPlayer(null);
        setCurrentPlayer(nextPlayer);
        setTurnTimeRemaining(TURN_TIME_LIMIT);
      }, 1200);
    }
  };

  const handlePlayAgain = () => {
    // Clear saved state and reset
    clearLocalMultiplayerState(playerCount);
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
    setShowTurnTransition(false);
    setTransitionToPlayer(null);
    setShowSpinner(true); // Show spinner for new game
  };
  
  const handleSpinnerComplete = (selectedPlayer: number) => {
    setCurrentPlayer(selectedPlayer);
    setShowSpinner(false);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
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
    
    // Words are now shown in the WordsList component instead of toast
    if (newWordsFound.length > 0) {
      playFeedback('score');
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
      endLocalGame(newScores, newPlayerWords);
    } else {
      // Show turn transition animation
      setTransitionToPlayer(nextPlayer);
      setShowTurnTransition(true);
      playFeedback('turnChange');
      setTimeout(() => {
        setShowTurnTransition(false);
        setTransitionToPlayer(null);
        setCurrentPlayer(nextPlayer);
        setTurnTimeRemaining(TURN_TIME_LIMIT);
      }, 1200);
    }
  };

  const renderGrid = (playerIndex: number) => {
    const grid = grids[playerIndex];
    const isCurrentPlayer = currentPlayer === playerIndex + 1;
    const canInteract = isCurrentPlayer && !gameEnded;
    
    return (
      <div className={`inline-grid gap-0.5 sm:gap-1 p-1 sm:p-2 md:p-3 rounded-xl shadow-lg transition-all ${
        canInteract ? 'ring-4 ring-primary border-2 border-primary' : 'border-2 border-border/50'
      } bg-card/80`}
      style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlace = canInteract && selectedLetter && !cell.letter;
            
            const playerColors = [
              'bg-gradient-player-1',
              'bg-gradient-player-2', 
              'bg-gradient-player-3',
              'bg-gradient-player-4',
              'bg-gradient-player-5'
            ];
            
            // Responsive cell sizes based on player count - scales dynamically on desktop
            const cellSize = isMobile
              ? (playerCount >= 4 
                  ? 'w-[8vw] h-[8vw] max-w-7 max-h-7' 
                  : playerCount === 3 
                    ? 'w-[5.5vw] h-[5.5vw] max-w-6 max-h-6' 
                    : 'w-[8vw] h-[8vw] max-w-9 max-h-9')
              : (playerCount >= 4 
                  ? 'w-[min(5vw,80px)] h-[min(5vw,80px)]' 
                  : playerCount === 3 
                    ? 'w-[min(5.5vw,100px)] h-[min(5.5vw,100px)]' 
                    : 'w-[min(6vw,120px)] h-[min(6vw,120px)]');
            
            const fontSize = playerCount >= 4
              ? 'text-[7px] sm:text-[9px] md:text-xs lg:text-sm xl:text-base'
              : playerCount === 3
                ? 'text-[8px] sm:text-xs md:text-sm lg:text-base xl:text-lg'
                : 'text-xs sm:text-base md:text-lg lg:text-xl xl:text-2xl';
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  ${cellSize} cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/40 rounded-lg
                  ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                  ${cell.letter ? playerColors[playerIndex] || 'bg-gradient-primary' : ''}
                  ${canPlace ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                `}
                onClick={() => canPlace && placeLetter(playerIndex, rowIndex, colIndex)}
              >
                {cell.letter && (
                  <span className={`font-bold ${fontSize} drop-shadow-lg text-white`}>
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

  const getPlayerColor = (index: number) => {
    const colors = ['text-player-1', 'text-player-2', 'text-player-3', 'text-player-4', 'text-player-5'];
    return colors[index] || 'text-player-1';
  };

  const getPlayerBgColor = (index: number, isActive: boolean) => {
    const activeColors = [
      'bg-player-1/20 border-2 border-player-1/30',
      'bg-player-2/20 border-2 border-player-2/30',
      'bg-player-3/20 border-2 border-player-3/30',
      'bg-player-4/20 border-2 border-player-4/30',
      'bg-player-5/20 border-2 border-player-5/30'
    ];
    return isActive 
      ? `${activeColors[index] || activeColors[0]} scale-105 animate-fade-in`
      : 'bg-card/80 border border-border opacity-70';
  };

  return (
    <>
      {/* Player Spinner for new games */}
      {showSpinner && (
        <PlayerSpinner 
          playerCount={playerCount} 
          onComplete={handleSpinnerComplete}
          playerNames={Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`)}
        />
      )}
      
    <div className="h-[100dvh] p-0.5 sm:p-1 md:p-2 max-w-7xl mx-auto flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}>
      {/* New Minimal Header */}
      <div className="flex items-center justify-between mb-2 px-2">
        {/* Home Button - Cabbage Logo */}
        <button
          onClick={() => {
            playFeedback('click');
            if (!gameEnded) {
              setShowBackConfirmDialog(true);
            } else {
              clearLocalMultiplayerState(playerCount);
              onBackToMenu();
            }
          }}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full hover:scale-110 transition-transform"
        >
          <img src={lettusLogo} alt="Home" className="w-full h-full object-contain" />
        </button>

        {/* Center: Timer and Progress Bar */}
        <div className="flex flex-col items-center flex-1 mx-4">
          <h1 className="text-sm md:text-base font-bold text-foreground mb-1">{playerCount} Player Local</h1>
          {gameEnded ? (
            <div className="text-lg md:text-xl font-bold text-accent">
              {winner ? `Player ${winner} Wins!` : 'Tie!'}
            </div>
          ) : (
            <>
              <div className={`text-3xl md:text-4xl font-bold tabular-nums transition-colors ${
                turnTimeRemaining <= 5 ? 'text-red-500' : 
                turnTimeRemaining <= 10 ? 'text-yellow-500' : 
                'text-primary'
              } ${turnTimeRemaining <= 5 ? 'animate-pulse' : ''}`}>
                {turnTimeRemaining}
              </div>
              <Progress 
                value={(turnTimeRemaining / TURN_TIME_LIMIT) * 100} 
                className="w-48 md:w-64 h-3 mt-1"
                indicatorClassName={
                  turnTimeRemaining <= 5 ? 'bg-red-500' : 
                  turnTimeRemaining <= 10 ? 'bg-yellow-500' : 
                  'bg-primary'
                }
              />
            </>
          )}
        </div>

        {/* Spacer to balance layout */}
        <div className="w-10 h-10 md:w-12 md:h-12" />
      </div>

      {/* Game Grids with Word Lists - Side by side on desktop for 2 players, responsive grid for more */}
      <div 
        className={`flex flex-1 min-h-0 overflow-auto ${
          playerCount === 2 
            ? 'flex-col md:flex-row items-center md:items-start justify-center gap-2 md:gap-8' 
            : 'flex-col items-center gap-1'
        }`}
      >
        {playerCount === 2 ? (
          /* 2 players: side by side on desktop with word lists */
          <>
            {grids.map((_, idx) => {
              const playerColorClasses = ['text-player-1', 'text-player-2'];
              return (
                <div key={idx} className="flex items-start gap-4">
                  {idx === 0 && (
                    <WordsList words={playerWords[idx] || []} playerName={`P${idx + 1}`} colorClass={playerColorClasses[idx]} />
                  )}
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-1 rounded-lg text-center shadow-md bg-card/80 border border-border mb-1">
                      <div className={`text-sm font-bold ${getPlayerColor(idx)}`}>P{idx + 1}: {scores[idx]}</div>
                    </div>
                    {renderGrid(idx)}
                  </div>
                  {idx === 1 && (
                    <WordsList words={playerWords[idx] || []} playerName={`P${idx + 1}`} colorClass={playerColorClasses[idx]} />
                  )}
                </div>
              );
            })}
          </>
        ) : (
          /* 3+ players: responsive grid with word lists below each grid */
          <div className={`grid gap-0.5 w-full justify-items-center ${
            playerCount <= 3 ? 'grid-cols-1 md:grid-cols-3' : playerCount === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3 md:grid-cols-5'
          }`}>
            {grids.map((_, idx) => {
              const playerColorClasses = ['text-player-1', 'text-player-2', 'text-player-3', 'text-player-4', 'text-player-5'];
              return (
                <div key={idx} className="flex flex-col items-center">
                  <div className="px-2 py-0.5 rounded-lg text-center shadow-md bg-card/80 border border-border mb-0.5">
                    <div className={`text-xs font-bold ${getPlayerColor(idx)}`}>P{idx + 1}: {scores[idx]}</div>
                  </div>
                  <div className="flex items-start gap-1">
                    {renderGrid(idx)}
                    {/* Hide WordsList for 4+ players on mobile to save space */}
                    {playerCount < 4 && (
                      <WordsList words={playerWords[idx] || []} playerName={`P${idx + 1}`} colorClass={playerColorClasses[idx]} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Letters - Below the boards */}
      {!gameEnded && (
        <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-1 sm:p-2 mx-1 sm:mx-auto mt-2">
          {renderAvailableLetters()}
        </div>
      )}

      {/* Turn Transition Overlay */}
      {showTurnTransition && transitionToPlayer && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="text-center space-y-4 animate-scale-in">
            <div className="text-6xl font-bold text-primary animate-pulse">
              Player {transitionToPlayer}
            </div>
            <div className="text-2xl text-muted-foreground">
              Your turn!
            </div>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="w-3 h-3 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

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

            <div className={`grid ${playerCount >= 4 ? 'grid-cols-2 sm:grid-cols-3' : playerCount === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
              {playerWords.map((words, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold mb-2 text-center text-sm">Player {idx + 1}'s Words</h3>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                    {words.length > 0 ? (
                      words.map((word, wIdx) => (
                        <div key={wIdx} className="text-xs bg-accent/50 rounded px-2 py-1">
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
                clearLocalMultiplayerState(playerCount);
                setShowBackConfirmDialog(false);
                onBackToMenu();
              }}
            >
              Leave Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};

export default LocalMultiplayerBoard;
