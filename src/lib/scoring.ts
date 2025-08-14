export type GridCell = string | null;
export type Grid = GridCell[][];

export interface WordMatch {
  word: string;
  length: number;
  orientation: 'row' | 'col';
  index: number; // row index for rows, col index for cols
  start: number; // start position in the sequence
  cells: Array<{ row: number; col: number }>; // cells that make up this word
}

export function findValidWords(grid: Grid, dict: Set<string>, minLength = 2): WordMatch[] {
  const results: WordMatch[] = [];

  // Helper to process a sequence of letters and record a word if in dict
  const processSequence = (seq: string, orientation: 'row' | 'col', index: number, start: number) => {
    const word = seq.toLowerCase();
    if (word.length >= minLength && dict.has(word)) {
      // Calculate cells for this word
      const cells: Array<{ row: number; col: number }> = [];
      for (let i = 0; i < word.length; i++) {
        if (orientation === 'row') {
          cells.push({ row: index, col: start + i });
        } else {
          cells.push({ row: start + i, col: index });
        }
      }
      results.push({ word, length: word.length, orientation, index, start, cells });
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

export function scoreGrid(grid: Grid, dict: Set<string>, usedWords: Set<string>, minLength = 3): { score: number; scoredCells: Set<string>; newUsedWords: Set<string> } {
  const matches = findValidWords(grid, dict, minLength);
  const scoredCells = new Set<string>();
  const newUsedWords = new Set(usedWords);
  
  // Only count words that haven't been used by this player before
  const validMatches = matches.filter(match => !usedWords.has(match.word));
  
  // Add new words to used words set
  validMatches.forEach(match => newUsedWords.add(match.word));
  
  // Mark cells that are part of valid words
  validMatches.forEach(match => {
    match.cells.forEach(cell => {
      scoredCells.add(`${cell.row}-${cell.col}`);
    });
  });
  
  // Score is 1 point per unique cell that's part of at least one valid word
  return {
    score: scoredCells.size,
    scoredCells,
    newUsedWords
  };
}
