// src/game/dictionary.ts
import type { CuratedDict } from './dictionaryCurated';
import { loadCuratedDictionary } from './dictionaryCurated';

let CURATED: CuratedDict | null = null;

export async function loadDictionary(): Promise<Set<string>> {
  if (!CURATED) CURATED = await loadCuratedDictionary();
  return CURATED.set;
}

export function getDictionary(): Set<string> {
  return CURATED?.set ?? new Set<string>([
    // tiny safe fallback so nothing breaks before load
    'ON','IN','TO','OF','AT','OR','AS','AN','HE','WE','US'
  ]);
}

export function isDictionaryHealthy(): boolean {
  return !!CURATED?.healthy;
}