export type Cell = { r:number; c:number };
export type WordHit = { text:string; path:Cell[] };

export type SubwordScoreOpts = {
  dictionary?: Set<string>;
  useDictionary?: boolean;  // default true
  dedupe?: boolean;         // default false (count every occurrence)
  minLen?: number;          // default 2 (so "BE","US" count)
};

/** Score = sum of lengths of ALL contiguous sub-words inside each full-word hit. */
export function scoreFromSubwords(hits: WordHit[], opts: SubwordScoreOpts = {}): number {
  const { dictionary = new Set<string>(), useDictionary = true, dedupe = false, minLen = 2 } = opts;

  let total = 0;
  const seen = dedupe ? new Set<string>() : null;

  for (const h of hits) {
    const s = (h.text || '').toUpperCase();
    const n = s.length;
    if (n < minLen) continue;

    for (let i = 0; i <= n - minLen; i++) {
      for (let j = i + minLen; j <= n; j++) {
        const sub = s.slice(i, j);
        if (useDictionary && !dictionary.has(sub)) continue;
        if (dedupe) { if (seen!.has(sub)) continue; seen!.add(sub); }
        total += sub.length; // 1 point per letter
      }
    }
  }
  return total;
}