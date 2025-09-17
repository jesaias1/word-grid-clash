// Helper functions for word detection and sub-word scoring
export interface WordResult {
  text: string;
  cells: Array<{ r: number; c: number }>;
}

export function findLinesThrough(grid: string[][], r: number, c: number): Array<{ chars: string[]; cells: Array<{ r: number; c: number }> }> {
  const lines: Array<{ chars: string[]; cells: Array<{ r: number; c: number }> }> = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // Horizontal line
  let horizontalChars: string[] = [];
  let horizontalCells: Array<{ r: number; c: number }> = [];
  for (let col = 0; col < cols; col++) {
    if (grid[r][col] && /^[A-Z]$/.test(grid[r][col])) {
      horizontalChars.push(grid[r][col]);
      horizontalCells.push({ r, c: col });
    } else {
      if (horizontalChars.length > 1) {
        lines.push({ chars: [...horizontalChars], cells: [...horizontalCells] });
      }
      horizontalChars = [];
      horizontalCells = [];
    }
  }
  if (horizontalChars.length > 1) {
    lines.push({ chars: horizontalChars, cells: horizontalCells });
  }

  // Vertical line
  let verticalChars: string[] = [];
  let verticalCells: Array<{ r: number; c: number }> = [];
  for (let row = 0; row < rows; row++) {
    if (grid[row][c] && /^[A-Z]$/.test(grid[row][c])) {
      verticalChars.push(grid[row][c]);
      verticalCells.push({ r: row, c });
    } else {
      if (verticalChars.length > 1) {
        lines.push({ chars: [...verticalChars], cells: [...verticalCells] });
      }
      verticalChars = [];
      verticalCells = [];
    }
  }
  if (verticalChars.length > 1) {
    lines.push({ chars: verticalChars, cells: verticalCells });
  }

  return lines;
}

export function extractValidSubwords(
  lines: Array<{ chars: string[]; cells: Array<{ r: number; c: number }> }>,
  placedCell: { r: number; c: number }
): WordResult[] {
  const results: WordResult[] = [];

  for (const line of lines) {
    // Check if this line contains the placed cell
    const placedIndex = line.cells.findIndex(cell => cell.r === placedCell.r && cell.c === placedCell.c);
    if (placedIndex === -1) continue;

    // Generate all substrings that include the placed cell
    for (let start = 0; start <= placedIndex; start++) {
      for (let end = placedIndex; end < line.chars.length; end++) {
        const length = end - start + 1;
        if (length >= 2) { // Minimum length 2
          const text = line.chars.slice(start, end + 1).join('');
          const cells = line.cells.slice(start, end + 1);
          results.push({ text, cells });
        }
      }
    }
  }

  return results;
}