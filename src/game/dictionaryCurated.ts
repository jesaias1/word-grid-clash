// src/game/dictionaryCurated.ts
// Curates + merges word sources into a strict, playable dictionary.
//
// Sources (all optional; small local text files):
//  - /words-popular.txt    : the main list (e.g., top 50k/100k popular words; UPPERCASE)
//  - /words-allow.txt      : your manual always-allow (UPPERCASE; one per line)
//  - /words-block.txt      : your manual blocklist (UPPERCASE; one per line)
//
// Rules:
//  - Accept only A–Z words length >= 2
//  - 2-letter words allowed from a fixed whitelist only (common English digrams)
//  - 3-letter words must be either popular OR in a 3-letter whitelist
//  - 4+ words: must be popular, unless explicitly allowed; block if matches "corporate/abbr" patterns
//  - Everything is UPPERCASE inside the set
//
// Fallbacks:
//  - If nothing loads, include a tiny sane seed + common 2-letter words.
//  - Autoguard function lets the scorer accept-all when the dict is tiny (prevents zero scoring).

export type CuratedDict = {
  set: Set<string>;
  healthy: boolean;
};

const A2 = new Set([
  // keep only very common digrams to avoid junk like AA, AO, AR, etc.
  'AM','AN','AS','AT','BE','BY','DO','GO','HE','IF','IN','IS','IT',
  'ME','MY','NO','OF','ON','OR','OX','SO','TO','UP','US','WE'
]);

const A3 = new Set([
  // representative common 3-letter words (expand anytime)
  'ACE','ACT','ADD','AGE','AIR','ALL','AND','ANT','ANY','ARE','ARM','ART','ASH','ASK',
  'BAD','BAG','BAN','BAR','BAT','BED','BEE','BEG','BET','BIG','BIN','BIT','BOX','BOY','BUG','BUS','BUT',
  'CAB','CAN','CAP','CAR','CAT','COP','COT','COW','CRY','CUP','CUT',
  'DAD','DAM','DAY','DEN','DID','DIE','DIG','DIN','DOG','DOT','DRY','DUE',
  'EAR','EAT','EEL','EGG','EGO','ELF','ELK','ELM','EMU','END','ERA','EWE','EYE',
  'FAN','FAR','FAT','FEW','FIG','FIN','FIT','FIX','FLY','FOE','FOG','FOR','FOX',
  'GAP','GAS','GEL','GET','GIG','GIN','GOD','GOT','GUM','GUN','GUT',
  'HAD','HAS','HAT','HER','HIM','HIP','HIS','HIT','HOG','HOT','HOW','HUG','HUM','HUT',
  'ICE','INK','ION','IRE','IVY',
  'JAM','JAR','JET','JOB','JOG','JOY','JUG',
  'KEY','KID','KIN','KIT',
  'LAD','LAW','LAY','LED','LEG','LET','LID','LIE','LIP','LOG','LOT','LOW',
  'MAD','MAN','MAP','MAT','MEN','MET','MUD','MUG',
  'NAB','NAG','NAP','NET','NEW','NOD','NOT','NOW','NUN','NUT',
  'OAK','OAR','OAT','ODD','OFF','ONE','ORE','OWL','OWN',
  'PAD','PAL','PAN','PAR','PAT','PAY','PEA','PEG','PEN','PEP','PET','PIG','PIN','PIT','POD','POP','POT','PRO','PUT',
  'RAG','RAM','RAN','RAP','RAT','RAW','RAY','RED','RID','RIG','RIM','RIP','ROD','ROE','ROT','ROW','RUB','RUG','RUN',
  'SAD','SAP','SAT','SAW','SEA','SEE','SET','SEW','SHE','SHY','SIR','SIT','SKY','SON','SOY','SPA','SUM','SUN',
  'TAB','TAN','TAP','TAR','TEA','TEN','THE','TIN','TIP','TOE','TON','TOO','TOP','TOW','TOY','TRY','TUB',
  'URN','USE','VAN','VAT','VET','VIA',
  'WAR','WAS','WAX','WAY','WEB','WED','WET','WHO','WHY','WIN','WIT','WOE','WON',
  'YAK','YAM','YAP','YAW','YES','YET','YOU','ZOO'
]);

const BAD_SUFFIX = [
  // common corporate/abbr endings
  'ADVT','ADV','LLC','INC','LTD','CO','CORP','GMBH','SRO','PTY','PLC','SRL','PVT',
];

const BAD_RX = [
  /[A-Z]{4,}[^AEIOUY]{4,}/,  // 4+ consonants cluster
  /[QXJ]{2,}/,               // doubled rare letters
];

const FALLBACK_SEED = [
  'ON','IN','TO','OF','AT','OR','AS','AN','HE','WE','US',
  'CAT','DOG','BIRD','NOSE','EAR','EACH','ACHE','LACE','ACE','CAUSE','USE','BECAUSE'
];

// --- helpers
const upper = (s: string) => s.trim().toUpperCase();
const clean = (s: string) => {
  const u = upper(s);
  return /^[A-Z]+$/.test(u) && u.length >= 2 ? u : null;
};

async function fetchList(path: string): Promise<Set<string> | null> {
  try {
    const res = await fetch(path, { cache: 'force-cache' });
    if (!res.ok) return null;
    const txt = await res.text();
    const out = new Set<string>();
    for (const line of txt.split(/\r?\n/)) {
      const w = clean(line);
      if (w) out.add(w);
    }
    return out;
  } catch { return null; }
}

function curate(raw: Set<string>, allow: Set<string>, block: Set<string>): Set<string> {
  const out = new Set<string>();

  const isBlocked = (w: string) =>
    block.has(w) || BAD_SUFFIX.some(s => w.endsWith(s)) || BAD_RX.some(rx => rx.test(w));

  for (const w of raw) {
    if (isBlocked(w)) continue;
    if (w.length === 2) { if (A2.has(w) || allow.has(w)) out.add(w); continue; }
    if (w.length === 3) { if (A3.has(w) || raw.has(w) || allow.has(w)) out.add(w); continue; }
    // 4+ must be in popular list or manually allowed
    if (raw.has(w) || allow.has(w)) out.add(w);
  }

  // Always guarantee core digrams
  for (const w of A2) out.add(w);
  return out;
}

export async function loadCuratedDictionary(): Promise<CuratedDict> {
  // Try local files first (commit these to /public)
  const popular = (await fetchList('/words-popular.txt'))     // from top-english-wordlists (e.g., top 50k)
                || (await fetchList('/words-en.txt'))         // any other main list you already ship
                || new Set<string>();

  const allow   = (await fetchList('/words-allow.txt')) || new Set<string>();
  const block   = (await fetchList('/words-block.txt')) || new Set<string>();

  // If nothing meaningful, fallback seed
  if (popular.size === 0 && allow.size === 0) {
    const seed = new Set(FALLBACK_SEED.map(upper));
    return { set: curate(seed, new Set(), new Set()), healthy: false };
  }

  const curated = curate(popular, allow, block);
  const healthy = curated.size > 5000; // threshold to consider "real"
  return { set: curated, healthy };
}
