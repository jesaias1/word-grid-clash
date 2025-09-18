// scripts/build-dictionary.ts
// Usage:  npx ts-node scripts/build-dictionary.ts <path-to-dwyl-words_alpha.txt>

import * as fs from 'fs';
import * as path from 'path';

const INPUT = process.argv[2] || 'words_alpha.txt';
const OUTPUT = path.resolve('public/words-en.txt');

const TWO_LETTER_KEEP = new Set([
  // very common 2-letter words
  'ON','IN','AT','TO','OF','OR','AS','AN','BY','MY','ME','WE','US','UP','NO','DO','GO','SO','IF','IS','IT',
  'AM','BE','HE','SH'
]);

const BLACKLIST = new Set([
  // obvious non-lexical junk/abbrevs you've seen
  'AA','ADVT','ADV','TBH','LOL','DIY','FYI','AKA','ETA','ETD','CEO','CFO','CTO','USA','UK','EU'
]);

const isAZ = (s: string) => /^[A-Z]+$/.test(s);
const hasVowel = (s: string) => /[AEIOU]/.test(s);
const hasVowelOrY = (s: string) => /[AEIOUY]/.test(s);

// heuristics:
// - only A–Z, UPPERCASE
// - length >= 2
// - keep common 2-letter words (whitelist). Otherwise, drop 2-letter if not in whitelist.
// - drop items in BLACKLIST
// - drop likely acronyms: 3–6 letters, no vowels but maybe Y-only at very end (e.g., "PR", "HR", "ADVT")
// - require at least one vowel OR Y for words length >= 3 (so "RHYTHM" counts via Y)
// - limit max length to 24 to avoid obvious artifacts
function accept(raw: string): boolean {
  const w = raw.trim().toUpperCase();
  if (w.length < 2 || w.length > 24) return false;
  if (!isAZ(w)) return false;
  if (BLACKLIST.has(w)) return false;

  if (w.length === 2) {
    return TWO_LETTER_KEEP.has(w);
  }

  // Reject likely acronyms (no vowels and no Y in the interior)
  if (!hasVowel(w)) {
    // allow words that use Y as a vowel (e.g., RHYTHM, GYPSY)
    if (!hasVowelOrY(w)) return false;
    // if it's composed entirely of consonants except possibly a terminal Y and length small → likely acronym
    if (/^[B-DF-HJ-NP-TV-Z]+Y?$/.test(w) && w.length <= 6) return false;
  }

  // Disallow improbable endings that are typical of codes (tweakable)
  if (/^[A-Z]{3,}V$/.test(w) || /^[A-Z]{3,}J$/.test(w) || /^[A-Z]{3,}Q$/.test(w)) return false;

  return true;
}

function main() {
  const src = fs.readFileSync(INPUT, 'utf8');
  const out = new Set<string>();

  for (const line of src.split(/\r?\n/)) {
    const w = line.trim().toUpperCase();
    if (accept(w)) out.add(w);
  }

  // Ensure whitelisted 2-letter words are present
  for (const w of TWO_LETTER_KEEP) out.add(w);

  // Write as one word per line
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, Array.from(out).sort().join('\n') + '\n', 'utf8');

  console.log(`Curated ${out.size.toLocaleString()} words → ${OUTPUT}`);
}

main();
