import { loadDictionary } from './dictionary';

export type Grid = string[][];

export interface WordMatch {
  word: string;
  length: number;
  cells: Array<{ row: number; col: number }>;
}

/**
 * Find all valid words that cross through a specific cell
 */
export async function findWordsCrossingCell(
  grid: Grid, 
  row: number, 
  col: number, 
  minLength = 2
): Promise<WordMatch[]> {
  const dict = await loadDictionary();
  const results: WordMatch[] = [];
  
  // Check horizontal words through this cell
  const horizontalWord = extractHorizontalWord(grid, row, col);
  if (horizontalWord && horizontalWord.word.length >= minLength && dict.has(horizontalWord.word.toLowerCase())) {
    results.push(horizontalWord);
  }
  
  // Check vertical words through this cell
  const verticalWord = extractVerticalWord(grid, row, col);
  if (verticalWord && verticalWord.word.length >= minLength && dict.has(verticalWord.word.toLowerCase())) {
    results.push(verticalWord);
  }
  
  return results;
}

function extractHorizontalWord(grid: Grid, row: number, col: number): WordMatch | null {
  const rowData = grid[row];
  if (!rowData || !rowData[col]) return null;
  
  // Find start of word
  let start = col;
  while (start > 0 && rowData[start - 1] && rowData[start - 1].trim() !== '') {
    start--;
  }
  
  // Find end of word
  let end = col;
  while (end < rowData.length - 1 && rowData[end + 1] && rowData[end + 1].trim() !== '') {
    end++;
  }
  
  // Build word and cells
  const word = [];
  const cells = [];
  for (let c = start; c <= end; c++) {
    if (rowData[c] && rowData[c].trim() !== '') {
      word.push(rowData[c]);
      cells.push({ row, col: c });
    } else {
      break;
    }
  }
  
  if (word.length < 2) return null;
  
  return {
    word: word.join('').toUpperCase(),
    length: word.length,
    cells
  };
}

function extractVerticalWord(grid: Grid, row: number, col: number): WordMatch | null {
  if (!grid[row] || !grid[row][col]) return null;
  
  // Find start of word
  let start = row;
  while (start > 0 && grid[start - 1] && grid[start - 1][col] && grid[start - 1][col].trim() !== '') {
    start--;
  }
  
  // Find end of word
  let end = row;
  while (end < grid.length - 1 && grid[end + 1] && grid[end + 1][col] && grid[end + 1][col].trim() !== '') {
    end++;
  }
  
  // Build word and cells
  const word = [];
  const cells = [];
  for (let r = start; r <= end; r++) {
    if (grid[r] && grid[r][col] && grid[r][col].trim() !== '') {
      word.push(grid[r][col]);
      cells.push({ row: r, col });
    } else {
      break;
    }
  }
  
  if (word.length < 2) return null;
  
  return {
    word: word.join('').toUpperCase(),
    length: word.length,
    cells
  };
}

/**
 * Calculate score for placing a letter, considering only new words formed
 */
export async function scorePlacement(
  grid: Grid,
  row: number,
  col: number,
  letter: string,
  completedWords: Set<string>
): Promise<{ points: number; newWords: string[] }> {
  // Create temporary grid with the new letter
  const tempGrid = grid.map(r => [...r]);
  tempGrid[row][col] = letter.toUpperCase();
  
  // Find all words crossing this cell
  const wordsFound = await findWordsCrossingCell(tempGrid, row, col);
  
  // Filter out words already completed by this player
  const newWords = wordsFound.filter(match => 
    !completedWords.has(match.word.toLowerCase())
  );
  
  // Calculate points (1 per letter in each new word)
  const points = newWords.reduce((sum, match) => sum + match.length, 0);
  
  return {
    points,
    newWords: newWords.map(match => match.word)
  };
}