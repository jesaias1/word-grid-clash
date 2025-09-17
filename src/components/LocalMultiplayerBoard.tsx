import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { GameProvider, useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';
import { Scoreboard } from '@/components/Scoreboard';
import { AttackLetterIndicator } from '@/components/AttackLetterIndicator';

type GridCell = string | null;
type Grid = GridCell[][];

interface LocalMultiplayerBoardProps {
  onBackToMenu: () => void;
  boardSize?: 5 | 7 | 10;
}

const TURN_TIME = 30;

// Generate starting tiles for both players
const generateStartingTiles = (boardSize: number): Array<{ row: number; col: number; letter: string }> => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const tiles: Array<{ row: number; col: number; letter: string }> = [];
  
  // Generate 5 random starting letters
  for (let i = 0; i < Math.min(5, boardSize); i++) {
    const letter = alphabet[Math.floor(Math.random() * alphabet.length)];
    const row = i;
    const col = Math.floor(Math.random() * boardSize);
    tiles.push({ row, col, letter });
  }
  
  return tiles;
};

const LocalMultiplayerBoardNew = ({ onBackToMenu, boardSize = 5 }: LocalMultiplayerBoardProps) => {
  const { state } = useGame();
  const { onSubmitWord, onRoundEnd, onNewGame, onBoardSizeChange, initializePlayers, setCurrentPlayer } = useGameEvents();
  
  // Local game state
  const [grids, setGrids] = useState<[Grid, Grid]>(() => {
    const grid1: Grid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    const grid2: Grid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    
    const startingTiles = generateStartingTiles(boardSize);
    startingTiles.forEach(({ row, col, letter }) => {
      grid1[row][col] = letter;
      grid2[row][col] = letter;
    });
    
    return [grid1, grid2];
  });
  
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState('');
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [availableLetters] = useState('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  const [wordInput, setWordInput] = useState('');
  const [attackCounts, setAttackCounts] = useState<[number, number]>([3, 3]);
  
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
  
  // Update attack counts based on board size
  useEffect(() => {
    const attackCount = { 5: 1, 7: 2, 10: 3 }[boardSize];
    setAttackCounts([attackCount, attackCount]);
    onBoardSizeChange(boardSize);
  }, [boardSize]);

  const passTurn = () => {
    const nextPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
    setCurrentPlayerIndex(nextPlayerIndex);
    setSelectedLetter('');
    setTimeLeft(TURN_TIME);
    
    if (state.players.length > 0) {
      setCurrentPlayer(state.players[nextPlayerIndex].id);
    }
  };

  const placeLetter = (row: number, col: number, gridIndex: number) => {
    if (!selectedLetter || gameEnded) return;
    
    const targetGrid = grids[gridIndex];
    const isOpponentGrid = gridIndex !== currentPlayerIndex;
    
    // Check if cell is already occupied
    if (targetGrid[row][col] !== null) return;
    
    // Check if placing on opponent grid and attacks available
    if (isOpponentGrid && attackCounts[currentPlayerIndex] <= 0) {
      toast({
        title: "No attacks left",
        description: "You've used all your attack letters for this round",
        variant: "destructive"
      });
      return;
    }

    // Update grids
    const newGrids: [Grid, Grid] = [
      grids[0].map(row => [...row]),
      grids[1].map(row => [...row])
    ];
    
    newGrids[gridIndex][row][col] = selectedLetter;
    setGrids(newGrids);
    
    // Update attack counts if placing on opponent grid
    if (isOpponentGrid) {
      const newAttackCounts: [number, number] = [...attackCounts];
      newAttackCounts[currentPlayerIndex]--;
      setAttackCounts(newAttackCounts);
    }
    
    setSelectedLetter('');
    passTurn();
  };

  const handleSubmitWord = async () => {
    if (!wordInput.trim() || state.players.length === 0) return;
    
    const currentPlayerId = state.players[currentPlayerIndex].id;
    const result = await onSubmitWord(currentPlayerId, wordInput.trim());
    
    if (result.success) {
      toast({
        title: "Word accepted!",
        description: `"${wordInput.trim()}" scored ${wordInput.trim().length} points`,
      });
      setWordInput('');
    } else {
      toast({
        title: "Word rejected",
        description: result.reason,
        variant: "destructive"
      });
    }
  };

  const handleNewGame = () => {
    onNewGame();
    setCurrentPlayerIndex(0);
    setTimeLeft(TURN_TIME);
    setGameEnded(false);
    setWinner(null);
    setShowWinnerDialog(false);
    setWordInput('');
    
    // Reset grids with new starting tiles
    const grid1: Grid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    const grid2: Grid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    
    const startingTiles = generateStartingTiles(boardSize);
    startingTiles.forEach(({ row, col, letter }) => {
      grid1[row][col] = letter;
      grid2[row][col] = letter;
    });
    
    setGrids([grid1, grid2]);
    
    // Reset attack counts
    const attackCount = { 5: 1, 7: 2, 10: 3 }[boardSize];
    setAttackCounts([attackCount, attackCount]);
  };

  const handleRoundEnd = () => {
    onRoundEnd();
    
    // Reset attack counts for new round
    const attackCount = { 5: 1, 7: 2, 10: 3 }[boardSize];
    setAttackCounts([attackCount, attackCount]);
    
    setCurrentPlayerIndex(0);
    setTimeLeft(TURN_TIME);
    
    toast({
      title: "Round ended!",
      description: "Starting new round with fresh attack letters",
    });
  };

  const renderGrid = (gridIndex: number) => {
    const grid = grids[gridIndex];
    const isCurrentPlayerGrid = gridIndex === currentPlayerIndex;
    const isOpponentGrid = !isCurrentPlayerGrid;
    
    return (
      <div 
        className={`inline-grid gap-px bg-border p-2 rounded-lg ${boardSize === 5 ? 'grid-cols-5' : boardSize === 7 ? 'grid-cols-7' : 'grid-cols-10'}`}
        style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const canPlaceLetter = selectedLetter && (isCurrentPlayerGrid || attackCounts[currentPlayerIndex] > 0);
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-14 h-14 cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/30 relative
                  ${isLightSquare ? 'bg-muted/80' : 'bg-muted-foreground/10'}
                  ${cell ? (gridIndex === 0 ? 'bg-gradient-player-1' : 'bg-gradient-player-2') : ''}
                  ${canPlaceLetter && !cell ? 'hover:scale-105 hover:shadow-lg hover:bg-accent/20' : ''}
                  ${!cell && selectedLetter && canPlaceLetter ? 'ring-2 ring-accent/50' : ''}
                `}
                onClick={() => canPlaceLetter && !cell && placeLetter(rowIndex, colIndex, gridIndex)}
              >
                {cell && (
                  <>
                    <span className="font-bold text-lg text-foreground relative z-10">
                      {cell}
                    </span>
                    <AttackLetterIndicator letter={cell} />
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderLetterSelector = () => (
    <Card className="p-4 bg-gradient-card border-border/30">
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-center text-foreground">Available Letters</h3>
        <div className="grid grid-cols-13 gap-1">
          {availableLetters.map(letter => (
            <Button
              key={letter}
              variant={selectedLetter === letter ? "default" : "outline"}
              size="sm"
              className={`
                h-8 w-8 p-0 text-xs font-bold transition-all duration-200
                ${selectedLetter === letter ? 'ring-2 ring-accent scale-110' : ''}
                hover:scale-105
              `}
              onClick={() => setSelectedLetter(selectedLetter === letter ? '' : letter)}
            >
              {letter}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );

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

        {/* Game Grids */}
        <div className="flex justify-center items-start gap-6 flex-1">
          {/* Player 1 Grid */}
          <div className="flex flex-col items-center">
            <div className={`mb-2 p-2 rounded-lg text-center ${currentPlayerIndex === 0 ? 'bg-player-1/20 border border-player-1/30' : 'bg-card'}`}>
              <div className="text-lg font-bold text-player-1">Player 1</div>
              <div className="text-2xl font-bold">{state.cumulativeScores['player-1'] ?? 0}</div>
            </div>
            {/* Player 1 Attack Indicators */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs font-medium text-muted-foreground">Attacks:</span>
              {Array.from({ length: { 5: 1, 7: 2, 10: 3 }[boardSize] }, (_, i) => (
                <div key={i} className={`w-4 h-4 flex items-center justify-center text-xs font-bold border rounded ${
                  i < attackCounts[0] ? 'bg-muted text-muted-foreground border-muted-foreground' : 'bg-destructive text-destructive-foreground border-destructive'
                }`}>
                  ✕
                </div>
              ))}
            </div>
            {renderGrid(0)}
          </div>

          {/* Player 2 Grid */}
          <div className="flex flex-col items-center">
            <div className={`mb-2 p-2 rounded-lg text-center ${currentPlayerIndex === 1 ? 'bg-player-2/20 border border-player-2/30' : 'bg-card'}`}>
              <div className="text-lg font-bold text-player-2">Player 2</div>
              <div className="text-2xl font-bold">{state.cumulativeScores['player-2'] ?? 0}</div>
            </div>
            {/* Player 2 Attack Indicators */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs font-medium text-muted-foreground">Attacks:</span>
              {Array.from({ length: { 5: 1, 7: 2, 10: 3 }[boardSize] }, (_, i) => (
                <div key={i} className={`w-4 h-4 flex items-center justify-center text-xs font-bold border rounded ${
                  i < attackCounts[1] ? 'bg-muted text-muted-foreground border-muted-foreground' : 'bg-destructive text-destructive-foreground border-destructive'
                }`}>
                  ✕
                </div>
              ))}
            </div>
            {renderGrid(1)}
          </div>
        </div>

        {/* Letter Selector */}
        {renderLetterSelector()}
      </div>

      {/* Word Input - Sticky Bottom */}
      <div className="sticky-input">
        <Card className="p-4 bg-gradient-card border-border/30">
          <div className="flex gap-2">
            <Input
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value.toUpperCase())}
              placeholder="Enter a word to score..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmitWord();
                }
              }}
            />
            <Button onClick={handleSubmitWord} disabled={!wordInput.trim()}>
              Submit Word
            </Button>
          </div>
        </Card>
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