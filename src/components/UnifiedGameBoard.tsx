import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { GameProvider, useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';
import { Scoreboard } from '@/components/Scoreboard';
import { AttackBar } from '@/components/AttackBar';
import { GameGrid } from '@/components/GameGrid';
import { CurrentLetterDisplay } from '@/components/CurrentLetterDisplay';
import { loadDictionary } from '@/lib/dictionary';
import { calculateBoardScore } from '@/lib/gameScoring';

interface UnifiedGameBoardProps {
  onBackToMenu: () => void;
  boardSize?: 5 | 7 | 10;
  mode: 'solo' | 'passplay';
}

const TURN_TIME = 30;

const UnifiedGameBoardInner = ({ onBackToMenu, boardSize = 5, mode }: UnifiedGameBoardProps) => {
  const { state } = useGame();
  const { onRoundEnd, onNewGame, onBoardSizeChange, initializePlayers, endTurn, onSelectCell } = useGameEvents();
  
  // Local game state
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  
  // Initialize players when component mounts
  useEffect(() => {
    if (!gameStarted) {
      const playerNames = mode === 'solo' ? ['You', 'AI'] : ['Player 1', 'Player 2'];
      initializePlayers(playerNames, mode);
      onBoardSizeChange(boardSize);
      setGameStarted(true);
    }
  }, [mode, boardSize]);
  
  // Timer effect
  useEffect(() => {
    if (gameEnded || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          passTurn();
          return TURN_TIME;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.activePlayerId, gameEnded]);
  
  // AI move effect for solo mode
  useEffect(() => {
    if (mode === 'solo' && state.activePlayerId === 'player-2' && !gameEnded) {
      const aiDelay = Math.random() * 2000 + 1000; // 1-3 seconds thinking time
      const timer = setTimeout(() => {
        makeAIMove();
      }, aiDelay);
      
      return () => clearTimeout(timer);
    }
  }, [state.activePlayerId, mode, gameEnded]);
  
  // Update board size
  useEffect(() => {
    onBoardSizeChange(boardSize);
  }, [boardSize]);

  const makeAIMove = async () => {
    const aiGrid = state.boardByPlayer['player-2'];
    const availableCells: Array<{row: number, col: number}> = [];
    
    // Find empty cells in AI grid
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!aiGrid[row][col]) {
          availableCells.push({row, col});
        }
      }
    }
    
    if (availableCells.length === 0) {
      endTurn();
      return;
    }
    
    // Simple AI: try to place letter to form valid words
    let bestMove: {row: number, col: number, score: number} | null = null;
    let bestScore = -1;
    
    // Test each available cell with the current letter
    for (const cell of availableCells) {
      // Create test grid with this move
      const testGrid = aiGrid.map(row => [...row]);
      const letter = state.isAttacking ? state.attackVowel : state.currentLetter;
      testGrid[cell.row][cell.col] = letter;
      
      // Calculate score improvement
      const newTotal = calculateBoardScore(testGrid);
      const prevTotal = state.lastBoardTotal['player-2'] ?? 0;
      const scoreGain = Math.max(0, newTotal - prevTotal);
      
      if (scoreGain > bestScore) {
        bestScore = scoreGain;
        bestMove = {row: cell.row, col: cell.col, score: scoreGain};
      }
    }
    
    // Fallback: random move if no good move found
    if (!bestMove && availableCells.length > 0) {
      const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
      bestMove = {row: randomCell.row, col: randomCell.col, score: 0};
    }
    
    // Make the AI move
    if (bestMove) {
      const targetId = state.isAttacking ? 'player-1' : 'player-2';
      onSelectCell(targetId, bestMove.row, bestMove.col);
    } else {
      endTurn();
    }
  };

  const passTurn = () => {
    setTimeLeft(TURN_TIME);
    endTurn();
  };

  const handleNewGame = () => {
    onNewGame();
    setTimeLeft(TURN_TIME);
    setGameEnded(false);
    setWinner(null);
    setShowWinnerDialog(false);
  };

  const handleRoundEnd = () => {
    onRoundEnd();
    setTimeLeft(TURN_TIME);
    
    toast({
      title: "Round ended!",
      description: "Starting new round with fresh attack vowel",
    });
  };

  const currentPlayerIndex = state.players.findIndex(p => p.id === state.activePlayerId);
  const currentPlayer = state.players[currentPlayerIndex];
  const isAITurn = mode === 'solo' && state.activePlayerId === 'player-2';

  return (
    <div className="min-h-screen bg-background p-4 space-y-4 app">
      <div className="content space-y-4">
        {/* Top HUD identical between modes */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBackToMenu}>
            ← Back to Menu
          </Button>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Turn {state.round}</div>
              <div className={`font-bold ${currentPlayerIndex === 0 ? 'text-player-1' : 'text-player-2'}`}>
                {currentPlayer?.name || `Player ${currentPlayerIndex + 1}`}'s Turn
                {isAITurn && <span className="text-sm text-muted-foreground ml-2">(AI thinking...)</span>}
              </div>
            </div>
            
            <CurrentLetterDisplay />
            
            <div className="flex items-center gap-2">
              <Badge variant={timeLeft <= 10 ? "destructive" : "secondary"} className="text-lg px-3 py-1">
                {timeLeft}s
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRoundEnd}>
              End Round
            </Button>
            <Button variant="outline" onClick={handleNewGame}>
              New Game
            </Button>
          </div>
        </div>

        {/* Scoreboard */}
        <Scoreboard />

        {/* Attack Bar */}
        <AttackBar />

        {/* Game Grids */}
        <div className="flex justify-center items-start gap-6 flex-1">
          {/* Player 1 Grid */}
          <GameGrid
            playerId="player-1"
            playerName={state.players[0]?.name || "Player 1"}
            isCurrentPlayer={currentPlayerIndex === 0}
          />

          {/* Player 2 Grid */}
          <GameGrid
            playerId="player-2"
            playerName={state.players[1]?.name || "Player 2"}
            isCurrentPlayer={currentPlayerIndex === 1}
          />
        </div>
      </div>

      {/* Winner Dialog */}
      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Over!</DialogTitle>
            <DialogDescription>
              {winner} wins! Would you like to play again?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={onBackToMenu}>
              Back to Menu
            </Button>
            <Button onClick={handleNewGame}>
              Play Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Wrap the component with GameProvider
const UnifiedGameBoard = (props: UnifiedGameBoardProps) => (
  <GameProvider>
    <UnifiedGameBoardInner {...props} />
  </GameProvider>
);

export default UnifiedGameBoard;