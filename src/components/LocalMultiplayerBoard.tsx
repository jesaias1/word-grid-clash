import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { GameProvider, useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';
import { Scoreboard } from '@/components/Scoreboard';
import { AttackBar } from '@/components/AttackBar';
import { GameGrid } from '@/components/GameGrid';
import { AlphabetBar } from '@/components/AlphabetBar';
import { useKeyboard } from '@/hooks/useKeyboard';

interface LocalMultiplayerBoardProps {
  onBackToMenu: () => void;
  boardSize?: 5 | 7 | 10;
}

const TURN_TIME = 30;

const LocalMultiplayerBoardNew = ({ onBackToMenu, boardSize = 5 }: LocalMultiplayerBoardProps) => {
  const { state } = useGame();
  const { onRoundEnd, onNewGame, onBoardSizeChange, initializePlayers, setCurrentPlayer } = useGameEvents();
  
  // Enable keyboard input
  useKeyboard();
  
  // Local game state
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  
  // Initialize players when component mounts
  useEffect(() => {
    if (!gameStarted) {
      initializePlayers(['Player 1', 'Player 2']);
      onBoardSizeChange(boardSize);
      setGameStarted(true);
    }
  }, []);
  
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
  }, [currentPlayerIndex, gameEnded]);
  
  // Update board size
  useEffect(() => {
    onBoardSizeChange(boardSize);
  }, [boardSize]);

  const passTurn = () => {
    const nextPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
    setCurrentPlayerIndex(nextPlayerIndex);
    setTimeLeft(TURN_TIME);
    
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      if (state.players.length > 0) {
        setCurrentPlayer(state.players[nextPlayerIndex].id);
      }
    }, 0);
  };



  const handleNewGame = () => {
    onNewGame();
    setCurrentPlayerIndex(0);
    setTimeLeft(TURN_TIME);
    setGameEnded(false);
    setWinner(null);
    setShowWinnerDialog(false);
  };

  const handleRoundEnd = () => {
    onRoundEnd();
    setCurrentPlayerIndex(0);
    setTimeLeft(TURN_TIME);
    
    toast({
      title: "Round ended!",
      description: "Starting new round with fresh attack vowel",
    });
  };


  return (
    <div className="min-h-screen bg-background p-4 space-y-4 app">
      <div className="content space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBackToMenu}>
            ← Back to Menu
          </Button>
          <h1 className="text-2xl font-bold text-center text-foreground">
            Local Multiplayer - Board Size {boardSize}×{boardSize}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRoundEnd}>
              End Round
            </Button>
            <Button variant="outline" onClick={handleNewGame}>
              New Game
            </Button>
          </div>
        </div>

        {/* Timer and Current Player */}
        <Card className="p-4 bg-gradient-card border-border/30">
          <div className="flex items-center justify-between">
            <div className={`text-lg font-bold ${currentPlayerIndex === 0 ? 'text-player-1' : 'text-player-2'}`}>
              {state.players[currentPlayerIndex]?.name || `Player ${currentPlayerIndex + 1}`}'s Turn
            </div>
            <Badge variant={timeLeft <= 10 ? "destructive" : "secondary"} className="text-lg px-3 py-1">
              {timeLeft}s
            </Badge>
          </div>
        </Card>

        {/* Scoreboard */}
        <Scoreboard />

        {/* Attack Bar */}
        <AttackBar />

        {/* Game Grids */}
        <div className="flex justify-center items-start gap-6 flex-1">
          {/* Player 1 Grid */}
          <GameGrid
            playerId="player-1"
            playerName="Player 1"
            isCurrentPlayer={currentPlayerIndex === 0}
          />

          {/* Player 2 Grid */}
          <GameGrid
            playerId="player-2"
            playerName="Player 2"
            isCurrentPlayer={currentPlayerIndex === 1}
          />
        </div>

        {/* Alphabet Bar */}
        <AlphabetBar />
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
const LocalMultiplayerBoard = (props: LocalMultiplayerBoardProps) => (
  <GameProvider>
    <LocalMultiplayerBoardNew {...props} />
  </GameProvider>
);

export default LocalMultiplayerBoard;