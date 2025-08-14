import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  letterPool: string[]; // Available letters for the game
  difficulty: DifficultyLevel; // AI difficulty level
}

const GRID_ROWS = 5;
const GRID_COLS = 5;
const COOLDOWN_TURNS = 5;
const TURN_TIME = 30; // 30 seconds per turn
const WINNING_SCORE = 25; // Game ends when someone reaches this score

type DifficultyLevel = 'easy' | 'medium' | 'hard';

// All 26 letters are available - cooldown is the only restriction
const generateLetterPool = (): string[] => {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
};

// Generate starting tiles - 5 predetermined letters, same for both players
const generateStartingTiles = (letterPool: string[]): Array<{ row: number; col: number; letter: string }> => {
  const tiles: Array<{ row: number; col: number; letter: string }> = [];
  
  // Pick 5 random letters from common letters for starting tiles
  const commonLetters = ['A', 'E', 'I', 'O', 'U', 'R', 'S', 'T', 'L', 'N'];
  const startingLetters = [];
  for (let i = 0; i < 5; i++) {
    const letter = commonLetters[Math.floor(Math.random() * commonLetters.length)];
    startingLetters.push(letter);
  }
  
  // Place one letter in each row at random column
  for (let row = 0; row < GRID_ROWS; row++) {
    const col = Math.floor(Math.random() * GRID_COLS);
    tiles.push({ row, col, letter: startingLetters[row] });
  }
  
  return tiles;
};

const GameBoard = () => {
  // Initialize game with starting tiles
  const initializeGame = () => {
    const letterPool = generateLetterPool();
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
      timeLeft: TURN_TIME,
      letterPool, // Store the letter pool in game state
      difficulty: 'medium' as DifficultyLevel
    };
  };

  const [gameState, setGameState] = useState<GameState>(initializeGame());
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [selectedLetter, setSelectedLetter] = useState<Letter>('');
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');

  // Set available letters from game state
  useEffect(() => {
    setAvailableLetters(gameState.letterPool || []);
  }, [gameState.letterPool]);

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
          // Time's up - automatically pass turn or trigger AI move
          if (prev.currentPlayer === 2) {
            // AI turn - make a move
            makeAIMove(prev);
            return prev;
          } else {
            // Player turn timeout - pass to AI
            return {
              ...prev,
              currentPlayer: 2 as Player,
              turn: prev.turn + 1,
              timeLeft: TURN_TIME
            };
          }
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.currentPlayer, gameState.gameEnded, gameState.timeLeft]);

  // AI move trigger
  useEffect(() => {
    if (gameState.currentPlayer === 2 && !gameState.gameEnded) {
      const aiDelay = Math.random() * 2000 + 1000; // 1-3 seconds thinking time
      const timer = setTimeout(() => {
        makeAIMove(gameState);
      }, aiDelay);
      
      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayer, gameState.gameEnded]);

  const makeAIMove = async (currentState: GameState) => {
    const dict = await loadDictionary();
    const aiGrid = currentState.grids[1]; // AI is player 2
    const availableCells: Array<{row: number, col: number}> = [];
    
    // Find empty cells in AI grid
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (aiGrid[row][col] === null) {
          availableCells.push({row, col});
        }
      }
    }
    
    if (availableCells.length === 0) return;
    
    // Get available letters (not on cooldown) - ALL 26 letters are available
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const availableAILetters = allLetters.filter(letter => !isLetterOnCooldown(letter));
    if (availableAILetters.length === 0) {
      // No letters available, pass turn
      setGameState(prev => ({
        ...prev,
        currentPlayer: 1 as Player,
        turn: prev.turn + 1,
        timeLeft: TURN_TIME
      }));
      return;
    }
    
    let bestMove: {letter: string, row: number, col: number, score: number} | null = null;
    let bestScore = -10;
    
    // AI strategy based on difficulty level
    const difficultySettings = {
      easy: { 
        maxMoves: 15, 
        lettersToEvaluate: 3, 
        randomness: 1.2, 
        blockingWeight: 0.1,
        centerWeight: 0.3
      },
      medium: { 
        maxMoves: 40, 
        lettersToEvaluate: 6, 
        randomness: 0.8, 
        blockingWeight: 0.5,
        centerWeight: 0.8
      },
      hard: { 
        maxMoves: 80, 
        lettersToEvaluate: 10, 
        randomness: 0.3, 
        blockingWeight: 1.0,
        centerWeight: 1.2
      }
    };
    
    const settings = difficultySettings[difficulty];
    
    // Focus on common letters
    const commonLetters = ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'D', 'L', 'U', 'C', 'M', 'W', 'F', 'G', 'Y', 'P', 'B', 'V', 'K', 'J', 'X', 'Q', 'Z'];
    const availableCommonLetters = commonLetters.filter(letter => availableAILetters.includes(letter));
    const lettersToUse = availableCommonLetters.length > 0 ? availableCommonLetters : availableAILetters;
    
    const maxMovesToEvaluate = Math.min(availableCells.length * lettersToUse.length, settings.maxMoves);
    let movesEvaluated = 0;
    
    // Shuffle cells for variety, but keep common letters prioritized
    const shuffledCells = [...availableCells].sort(() => Math.random() - 0.5);
    
    for (const letter of lettersToUse.slice(0, settings.lettersToEvaluate)) {
      for (const cell of shuffledCells) {
        if (movesEvaluated >= maxMovesToEvaluate) break;
        movesEvaluated++;
        
        // Create test grid
        const testGrid = aiGrid.map(row => [...row]);
        testGrid[cell.row][cell.col] = letter;
        
        // Calculate AI's score improvement
        const currentAIResult = scoreGrid(aiGrid, dict, currentState.usedWords[1], 3);
        const newAIResult = scoreGrid(testGrid, dict, currentState.usedWords[1], 3);
        const aiScoreGain = newAIResult.score - currentAIResult.score;
        
        let moveValue = 0;
        
        // Prioritize actual scoring moves
        if (aiScoreGain > 0) {
          moveValue += aiScoreGain * 3; // Strong weight for scoring
        }
        
        // Position value - center is better (scaled by difficulty)
        const centerDistance = Math.abs(cell.row - 2) + Math.abs(cell.col - 2);
        moveValue += (4 - centerDistance) * settings.centerWeight;
        
        // Adjacent bonus - building connectivity
        const adjacentPositions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let adjacentCount = 0;
        for (const [dx, dy] of adjacentPositions) {
          const newRow = cell.row + dx;
          const newCol = cell.col + dy;
          if (newRow >= 0 && newRow < GRID_ROWS && newCol >= 0 && newCol < GRID_COLS) {
            if (testGrid[newRow][newCol] !== null) {
              adjacentCount++;
            }
          }
        }
        moveValue += adjacentCount * 1.2;
        
        // Blocking consideration (scaled by difficulty)
        const playerGrid = currentState.grids[0];
        const playerResult = scoreGrid(playerGrid, dict, currentState.usedWords[0], 3);
        
        // Check positions for blocking based on difficulty
        const blockingChecks = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 3 : 5;
        for (let i = 0; i < Math.min(blockingChecks, availableCells.length); i++) {
          const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
          const testPlayerGrid = playerGrid.map(row => [...row]);
          testPlayerGrid[randomCell.row][randomCell.col] = letter;
          const potentialPlayerResult = scoreGrid(testPlayerGrid, dict, currentState.usedWords[0], 3);
          const playerPotentialGain = potentialPlayerResult.score - playerResult.score;
          
          if (playerPotentialGain > 2) {
            moveValue += Math.min(playerPotentialGain * settings.blockingWeight, 6);
          }
        }
        
        // Add randomness based on difficulty level
        const randomRange = settings.randomness;
        const randomFactor = (2 - randomRange) / 2 + Math.random() * randomRange;
        const finalScore = moveValue * randomFactor;
        
        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMove = {letter, row: cell.row, col: cell.col, score: finalScore};
        }
      }
    }
    
    // Fallback: if no good move found, pick randomly
    if (!bestMove && availableCells.length > 0 && availableAILetters.length > 0) {
      const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
      const randomLetter = availableAILetters[Math.floor(Math.random() * availableAILetters.length)];
      bestMove = {letter: randomLetter, row: randomCell.row, col: randomCell.col, score: 0};
    }
    
    // Make the AI move
    if (bestMove) {
      setGameState(prev => {
        const newGrids: [Grid, Grid] = [
          prev.grids[0].map(row => [...row]),
          prev.grids[1].map(row => [...row])
        ];
        
        // Place AI letter
        newGrids[1][bestMove.row][bestMove.col] = bestMove.letter;
        
        // Calculate new scores for both players (cumulative from all previous turns)
        const result1 = scoreGrid(newGrids[0], dict, new Set(), 3); // Reset used words to get total current score
        const result2 = scoreGrid(newGrids[1], dict, new Set(), 3); // Reset used words to get total current score
        
        // Update shared cooldowns
        const newSharedCooldowns: CooldownState = { ...prev.sharedCooldowns };
        
        // Decrease existing shared cooldowns
        Object.keys(newSharedCooldowns).forEach(letter => {
          if (newSharedCooldowns[letter] > 0) {
            newSharedCooldowns[letter]--;
            if (newSharedCooldowns[letter] === 0) {
              delete newSharedCooldowns[letter];
            }
          }
        });
        
        // Set cooldown for AI's used letter
        newSharedCooldowns[bestMove.letter] = COOLDOWN_TURNS;

        // Check if game should end
        const areAllGridsFull = newGrids.every(grid => 
          grid.every(row => row.every(cell => cell !== null))
        );
        
        let gameEnded = false;
        let winner: Player | null = null;
        
        // Check for winner by score first
        if (result1.score >= WINNING_SCORE || result2.score >= WINNING_SCORE) {
          gameEnded = true;
          winner = result1.score > result2.score ? 1 : result2.score > result1.score ? 2 : null;
        } else if (areAllGridsFull) {
          gameEnded = true;
          winner = result1.score > result2.score ? 1 : result2.score > result1.score ? 2 : null;
        }

        const newState = {
          ...prev,
          grids: newGrids,
          currentPlayer: 1 as Player, // Back to player
          turn: prev.turn + 1,
          scores: [result1.score, result2.score] as [number, number],
          usedWords: [result1.newUsedWords, result2.newUsedWords] as [Set<string>, Set<string>],
          scoredCells: [result1.scoredCells, result2.scoredCells] as [Set<string>, Set<string>],
          sharedCooldowns: newSharedCooldowns,
          gameEnded,
          winner,
          timeLeft: TURN_TIME
        };
        
        // Show winner dialog if game ended
        if (gameEnded) {
          setTimeout(() => setShowWinnerDialog(true), 500);
        }
        
        return newState;
      });
    } else {
      // No valid move, pass turn
      setGameState(prev => ({
        ...prev,
        currentPlayer: 1 as Player,
        turn: prev.turn + 1,
        timeLeft: TURN_TIME
      }));
    }
  };

  // Keyboard input effect
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (gameState.gameEnded || gameState.currentPlayer !== 1) return;
      
      const letter = event.key.toUpperCase();
      const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      if (allLetters.includes(letter) && !isLetterOnCooldown(letter)) {
        setSelectedLetter(letter);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState.gameEnded, gameState.currentPlayer, gameState.sharedCooldowns]);

  

  const isLetterOnCooldown = (letter: Letter): boolean => {
    const cooldown = gameState.sharedCooldowns[letter];
    return cooldown !== undefined && cooldown > 0;
  };

  const getLetterCooldown = (letter: Letter): number => {
    return gameState.sharedCooldowns[letter] || 0;
  };

  const placeLetter = async (row: number, col: number, targetPlayerIndex: number) => {
    if (!selectedLetter || gameState.gameEnded || gameState.currentPlayer !== 1) return;
    
    const targetGrid = gameState.grids[targetPlayerIndex];
    
    if (targetGrid[row][col] !== null) return; // Cell already occupied
    if (isLetterOnCooldown(selectedLetter)) return; // Letter on shared cooldown

    const dict = await loadDictionary();

    setGameState(prev => {
      const newGrids: [Grid, Grid] = [
        prev.grids[0].map(row => [...row]),
        prev.grids[1].map(row => [...row])
      ];
      
      // Place the letter on the target grid
      newGrids[targetPlayerIndex][row][col] = selectedLetter;
      
      // Calculate new scores for both players (cumulative from all previous turns)
      const result1 = scoreGrid(newGrids[0], dict, new Set(), 3); // Reset used words to get total current score
      const result2 = scoreGrid(newGrids[1], dict, new Set(), 3); // Reset used words to get total current score
      
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

      // Check if game should end
      const areAllGridsFull = newGrids.every(grid => 
        grid.every(row => row.every(cell => cell !== null))
      );
      
      let gameEnded = false;
      let winner: Player | null = null;
      
      // Check for winner by score first
      if (result1.score >= WINNING_SCORE || result2.score >= WINNING_SCORE) {
        gameEnded = true;
        winner = result1.score > result2.score ? 1 : result2.score > result1.score ? 2 : null;
      } else if (areAllGridsFull) {
        gameEnded = true;
        winner = result1.score > result2.score ? 1 : result2.score > result1.score ? 2 : null;
      }

      const newState = {
        ...prev,
        grids: newGrids,
        currentPlayer: 2 as Player, // Pass to AI
        turn: prev.turn + 1,
        scores: [result1.score, result2.score] as [number, number],
        usedWords: [result1.newUsedWords, result2.newUsedWords] as [Set<string>, Set<string>],
        scoredCells: [result1.scoredCells, result2.scoredCells] as [Set<string>, Set<string>],
        sharedCooldowns: newSharedCooldowns,
        gameEnded,
        winner,
        timeLeft: TURN_TIME // Reset timer for next player
      };
      
      // Show winner dialog if game ended
      if (gameEnded) {
        setTimeout(() => setShowWinnerDialog(true), 500);
      }
      
      return newState;
    });

    setSelectedLetter('');
  };

  const resetGame = () => {
    setGameState(initializeGame());
    setSelectedLetter('');
    setShowWinnerDialog(false);
  };


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
            const canPlaceLetter = !gameState.gameEnded && selectedLetter && !cell && gameState.currentPlayer === 1;
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
                onClick={() => !gameState.gameEnded && gameState.currentPlayer === 1 && placeLetter(rowIndex, colIndex, playerIndex)}
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

  const renderAvailableLetters = () => {
    // Show ALL 26 letters of the alphabet
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    return (
      <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-4 mx-auto mb-4 max-w-6xl">
        <div className="text-center mb-3">
          <span className="text-sm font-semibold text-muted-foreground">All Letters (Click to Select)</span>
        </div>
        <div className="grid grid-cols-13 gap-1 justify-center max-w-4xl mx-auto">
          {allLetters.map(letter => {
            const isOnCooldown = isLetterOnCooldown(letter);
            const isSelected = selectedLetter === letter;
            const cooldownTurns = getLetterCooldown(letter);
            
            return (
              <button
                key={letter}
                onClick={() => !isOnCooldown && !gameState.gameEnded && gameState.currentPlayer === 1 && setSelectedLetter(letter)}
                disabled={isOnCooldown || gameState.gameEnded || gameState.currentPlayer !== 1}
                className={`
                  relative rounded-lg font-bold transition-all duration-200 flex flex-col items-center justify-center
                  ${isOnCooldown ? 
                    'w-16 h-16 bg-destructive/20 text-destructive border-2 border-destructive/50 cursor-not-allowed' : 
                    'w-12 h-12'}
                  ${isSelected && !isOnCooldown ? 'bg-primary text-primary-foreground scale-110 shadow-lg' : ''}
                  ${!isOnCooldown && !isSelected ? 'bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-105 border-2 border-border' : ''}
                `}
              >
                <span className={`${isOnCooldown ? 'text-lg' : 'text-sm'}`}>
                  {letter}
                </span>
                {isOnCooldown && (
                  <span className="text-xs font-normal">{cooldownTurns}</span>
                )}
              </button>
            );
          })}
        </div>
        {!gameState.gameEnded && gameState.currentPlayer === 1 && (
          <div className="text-center mt-2">
            <span className="text-xs text-muted-foreground">
              {allLetters.filter(l => !isLetterOnCooldown(l)).length} letters available • Press any key to select
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderLetterCooldowns = () => {
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const onCooldownLetters = allLetters.filter(letter => isLetterOnCooldown(letter));
    if (onCooldownLetters.length === 0) return null;
    
    return (
      <div className="bg-destructive/10 border-2 border-destructive/30 rounded-lg p-3 mx-auto mb-2 max-w-4xl">
        <div className="text-center mb-2">
          <span className="text-sm font-bold text-destructive">⚠️ Letters on Cooldown ({onCooldownLetters.length})</span>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {onCooldownLetters.map(letter => (
            <div key={letter} className="bg-destructive/20 border border-destructive/50 rounded-lg p-2 min-w-[3rem]">
              <div className="text-lg font-bold text-destructive text-center">
                {letter}
              </div>
              <div className="text-xs text-center text-destructive font-medium">
                {getLetterCooldown(letter)} turns
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-2">
          <span className="text-xs text-destructive/80">These letters cannot be used until their cooldown expires</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen p-3 space-y-3 max-w-6xl mx-auto flex flex-col">
      {/* Winner Dialog */}
      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">
              🎉 Game Over! 🎉
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-center space-y-4">
                <div className="text-lg">
                  {gameState.winner === 1 ? (
                    <span className="text-player-1 font-bold">You Win!</span>
                  ) : gameState.winner === 2 ? (
                    <span className="text-player-2 font-bold">AI Bot Wins!</span>
                  ) : (
                    <span className="font-bold">It's a Tie!</span>
                  )}
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-2">Final Scores:</div>
                  <div className="flex justify-center gap-8">
                    <div className="text-center">
                      <div className="text-sm font-medium text-player-1">You</div>
                      <div className="text-2xl font-bold">{gameState.scores[0]}</div>
                      <div className="text-xs text-muted-foreground">letters</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-player-2">AI Bot</div>
                      <div className="text-2xl font-bold">{gameState.scores[1]}</div>
                      <div className="text-xs text-muted-foreground">letters</div>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {gameState.winner ? 
                    `${gameState.winner === 1 ? 'You' : 'AI Bot'} reached ${Math.max(gameState.scores[0], gameState.scores[1])} letters first!` :
                    'Both players had the same score!'
                  }
                </div>
                
                <Button onClick={resetGame} className="w-full" size="lg">
                  Play Again
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS
        </h1>
        <p className="text-xs text-muted-foreground">Type a letter, then click to place it</p>
        
        {/* Difficulty Selector */}
        <div className="flex justify-center items-center gap-2">
          <span className="text-xs text-muted-foreground">AI Difficulty:</span>
          {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => {
                setDifficulty(level);
                setGameState(prev => ({ ...prev, difficulty: level }));
              }}
              disabled={gameState.currentPlayer === 2 && !gameState.gameEnded}
              className={`
                px-2 py-1 text-xs rounded-md font-medium transition-colors
                ${difficulty === level 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-accent hover:text-accent-foreground'
                }
                ${gameState.currentPlayer === 2 && !gameState.gameEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Player Scores */}
        <Card className="p-3 bg-gradient-card">
          <div className="flex justify-center items-center gap-8">
            <div className={`text-center ${gameState.currentPlayer === 1 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-1">You</div>
              <div className="text-xl font-bold">{gameState.scores[0]}</div>
            </div>
            <div className={`text-center ${gameState.currentPlayer === 2 ? 'score-glow' : ''}`}>
              <div className="text-sm font-bold text-player-2">AI Bot</div>
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
                  {gameState.currentPlayer === 1 ? (
                    <span className="text-player-1">Your Turn</span>
                  ) : (
                    <span className="text-player-2">AI Thinking...</span>
                  )}
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

      {/* All Letters Display */}
      {renderAvailableLetters()}

      {/* Prominent Cooldown Warning */}
      {renderLetterCooldowns()}

      {/* Game Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-1 text-center">Your Grid</h2>
          {renderGrid(0)}
        </div>
        
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-player-2 text-center">AI Bot Grid</h2>
          {renderGrid(1)}
        </div>
      </div>

      {/* Compact Rules */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          30s per turn • 3+ letter words • Each word once per player • First to {WINNING_SCORE} letters wins!
        </div>
      </div>
    </div>
  );
};

export default GameBoard;