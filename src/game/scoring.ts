export type Cell = { r: number; c: number };
export type WordHit = { text: string; path: Cell[] };
export type ScoreOpts = {
  dictionary?: Set<string>;
  useDictionary?: boolean;      // default true
  dedupe?: boolean;             // default false (count all occurrences)
  excludeCooldown?: boolean;    // default false
  cooldownLetters?: Set<string>;
  minLen?: number;              // default 3
};

const isAZ = (ch: string) => /^[A-Z]$/.test(ch);
const inBounds = (g: string[][], r: number, c: number) =>
  r >= 0 && c >= 0 && r < g.length && c < (g[0]?.length ?? 0);

export function calculateScore(grid: string[][], opts: ScoreOpts = {}) {
  const {
    dictionary = new Set<string>(),
    useDictionary = true,
    dedupe = false,
    excludeCooldown = false,
    cooldownLetters = new Set<string>(),
    minLen = 3,
  } = opts;

  const DIRS: [number, number][] = [[0,1],[0,-1],[1,0],[-1,0]];
  const hits: WordHit[] = [];
  const seen = new Set<string>();
  const coolOk = (chars: string[]) => !chars.some(ch => cooldownLetters.has(ch));

  for (let r=0; r<grid.length; r++) for (let c=0; c<(grid[0]?.length??0); c++) {
    if (!isAZ(grid[r][c])) continue;
    for (const [dr,dc] of DIRS) {
      const path: Cell[] = []; const chars: string[] = [];
      let rr=r, cc=c;
      while (inBounds(grid, rr, cc) && isAZ(grid[rr][cc])) {
        path.push({r:rr,c:cc}); chars.push(grid[rr][cc]);
        if (chars.length >= minLen) {
          const w = chars.join('');
          if ((!excludeCooldown || coolOk(chars)) && (!useDictionary || dictionary.has(w))) {
            const key = dedupe ? `S:${w}` : `O:${w}#${r},${c},${dr},${dc}`;
            if (!seen.has(key)) { seen.add(key); hits.push({ text:w, path:[...path] }); }
          }
        }
        rr+=dr; cc+=dc;
      }
    }
  }
  const score = hits.reduce((s, w) => s + w.text.length, 0);
  return { score, words: hits };
}