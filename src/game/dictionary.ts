let DICT: Set<string> | null = null;

// tiny embedded fallback so the game never breaks
const FALLBACK = [
  'ON','IN','TO','OF','AT','OR','AS','AN','AM','IS','IT','IF','BY','BE','ME','WE','US','UP','NO','DO','GO','SO',
  'CAT','DOG','BIRD','NOSE','EAR','EACH','ACHE','LACE','ACE','CAUSE','USE','BECAUSE'
];

function norm(w: string): string | null {
  const s = w.trim().toUpperCase();
  if (s.length < 2) return null;
  if (!/^[A-Z]+$/.test(s)) return null;
  return s;
}

// Try local file first, then DWYL raw, else fallback.
// Local file is recommended to avoid CORS/timeouts.
export async function loadDictionary(): Promise<Set<string>> {
  if (DICT) return DICT;

  async function fetchList(url: string): Promise<Set<string> | null> {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) return null;
      const txt = await res.text();
      const out = new Set<string>();
      for (const line of txt.split(/\r?\n/)) {
        const n = norm(line);
        if (n) out.add(n);
      }
      // ensure basic 2-letter commons exist
      for (const must of ['ON','IN','TO','OF','AT','OR','AS','AN']) out.add(must);
      return out.size > 5000 ? out : null; // reject tiny sets
    } catch { return null; }
  }

  DICT =
      await fetchList('/words-en.txt') // add this file locally (see below)
   || await fetchList('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt')
   || new Set(FALLBACK);

  return DICT;
}

export function getDictionary(): Set<string> {
  return DICT ?? new Set(FALLBACK);
}

// true when the dictionary is big enough to trust
export function isDictionaryHealthy(): boolean {
  return !!DICT && DICT.size > 5000;
}