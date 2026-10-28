// Shared rules for every Lettus mode. Change a number here and every board follows.

export const BOARD_SIZE = 5;
export const TURN_TIME_LIMIT = 30;
export const COOLDOWN_TURNS = 4;
export const TIMEOUT_PENALTY = 5;
export const WARNING_THRESHOLD = 5;

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Z, X and Q are worth 2 points each; every other letter is worth 1
export const BONUS_LETTERS = new Set(['Z', 'X', 'Q']);

export const letterPoints = (letter: string) => (BONUS_LETTERS.has(letter.toUpperCase()) ? 2 : 1);

export const wordPoints = (word: string) => {
  let total = 0;
  for (const letter of word) total += letterPoints(letter);
  return total;
};

export type GridCell = { letter: string | null };
export type Grid = GridCell[][];

export const emptyGrid = (size: number = BOARD_SIZE): Grid =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => ({ letter: null })));

export const cloneGrid = (grid: Grid): Grid => grid.map(row => row.map(cell => ({ ...cell })));

export const isGridFull = (grid: Grid) => grid.every(row => row.every(cell => cell.letter !== null));

export const gridToStrings = (grid: Grid) => grid.map(row => row.map(cell => cell.letter || ''));

// One random starting letter per row, in a random column
export const generateStartingTiles = (boardSize: number = BOARD_SIZE): Grid => {
  const grid = emptyGrid(boardSize);
  for (let row = 0; row < Math.min(5, boardSize); row++) {
    const col = Math.floor(Math.random() * boardSize);
    grid[row][col] = { letter: ALPHABET[Math.floor(Math.random() * ALPHABET.length)] };
  }
  return grid;
};

// Every cooldown drops by one, finished ones are removed, and the played letter starts its cooldown
export const tickCooldowns = (
  cooldowns: Record<string, number>,
  playedLetter: string | null,
  turns: number = COOLDOWN_TURNS
): Record<string, number> => {
  const next: Record<string, number> = {};
  for (const [letter, value] of Object.entries(cooldowns)) {
    if (value > 1) next[letter] = value - 1;
  }
  if (playedLetter) next[playedLetter] = turns;
  return next;
};
