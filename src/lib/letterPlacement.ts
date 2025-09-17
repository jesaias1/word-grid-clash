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
  const horizontalWords = extractAllHorizontalWords(grid, row, col, dict, minLength);
  results.push(...horizontalWords);
  
  // Check vertical words through this cell
  const verticalWords = extractAllVerticalWords(grid, row, col, dict, minLength);
  results.push(...verticalWords);
  
  return results;
}

/**
 * Extract all valid sub-words horizontally that include the target cell
 */
function extractAllHorizontalWords(
  grid: Grid, 
  row: number, 
  col: number, 
  dict: Set<string>, 
  minLength: number
): WordMatch[] {
  const results: WordMatch[] = [];
  const rowData = grid[row];
  if (!rowData || !rowData[col]) return results;
  
  // Find the full contiguous sequence
  let start = col;
  while (start > 0 && rowData[start - 1] && rowData[start - 1].trim() !== '') {
    start--;
  }
  
  let end = col;
  while (end < rowData.length - 1 && rowData[end + 1] && rowData[end + 1].trim() !== '') {
    end++;
  }
  
  // Extract all valid sub-words that include the target cell
  for (let i = start; i <= col; i++) {
    for (let j = col; j <= end; j++) {
      if (j - i + 1 >= minLength) {
        const wordChars = [];
        const cells = [];
        let valid = true;
        
        for (let k = i; k <= j; k++) {
          if (rowData[k] && rowData[k].trim() !== '') {
            wordChars.push(rowData[k]);
            cells.push({ row, col: k });
          } else {
            valid = false;
            break;
          }
        }
        
        if (valid && wordChars.length >= minLength) {
          const word = wordChars.join('').toUpperCase();
          if (dict.has(word.toLowerCase())) {
            results.push({ word, length: word.length, cells });
          }
        }
      }
    }
  }
  
  return results;
}

/**
 * Extract all valid sub-words vertically that include the target cell
 */
function extractAllVerticalWords(
  grid: Grid, 
  row: number, 
  col: number, 
  dict: Set<string>, 
  minLength: number
): WordMatch[] {
  const results: WordMatch[] = [];
  if (!grid[row] || !grid[row][col]) return results;
  
  // Find the full contiguous sequence
  let start = row;
  while (start > 0 && grid[start - 1] && grid[start - 1][col] && grid[start - 1][col].trim() !== '') {
    start--;
  }
  
  let end = row;
  while (end < grid.length - 1 && grid[end + 1] && grid[end + 1][col] && grid[end + 1][col].trim() !== '') {
    end++;
  }
  
  // Extract all valid sub-words that include the target cell
  for (let i = start; i <= row; i++) {
    for (let j = row; j <= end; j++) {
      if (j - i + 1 >= minLength) {
        const wordChars = [];
        const cells = [];
        let valid = true;
        
        for (let k = i; k <= j; k++) {
          if (grid[k] && grid[k][col] && grid[k][col].trim() !== '') {
            wordChars.push(grid[k][col]);
            cells.push({ row: k, col });
          } else {
            valid = false;
            break;
          }
        }
        
        if (valid && wordChars.length >= minLength) {
          const word = wordChars.join('').toUpperCase();
          if (dict.has(word.toLowerCase())) {
            results.push({ word, length: word.length, cells });
          }
        }
      }
    }
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