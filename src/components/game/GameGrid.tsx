import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Grid } from '@/game/constants';

interface GameGridProps {
  grid: Grid;
  /** 1-5, picks the tile colour */
  player: number;
  /** Whether empty cells accept a click right now */
  interactive: boolean;
  /** Board belongs to whoever is taking a turn */
  active?: boolean;
  selectedLetter?: string | null;
  onCellClick?: (row: number, col: number) => void;
  /** Cells to flash because they form new words */
  flashCells?: Set<string>;
  /** Changes every time a new flash should start */
  flashKey?: number;
  /** Cells that are part of any scoring word */
  scoredCells?: Set<string>;
  lastPlaced?: { row: number; col: number } | null;
  /** CSS length for one cell, e.g. "min(12vw, 56px)" */
  cellSize: string;
  label?: React.ReactNode;
}

const GameGrid = ({
  grid, player, interactive, active = false, selectedLetter, onCellClick,
  flashCells, flashKey = 0, scoredCells, lastPlaced, cellSize, label,
}: GameGridProps) => {
  const size = grid.length;
  const gap = `calc(${cellSize} * 0.09)`;

  return (
    <motion.div
      className={`board relative p-[calc(var(--cell)*0.14)] transition-[box-shadow,opacity,transform] duration-300 ${
        active ? 'ring-2 ring-primary/80 shadow-glow' : 'opacity-[0.92]'
      }`}
      style={{ ['--cell' as string]: cellSize }}
      animate={{ scale: active ? 1 : 0.985 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {label}
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${size}, ${cellSize})`, gridAutoRows: cellSize, gap }}
        role="grid"
      >
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const key = `${r}-${c}`;
            const canPlace = interactive && !!selectedLetter && !cell.letter;
            const flashing = flashCells?.has(key);
            const scored = scoredCells ? scoredCells.has(key) : true;
            const isLast = lastPlaced?.row === r && lastPlaced?.col === c;

            if (!cell.letter) {
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`Row ${r + 1} column ${c + 1}, empty`}
                  disabled={!canPlace}
                  onClick={() => canPlace && onCellClick?.(r, c)}
                  className={`slot group relative flex items-center justify-center transition-all duration-150 ${
                    canPlace ? 'cursor-pointer hover:bg-primary/15 hover:scale-[1.06] active:scale-95' : 'cursor-default'
                  } ${interactive && selectedLetter ? 'ring-1 ring-primary/25' : ''}`}
                >
                  {canPlace && (
                    <span
                      className="font-display font-semibold text-cream/0 group-hover:text-cream/40 transition-colors"
                      style={{ fontSize: `calc(${cellSize} * 0.5)` }}
                    >
                      {selectedLetter}
                    </span>
                  )}
                </button>
              );
            }

            return (
              <motion.div
                key={key}
                role="gridcell"
                aria-label={`Row ${r + 1} column ${c + 1}, ${cell.letter}`}
                initial={isLast ? { scale: 0.2, rotate: -18, opacity: 0 } : false}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                className="relative"
              >
                <div
                  key={flashing ? `f${flashKey}` : 'static'}
                  className={`tile tile-p${player} w-full h-full flex items-center justify-center select-none ${
                    flashing ? 'animate-word-flash z-10' : ''
                  } ${scored ? '' : 'saturate-[0.7] brightness-[0.88]'}`}
                  style={{ fontSize: `calc(${cellSize} * 0.56)`, lineHeight: 1 }}
                >
                  {cell.letter}
                </div>
                {isLast && (
                  <span className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-[30%] h-[3px] rounded-full bg-cream/80" />
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default memo(GameGrid);
