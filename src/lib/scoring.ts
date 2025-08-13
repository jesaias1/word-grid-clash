export type GridCell = string | null;
export type Grid = GridCell[][];

export interface WordMatch {
  word: string;
  length: number;
  orientation: 'row' | 'col';
  index: number; // row index for rows, col index for cols
  start: number; // start position in the sequence
}

export function findValidWords(grid: Grid, dict: Set<string>, minLength = 2): WordMatch[] {
  const results: WordMatch[] = [];

  // Helper to process a sequence of letters and record a word if in dict
  const processSequence = (seq: string, orientation: 'row' | 'col', index: number, start: number) => {
    const word = seq.toLowerCase();
    if (word.length >= minLength && dict.has(word)) {
      results.push({ word, length: word.length, orientation, index, start });
    }
  };

  // Rows
  for (let r = 0; r < grid.length; r++) {
    let current = '';
    let start = 0;
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c];
      if (ch) {
        if (current.length === 0) start = c;
        current += ch;
      } else {
        if (current.length > 0) processSequence(current, 'row', r, start);
        current = '';
      }
    }
    if (current.length > 0) processSequence(current, 'row', r, start);
  }

  // Columns
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let c = 0; c < cols; c++) {
    let current = '';
    let start = 0;
    for (let r = 0; r < rows; r++) {
      const ch = grid[r][c];
      if (ch) {
        if (current.length === 0) start = r;
        current += ch;
      } else {
        if (current.length > 0) processSequence(current, 'col', c, start);
        current = '';
      }
    }
    if (current.length > 0) processSequence(current, 'col', c, start);
  }

  return results;
}

export function scoreGrid(grid: Grid, dict: Set<string>, minLength = 2): number {
  const matches = findValidWords(grid, dict, minLength);
  // Score is 1 point per letter of each valid word
  return matches.reduce((sum, m) => sum + m.length, 0);
}
