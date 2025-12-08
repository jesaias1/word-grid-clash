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
  // Comprehensive common 3-letter words - always accepted
  'ACE','ACT','ADD','AGE','AGO','AID','AIM','AIR','ALL','AND','ANT','ANY','APE','ARC','ARE','ARK','ARM','ART','ASH','ASK','ATE','AWE','AXE',
  'BAD','BAG','BAN','BAR','BAT','BAY','BED','BEE','BEG','BET','BIG','BIN','BIT','BOW','BOX','BOY','BUD','BUG','BUN','BUS','BUT','BUY',
  'CAB','CAN','CAP','CAR','CAT','COB','COD','COG','COP','COT','COW','COX','CRY','CUB','CUD','CUP','CUR','CUT',
  'DAB','DAD','DAM','DAY','DEN','DEW','DID','DIE','DIG','DIM','DIN','DIP','DOC','DOE','DOG','DOT','DRY','DUB','DUD','DUE','DUG','DUN','DUO','DYE',
  'EAR','EAT','EEL','EGG','EGO','ELF','ELK','ELM','EMU','END','ERA','ERR','EVE','EWE','EYE',
  'FAD','FAN','FAR','FAT','FAX','FED','FEE','FEW','FIG','FIN','FIT','FIX','FLU','FLY','FOB','FOE','FOG','FOP','FOR','FOX','FRY','FUN','FUR',
  'GAB','GAG','GAL','GAP','GAS','GAY','GEL','GEM','GET','GIG','GIN','GNU','GOB','GOD','GOT','GUM','GUN','GUT','GUY','GYM',
  'HAD','HAM','HAS','HAT','HAY','HEM','HEN','HER','HEW','HID','HIM','HIP','HIS','HIT','HOB','HOD','HOG','HOP','HOT','HOW','HUB','HUE','HUG','HUM','HUT',
  'ICE','ICY','ILL','IMP','INK','INN','ION','IRE','IRK','ITS','IVY',
  'JAB','JAG','JAM','JAR','JAW','JAY','JET','JIG','JOB','JOG','JOT','JOY','JUG','JUT',
  'KEG','KEN','KEY','KID','KIN','KIT',
  'LAB','LAC','LAD','LAG','LAP','LAW','LAX','LAY','LEA','LED','LEG','LET','LID','LIE','LIP','LIT','LOG','LOP','LOT','LOW','LUG',
  'MAD','MAN','MAP','MAR','MAT','MAW','MAX','MAY','MEN','MET','MID','MIX','MOB','MOD','MOM','MOP','MOW','MUD','MUG','MUM',
  'NAB','NAG','NAP','NAY','NET','NEW','NIL','NIP','NIT','NOB','NOD','NOR','NOT','NOW','NUB','NUN','NUT',
  'OAK','OAR','OAT','ODD','ODE','OFF','OFT','OHM','OIL','OLD','ONE','OPT','ORB','ORE','OUR','OUT','OWE','OWL','OWN',
  'PAD','PAL','PAN','PAP','PAR','PAT','PAW','PAY','PEA','PEG','PEN','PEP','PER','PET','PEW','PIE','PIG','PIN','PIT','PLY','POD','POP','POT','POW','PRO','PRY','PUB','PUG','PUN','PUP','PUS','PUT',
  'RAD','RAG','RAM','RAN','RAP','RAT','RAW','RAY','RED','REF','REP','RIB','RID','RIG','RIM','RIP','ROB','ROD','ROE','ROT','ROW','RUB','RUG','RUM','RUN','RUT','RYE',
  'SAC','SAD','SAG','SAP','SAT','SAW','SAX','SAY','SEA','SET','SEW','SHE','SHY','SIN','SIP','SIR','SIS','SIT','SIX','SKI','SKY','SLY','SOB','SOD','SON','SOP','SOT','SOW','SOY','SPA','SPY','STY','SUB','SUM','SUN','SUP',
  'TAB','TAD','TAG','TAN','TAP','TAR','TAT','TAX','TEA','TEN','THE','THY','TIC','TIE','TIN','TIP','TIT','TOE','TON','TOO','TOP','TOT','TOW','TOY','TRY','TUB','TUG','TUN','TWO',
  'UGH','UMP','UNS','UPS','URN','USE',
  'VAN','VAT','VET','VIA','VIE','VOW',
  'WAD','WAG','WAR','WAS','WAX','WAY','WEB','WED','WEE','WET','WHO','WHY','WIG','WIN','WIT','WOE','WOK','WON','WOO','WOW',
  'YAK','YAM','YAP','YAW','YEA','YEN','YEP','YES','YET','YEW','YIN','YIP','YOU','YOW',
  'ZAP','ZED','ZEN','ZIP','ZIT','ZOO'
]);

const BAD_SUFFIX = [
  // common corporate/abbr endings
  'ADVT','ADV','LLC','INC','LTD','CO','CORP','GMBH','SRO','PTY','PLC','SRL','PVT',
];

// Common abbreviations and technical terms to block
const COMMON_ABBRS = new Set([
  // Tech abbreviations
  'TTY','AET','KEB','CPU','GPU','RAM','ROM','USB','DVD','LCD','LED','HDMI','API','URL',
  'HTML','CSS','JSON','XML','SQL','HTTP','FTP','SSH','TCP','UDP','VPN','DNS','SMTP',
  'PDF','ZIP','RAR','EXE','DLL','SYS','BAT','CMD','TXT','DOC','XLS','PPT',
  // Corporate/Title abbreviations
  'CEO','CFO','CTO','COO','CIO','EVP','SVP','VIP','MBA','PHD','RN',
  'FBI','CIA','NSA','IRS','EPA','FDA','NASA','NATO',
  // Time abbreviations
  'GMT','UTC','EST','PST','CST','MST','PDT','EDT','CDT','MDT',
  'JAN','FEB','MAR','APR','JUN','JUL','AUG','SEP','OCT','NOV','DEC',
  'MON','TUE','THU','FRI',
  'BCE',
  // Common abbreviations
  'ETC','ASAP','RSVP','FAQ','TBD','TBA','TBC',
  'FYI','BTW','IMO','IMHO','LOL','OMG','WTF','BRB','AFK','IDK',
  // Scrabble-only / obscure words
  'QI','XI','XU','QAT','QOPH','QADI','QAID','QANAT','QWERTY','ZZZ','ZZS',
  // Double letters (not words)
  'AA','BB','CC','DD','EE','FF','GG','HH','II','JJ','KK','LL','NN','OO','PP','QQ','RR','SS','TT','UU','VV','WW','XX','YY','ZZ',
  // Sounds/Noises that aren't real words  
  'AAHS','AALS','BRR','CWM','HMM','MMM','SHH','TSK','UMM',
  'AAL','AAH','AAR','AAS','AAU','AHI','AHS','AIA','AIN','AIS','AIT',
  'ABB','ABY','ACH','ADZ','AFF','AGA','AGS','ALF','ALS','AMA','AMI',
  'AMU','ANA','ANE','APO','ARB','ARD','ARF','ARS','AVA','AVO','AWA',
  'AWL','AWN','AYS','AZO','BAA','BAH','BAM','BAP','BAS','BEL','BEN',
  'BES','BEY','BIS','BIZ','BOD','BOP','BOS','BRO','BUB','BUP','BYS',
  // Measurements (abbreviations)
  'KG','KM','CM','ML','MG','LB','OZ','YD','MPH','KPH',
  // Tech terms (abbreviations)
  'ATM','SIM','SMS','MMS','NFC','WIFI','CDMA','GSM',
  // Common sounds/interjections
  'EEK','EEW','GAH','GRR','HEH','HUH','MEH','NAH',
  'OOH','OOF','OOO','OPE','OWW','PAH','POO','RAH',
  'SSS','TUT','UHH','WAH','YAH','YEP','YUK','YUP',
  // Currency abbreviations
  'USD','EUR','GBP','JPY','CNY','INR','AUD','CAD',
  // Other abbreviations
  'BPM','RPM','JNR','SNR','MRS','BLVD','TER',
  // Scrabble obscure/dialect words to block
  'OWT','EFF','OOT','NOO','YOW','YON','YOD','YOK','YOM','YOB',
  'AWE','AWL','OWT','OOT','OPE','OOF',
]);

const BAD_RX = [
  /[A-Z]{4,}[^AEIOUY]{4,}/,  // 4+ consonants cluster
  /[QXJ]{2,}/,               // doubled rare letters
  /^[BCDFGHJKLMNPQRSTVWXYZ]{3}$/,  // 3-letter words with no vowels at all
  /^[BCDFGHJKLMNPQRSTVWXYZ]{4,}$/,  // 4+ letter words with no vowels
  /(.)\1{2,}/,               // 3+ repeated letters (like AAA, BBB)
  /^[A-Z]{2}S$/,             // 2-letter word + S (like AAS, OOS)
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
    block.has(w) || 
    COMMON_ABBRS.has(w) ||
    BAD_SUFFIX.some(s => w.endsWith(s)) || 
    BAD_RX.some(rx => rx.test(w));

  for (const w of raw) {
    if (isBlocked(w)) continue;
    if (w.length === 2) { if (A2.has(w) || allow.has(w)) out.add(w); continue; }
    // For 3-letter words: accept if in whitelist OR (in raw dict AND has at least one vowel)
    if (w.length === 3) { 
      if (A3.has(w) || allow.has(w)) {
        out.add(w); 
        continue;
      }
      // Also accept from raw dictionary if it contains at least one vowel
      if (raw.has(w) && /[AEIOUY]/.test(w)) {
        out.add(w);
        continue;
      }
      continue;
    }
    // 4+ must be in popular list or manually allowed
    if (raw.has(w) || allow.has(w)) out.add(w);
  }

  // Always guarantee core digrams and 3-letter whitelist
  for (const w of A2) out.add(w);
  for (const w of A3) out.add(w);
  return out;
}

export async function loadCuratedDictionary(): Promise<CuratedDict> {
  // Try local files first (commit these to /public)
  const popular = (await fetchList('/words.txt'))           // full dictionary (370k+ words)
                || (await fetchList('/words-en.txt'))       // fallback
                || (await fetchList('/words-popular.txt'))  // last resort
                || new Set<string>();

  const allow   = (await fetchList('/words-allow.txt')) || new Set<string>();
  const block   = (await fetchList('/words-block.txt')) || new Set<string>();

  // If nothing meaningful, fallback seed
  if (popular.size === 0 && allow.size === 0) {
    const seed = new Set(FALLBACK_SEED.map(upper));
    return { set: curate(seed, new Set(), new Set()), healthy: false };
  }

  const curated = curate(popular, allow, block);
  const healthy = curated.size > 100; // Lower threshold - even small dictionaries are valid
  return { set: curated, healthy };
}
