// src/game/calculateScore.ts
export type Cell = { r: number; c: number };
export type WordHit = { text: string; path: Cell[]; dir: '→'|'←'|'↓'|'↑' };

export type ScoreOpts = {
  dictionary?: Set<string>;
  useDictionary?: boolean;  // default true
  dedupe?: boolean;         // default false (count every occurrence)
  minLen?: number;          // default 2
};

const isAZ = (ch: string) => /^[A-Z]$/.test(ch);

/**
 * Replacement scoring:
 * - Rows & columns only (no diagonals)
 * - Both directions (→, ←, ↓, ↑)
 * - All substrings length >= minLen
 * - Each occurrence scores length
 * - Returns total score and list of occurrences with coordinates
 */
export function calculateScore(
  grid: string[][],
  opts: ScoreOpts = {}
): { score: number; words: WordHit[] } {
  const {
    dictionary = new Set<string>(),
    useDictionary = true,
    dedupe = false,
    minLen = 2,
  } = opts;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const hits: WordHit[] = [];
  const seen = new Set<string>(); // for dedupe by string if enabled

  // Scan every row as a line
  for (let r = 0; r < rows; r++) {
    const line = Array.from({ length: cols }, (_, c) =>
      isAZ(grid[r][c]) ? grid[r][c].toUpperCase() : ' '
    );
    scanLine(line, (k) => ({ r, c: k }), '→', '←');
  }

  // Scan every column as a line
  for (let c = 0; c < cols; c++) {
    const line = Array.from({ length: rows }, (_, r) =>
      isAZ(grid[r][c]) ? grid[r][c].toUpperCase() : ' '
    );
    scanLine(line, (k) => ({ r: k, c }), '↓', '↑');
  }

  function scanLine(
    chars: string[],
    coord: (k: number) => Cell,
    fwdDir: WordHit['dir'],
    revDir: WordHit['dir']
  ) {
    const n = chars.length;
    let i = 0;
    while (i < n) {
      while (i < n && chars[i] === ' ') i++;
      if (i >= n) break;
      let j = i;
      while (j < n && chars[j] !== ' ') j++;
      // segment is [i, j)
      const segLen = j - i;
      if (segLen >= minLen) {
        // forward direction
        for (let a = 0; a < segLen; a++) {
          for (let b = a + minLen; b <= segLen; b++) {
            emit(chars.slice(i + a, i + b).join(''), i + a, i + b, fwdDir, coord);
          }
        }
        // reverse direction
        for (let a = 0; a < segLen; a++) {
          for (let b = a + minLen; b <= segLen; b++) {
            const revStart = j - b; // mirrored in original indices
            const revEnd   = j - a; // not inclusive
            emit(chars.slice(revStart, revEnd).reverse().join(''), revStart, revEnd, revDir, coord, true);
          }
        }
      }
      i = j;
    }
  }

  function emit(
    text: string,
    start: number,
    end: number,
    dir: WordHit['dir'],
    coord: (k: number) => Cell,
    reversed = false
  ) {
    if (text.length < minLen) return;
    if (useDictionary && !dictionary.has(text)) return;
    if (dedupe) {
      if (seen.has(text)) return;
      seen.add(text);
    }
    const path: Cell[] = [];
    if (!reversed) {
      for (let k = start; k < end; k++) path.push(coord(k));
    } else {
      for (let k = end - 1; k >= start; k--) path.push(coord(k));
    }
    hits.push({ text, path, dir });
  }

  const score = hits.reduce((s, w) => s + w.text.length, 0);
  return { score, words: hits };
}