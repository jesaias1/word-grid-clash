import React from 'react';
import { useGame } from '@/game/store';
import { useGameEvents } from '@/game/events';

interface GameGridProps {
  playerId: string;
  playerName: string;
  isCurrentPlayer?: boolean;
}

export function GameGrid({ playerId, playerName, isCurrentPlayer }: GameGridProps) {
  const { state } = useGame();
  const { onSelectCell } = useGameEvents();

  const grid = state.boardByPlayer[playerId] || [];
  const boardSize = state.boardSize;

  const handleCellClick = (row: number, col: number) => {
    if (grid[row][col] && grid[row][col].trim() !== '') return;
    
    onSelectCell(playerId, row, col);
  };


  const canPlaceInCell = (row: number, col: number) => {
    if (grid[row][col] && grid[row][col].trim() !== '') return false;
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
            const canPlace = canPlaceInCell(rowIndex, colIndex);
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-12 h-12 cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/30 relative text-sm font-bold
                  ${isLightSquare ? 'bg-muted/80' : 'bg-muted-foreground/10'}
                  ${cell ? (playerId === 'player-1' ? 'bg-gradient-player-1' : 'bg-gradient-player-2') : ''}
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

    </div>
  );
}