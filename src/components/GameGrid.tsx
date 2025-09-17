import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';
import { toast } from '@/components/ui/use-toast';

interface GameGridProps {
  playerId: string;
  playerName: string;
  isCurrentPlayer?: boolean;
}

export function GameGrid({ playerId, playerName, isCurrentPlayer }: GameGridProps) {
  const { state } = useGame();
  const { onSelectCell, onPlaceLetter } = useGameEvents();
  const [letterInput, setLetterInput] = useState('');

  const grid = state.boardByPlayer[playerId] || [];
  const boardSize = state.boardSize;

  const handleCellClick = (row: number, col: number) => {
    if (!isCurrentPlayer && !state.isAttacking) return;
    if (grid[row][col] && grid[row][col].trim() !== '') return;
    
    onSelectCell(row, col);
  };

  const handlePlaceLetter = async () => {
    if (!letterInput.trim()) return;
    
    const result = await onPlaceLetter(letterInput.trim());
    
    if (result.success) {
      toast({
        title: "Letter placed!",
        description: `Letter ${letterInput.toUpperCase()} placed successfully`,
      });
      setLetterInput('');
    } else {
      toast({
        title: "Invalid placement",
        description: result.reason,
        variant: "destructive"
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePlaceLetter();
    }
  };

  const isSelectedCell = (row: number, col: number) => {
    return state.selectedCell?.row === row && state.selectedCell?.col === col;
  };

  const canPlaceInCell = (row: number, col: number) => {
    if (grid[row][col] && grid[row][col].trim() !== '') return false;
    if (!isCurrentPlayer && !state.isAttacking) return false;
    return true;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Player Header */}
      <div className={`p-3 rounded-lg text-center w-full ${
        isCurrentPlayer ? 'bg-primary/20 border border-primary/30' : 'bg-card'
      }`}>
        <div className={`text-lg font-bold ${
          playerId === 'player-1' ? 'text-player-1' : 'text-player-2'
        }`}>
          {playerName}
        </div>
        <div className="text-2xl font-bold">
          {state.cumulativeScores[playerId] ?? 0}
        </div>
      </div>

      {/* Grid */}
      <div 
        className={`inline-grid gap-px bg-border p-2 rounded-lg`}
        style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const isSelected = isSelectedCell(rowIndex, colIndex);
            const canPlace = canPlaceInCell(rowIndex, colIndex);
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-12 h-12 cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/30 relative text-sm font-bold
                  ${isLightSquare ? 'bg-muted/80' : 'bg-muted-foreground/10'}
                  ${cell ? (playerId === 'player-1' ? 'bg-gradient-player-1' : 'bg-gradient-player-2') : ''}
                  ${isSelected ? 'ring-2 ring-accent' : ''}
                  ${canPlace ? 'hover:scale-105 hover:shadow-lg hover:bg-accent/20' : ''}
                `}
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {cell && (
                  <span className="text-foreground relative z-10">
                    {cell}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Letter Input - Only show for current player */}
      {isCurrentPlayer && (
        <Card className="p-3 w-full">
          <div className="flex gap-2">
            <Input
              value={letterInput}
              onChange={(e) => setLetterInput(e.target.value.toUpperCase().slice(0, 1))}
              placeholder="Enter letter..."
              className="flex-1 text-center font-bold"
              maxLength={1}
              onKeyPress={handleKeyPress}
            />
            <Button 
              onClick={handlePlaceLetter} 
              disabled={!letterInput.trim() || !state.selectedCell}
              size="sm"
            >
              Place
            </Button>
          </div>
          {state.selectedCell && (
            <div className="text-xs text-muted-foreground mt-1 text-center">
              Selected: Row {state.selectedCell.row + 1}, Col {state.selectedCell.col + 1}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}