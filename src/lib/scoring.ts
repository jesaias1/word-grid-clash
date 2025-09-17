export type Cell = { r: number; c: number };
export type WordHit = { text: string; path: Cell[] };
export type GridCell = string | null;
export type Grid = GridCell[][];

export type ScoreOpts = {
  dictionary?: Set<string>;
  useDictionary?: boolean;      // default true
  dedupe?: boolean;             // default false (count every occurrence)
  excludeCooldown?: boolean;    // default false
  cooldownLetters?: Set<string>;
  minLen?: number;              // default 3
};

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

const inBounds = (grid: string[][], r: number, c: number) =>
  r >= 0 && c >= 0 && r < grid.length && c < (grid[0]?.length ?? 0);

export function calculateScore(
  grid: string[][],
  opts: ScoreOpts = {}
): { score: number; words: WordHit[] } {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const {
    dictionary = new Set<string>(),
    useDictionary = true,
    dedupe = false,
    excludeCooldown = false,
    cooldownLetters = new Set<string>(),
    minLen = 3,
  } = opts;

  // Directions: [dr, dc]
  const DIRS: [number, number][] = [
    [0, 1],   // →
    [0, -1],  // ←
    [1, 0],   // ↓
    [-1, 0],  // ↑
  ];

  const hits: WordHit[] = [];
  const seen = new Set<string>(); // for dedupe-by-string

  const isAZ = (ch: string) => /^[A-Z]$/.test(ch);
  const isCooldownFree = (chars: string[]) =>
    !chars.some(ch => cooldownLetters.has(ch));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startCh = grid[r][c];
      if (!isAZ(startCh)) continue;

      for (const [dr, dc] of DIRS) {
        const path: Cell[] = [];
        const chars: string[] = [];
        let rr = r, cc = c;

        while (inBounds(grid, rr, cc) && isAZ(grid[rr][cc])) {
          path.push({ r: rr, c: cc });
          chars.push(grid[rr][cc]);
          const len = chars.length;

          if (len >= minLen) {
            const word = chars.join("");
            if (
              (!excludeCooldown || isCooldownFree(chars)) &&
              (!useDictionary || dictionary.has(word))
            ) {
              const key = dedupe ? `S:${word}` : `O:${word}#${r},${c},${dr},${dc}`;
              if (!seen.has(key)) {
                seen.add(key);
                hits.push({ text: word, path: [...path] });
              }
            }
          }
          rr += dr; cc += dc;
        }
      }
    }
  }

  const score = hits.reduce((sum, w) => sum + w.text.length, 0);
  return { score, words: hits };
}

export function compareBoards(
  playerGrid: string[][],
  aiGrid: string[][],
  opts: ScoreOpts = {}
) {
  const player = calculateScore(playerGrid, opts);
  const ai = calculateScore(aiGrid, opts);
  const winner = player.score > ai.score ? 'player' : player.score < ai.score ? 'ai' : 'tie';
  return { player, ai, winner };
}

export function scoreGrid(grid: Grid, dict: Set<string>, usedWords: Set<string>, minLength = 3): { score: number; scoredCells: Set<string>; newUsedWords: Set<string>; allFoundWords: string[] } {
  const matches = findValidWords(grid, dict, minLength);
  const scoredCells = new Set<string>();
  const newUsedWords = new Set(usedWords);
  
  // Get all words found (including ones already used)
  const allFoundWords = matches.map(match => match.word);
  
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
    newUsedWords,
    allFoundWords
  };
}
