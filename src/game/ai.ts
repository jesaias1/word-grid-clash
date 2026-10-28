import { ALPHABET, cloneGrid, wordPoints, type Grid } from './constants';
import { scoreGrid } from './moveAnalysis';
import { getCommonWords } from './dictionary';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type AIMove = { row: number; col: number; letter: string };

// Letters that tend to keep a line open for future words
const FLEXIBLE = new Set('AEIORSTLN'.split(''));
const HARD_TO_USE = new Set('JQXZVKW'.split(''));

type Candidate = AIMove & { gain: number; potential: number };

// Points from everyday words only; obscure dictionary words still score but the AI doesn't chase them
function commonScore(grid: Grid, common: Set<string> | null) {
  const result = scoreGrid(grid);
  if (!common || common.size === 0) return result.score;
  return result.words.reduce((n, w) => n + (common.has(w.text) ? wordPoints(w.text) : 0), 0);
}

function evaluateAll(grid: Grid, letters: string[]): Candidate[] {
  const common = getCommonWords();
  const base = commonScore(grid, common);
  const size = grid.length;
  const out: Candidate[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col].letter !== null) continue;

      // Neighbouring letters make a cell more likely to join a future word
      let neighbours = 0;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && c >= 0 && r < size && c < size && grid[r][c].letter) neighbours++;
      }

      for (const letter of letters) {
        const test = cloneGrid(grid);
        test[row][col] = { letter };
        const gain = commonScore(test, common) - base;
        let potential = neighbours * 0.3;
        if (FLEXIBLE.has(letter)) potential += 0.6;
        if (HARD_TO_USE.has(letter) && gain === 0) potential -= 0.8;
        out.push({ row, col, letter, gain, potential });
      }
    }
  }
  return out;
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** Choose a move for the AI. `blocked` holds letters that are on cooldown. */
export function chooseAIMove(grid: Grid, blocked: Set<string>, difficulty: Difficulty): AIMove | null {
  const letters = ALPHABET.filter(l => !blocked.has(l));
  if (letters.length === 0) return null;

  const candidates = evaluateAll(grid, letters);
  if (candidates.length === 0) return null;

  const byValue = (weight: number) => (a: Candidate, b: Candidate) =>
    (b.gain + b.potential * weight) - (a.gain + a.potential * weight);

  if (difficulty === 'easy') {
    // Casual: often random, otherwise takes a small win
    if (Math.random() < 0.55) return pick(candidates);
    const modest = candidates.filter(c => c.gain > 0 && c.gain <= 4);
    if (modest.length && Math.random() < 0.75) return pick(modest);
    return pick(candidates.sort(byValue(1)).slice(0, Math.max(10, Math.floor(candidates.length / 3))));
  }

  if (difficulty === 'medium') {
    // Solid but human: sometimes misses things, usually picks one of the better moves
    if (Math.random() < 0.3) return pick(candidates);
    return pick(candidates.sort(byValue(1)).slice(0, 6));
  }

  // Hard: best immediate gain, then best long-term shape; slips up now and then
  const sorted = candidates.sort(byValue(1.5));
  if (Math.random() < 0.12) return pick(sorted.slice(0, 3));
  const top = sorted[0];
  const ties = sorted.filter(c => c.gain === top.gain && Math.abs(c.potential - top.potential) < 0.01);
  return pick(ties);
}

export const AI_THINK_MS: Record<Difficulty, [number, number]> = {
  easy: [1400, 2400],
  medium: [1200, 2200],
  hard: [900, 1800],
};
