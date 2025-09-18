export type Cell = { r: number; c: number };
export type WordHit = { text: string; path: Cell[]; dir: '→'|'←'|'↓'|'↑' };

export type ScoreOpts = {
  dictionary?: Set<string> | null;
  useDictionary?: boolean;  // default true
  dedupe?: boolean;         // default false (count every occurrence)
  minLen?: number;          // default 2
};

const isAZ = (ch: string) => /^[A-Z]$/.test(ch);

export function calculateScore(
  grid: string[][],
  opts: ScoreOpts = {}
): { score: number; words: WordHit[] } {
  const {
    dictionary = null,
    useDictionary = true,
    dedupe = false,
    minLen = 2,
  } = opts;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const hits: WordHit[] = [];
  const seen = new Set<string>();
  const dict = dictionary ?? new Set<string>();

  function accept(word: string): boolean {
    if (word.length < minLen) return false;
    if (!useDictionary) return true;
    // autoguard: if list is tiny/unloaded, accept everything
    if (dict.size <= 5000) return true;
    return dict.has(word);
  }

  for (let r = 0; r < rows; r++) {
    const line = Array.from({ length: cols }, (_, c) => isAZ(grid[r][c]) ? grid[r][c].toUpperCase() : ' ');
    scanLine(line, k => ({ r, c: k }), '→', '←');
  }

  for (let c = 0; c < cols; c++) {
    const line = Array.from({ length: rows }, (_, r) => isAZ(grid[r][c]) ? grid[r][c].toUpperCase() : ' ');
    scanLine(line, k => ({ r: k, c }), '↓', '↑');
  }

  function scanLine(
    chars: string[],
    coord: (k: number) => Cell,
    fwd: WordHit['dir'],
    rev: WordHit['dir']
  ) {
    const n = chars.length;
    let i = 0;
    while (i < n) {
      while (i < n && chars[i] === ' ') i++;
      if (i >= n) break;
      let j = i;
      while (j < n && chars[j] !== ' ') j++;
      const segLen = j - i;
      if (segLen >= minLen) {
        // forward substrings
        for (let a = 0; a < segLen; a++) {
          for (let b = a + minLen; b <= segLen; b++) {
            const text = chars.slice(i + a, i + b).join('');
            if (accept(text)) emit(text, i + a, i + b, fwd, coord, false);
          }
        }
        // reverse substrings
        for (let a = 0; a < segLen; a++) {
          for (let b = a + minLen; b <= segLen; b++) {
            const start = j - b, end = j - a; // [start,end)
            const text = chars.slice(start, end).reverse().join('');
            if (accept(text)) emit(text, start, end, rev, coord, true);
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
    reversed: boolean
  ) {
    if (dedupe) { if (seen.has(text)) return; seen.add(text); }
    const path: Cell[] = [];
    if (!reversed) { for (let k = start; k < end; k++) path.push(coord(k)); }
    else           { for (let k = end - 1; k >= start; k--) path.push(coord(k)); }
    hits.push({ text, path, dir });
  }

  const score = hits.reduce((s, w) => s + w.text.length, 0);
  return { score, words: hits };
}