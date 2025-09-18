let DICT: Set<string> | null = null;

export async function loadDictionary(): Promise<Set<string>> {
  if (DICT) return DICT;
  try {
    const res = await fetch('/words-en.txt', { cache: 'force-cache' });
    const txt = await res.text();
    DICT = new Set(txt.split(/\r?\n/).map(s => s.trim().toUpperCase()).filter(Boolean));
    return DICT;
  } catch {
    DICT = new Set(['BE','US','USE','CAUSE','BECAUSE','CAT','DOG','BIRD','NOSE','EAR','EACH','ACHE','LACE','ACE','SUITE','BEANS','BLEAK','NASAL']);
    return DICT;
  }
}

export function getDictionary(): Set<string> {
  return DICT ?? new Set<string>();
}