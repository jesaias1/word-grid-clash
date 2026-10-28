// src/game/dictionary.ts
import type { CuratedDict } from './dictionaryCurated';
import { loadCuratedDictionary } from './dictionaryCurated';

let CURATED: CuratedDict | null = null;
let loading: Promise<CuratedDict> | null = null;

export async function loadDictionary(): Promise<Set<string>> {
  if (!CURATED) {
    // Share one request between every caller that asks before it finishes
    loading = loading ?? loadCuratedDictionary();
    CURATED = await loading;
  }
  return CURATED.set;
}

export const isDictionaryLoaded = () => CURATED !== null;

export function getDictionary(): Set<string> {
  return CURATED?.set ?? new Set<string>([
    // tiny safe fallback so nothing breaks before load
    'ON','IN','TO','OF','AT','OR','AS','AN','HE','WE','US'
  ]);
}

export function isDictionaryHealthy(): boolean {
  return !!CURATED?.healthy;
}
// Everyday words (SCOWL size 50 and below). The AI aims for these so it plays words people recognise.
let COMMON: Set<string> | null = null;
let commonLoading: Promise<Set<string>> | null = null;

export async function loadCommonWords(): Promise<Set<string>> {
  if (COMMON) return COMMON;
  commonLoading = commonLoading ?? fetch('/words-common.txt', { cache: 'force-cache' })
    .then(r => (r.ok ? r.text() : ''))
    .then(t => new Set(t.split(/\r?\n/).map(w => w.trim()).filter(Boolean)))
    .catch(() => new Set<string>());
  COMMON = await commonLoading;
  return COMMON;
}

export const getCommonWords = () => COMMON;
