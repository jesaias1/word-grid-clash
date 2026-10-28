import { calculateScore, type WordHit } from './calculateScore';
import { SCORE_OPTS } from './scoreConfig';
import { gridToStrings, wordPoints, type Grid } from './constants';

export type ScoredWord = WordHit & { points: number };

export type MoveResult = {
  score: number;              // total score of the grid after the move
  words: string[];            // every word on the grid after the move
  newWords: ScoredWord[];     // words this move created
  gained: number;             // points this move added
  highlightCells: Set<string>; // "r-c" keys of cells in the new words
};

const hitKey = (w: WordHit) => `${w.text}@${w.path.map(p => `${p.r},${p.c}`).join('|')}`;

export const scoreGrid = (grid: Grid) => calculateScore(gridToStrings(grid), SCORE_OPTS());

// Score a grid after a move and work out exactly which words the move created
export function analyzeMove(before: Grid, after: Grid): MoveResult {
  const prev = scoreGrid(before);
  const next = scoreGrid(after);

  const prevKeys = new Set(prev.words.map(hitKey));
  const newWords = next.words
    .filter(w => !prevKeys.has(hitKey(w)))
    .map(w => ({ ...w, points: wordPoints(w.text) }))
    .sort((a, b) => b.points - a.points);

  const highlightCells = new Set<string>();
  newWords.forEach(w => w.path.forEach(p => highlightCells.add(`${p.r}-${p.c}`)));

  return {
    score: next.score,
    words: next.words.map(w => w.text),
    newWords,
    gained: next.score - prev.score,
    highlightCells,
  };
}

// Cells that are part of at least one scoring word, for a subtle glow on the board
export function scoredCells(grid: Grid): Set<string> {
  const cells = new Set<string>();
  scoreGrid(grid).words.forEach(w => w.path.forEach(p => cells.add(`${p.r}-${p.c}`)));
  return cells;
}

export const comboLabel = (count: number) => {
  if (count >= 6) return 'LEGENDARY!';
  if (count === 5) return 'INCREDIBLE!';
  if (count === 4) return 'QUAD COMBO!';
  if (count === 3) return 'TRIPLE!';
  if (count === 2) return 'DOUBLE!';
  return null;
};
