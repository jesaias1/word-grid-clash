// Player progression kept in this browser: XP, levels, lifetime stats and achievements.
import { useSyncExternalStore } from 'react';

const KEY = 'lettus_progress_v1';

export type GameMode = 'solo' | 'local' | 'online' | 'daily';

export type Stats = {
  gamesPlayed: number;
  wins: number;
  soloWins: number;
  hardWins: number;
  winStreak: number;
  bestWinStreak: number;
  totalWords: number;
  totalPoints: number;
  highScore: number;
  bestMove: number;      // most points from a single placement
  bestCombo: number;     // most words from a single placement
  longestWord: string;
  bonusLetterWords: number; // words using Z, X or Q
};

export type Progress = {
  xp: number;
  stats: Stats;
  achievements: Record<string, string>; // id -> ISO date unlocked
  lastPlayed: string | null;
  playDays: number;      // consecutive days with at least one game
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (s: Stats, p: Progress) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_game', name: 'Seedling', description: 'Finish your first game', icon: '🌱', check: s => s.gamesPlayed >= 1 },
  { id: 'first_win', name: 'First Harvest', description: 'Win a game', icon: '🥬', check: s => s.wins >= 1 },
  { id: 'combo_2', name: 'Double Dip', description: 'Make 2 words with one letter', icon: '✌️', check: s => s.bestCombo >= 2 },
  { id: 'combo_3', name: 'Hat Trick', description: 'Make 3 words with one letter', icon: '🎩', check: s => s.bestCombo >= 3 },
  { id: 'combo_4', name: 'Word Storm', description: 'Make 4 words with one letter', icon: '🌪️', check: s => s.bestCombo >= 4 },
  { id: 'big_move', name: 'Power Play', description: 'Score 10+ points in one move', icon: '⚡', check: s => s.bestMove >= 10 },
  { id: 'huge_move', name: 'Mega Move', description: 'Score 20+ points in one move', icon: '💥', check: s => s.bestMove >= 20 },
  { id: 'long_word', name: 'Wordsmith', description: 'Spell a 5-letter word', icon: '📜', check: s => s.longestWord.length >= 5 },
  { id: 'bonus_letter', name: 'Rare Find', description: 'Use Z, X or Q in a word', icon: '💎', check: s => s.bonusLetterWords >= 1 },
  { id: 'score_30', name: 'Green Thumb', description: 'Score 30+ in a game', icon: '🌿', check: s => s.highScore >= 30 },
  { id: 'score_50', name: 'Master Gardener', description: 'Score 50+ in a game', icon: '🏆', check: s => s.highScore >= 50 },
  { id: 'score_75', name: 'Lettus Legend', description: 'Score 75+ in a game', icon: '👑', check: s => s.highScore >= 75 },
  { id: 'streak_3', name: 'On a Roll', description: 'Win 3 games in a row', icon: '🔥', check: s => s.bestWinStreak >= 3 },
  { id: 'streak_5', name: 'Unstoppable', description: 'Win 5 games in a row', icon: '🚀', check: s => s.bestWinStreak >= 5 },
  { id: 'hard_win', name: 'Giant Slayer', description: 'Beat the Hard AI', icon: '🗡️', check: s => s.hardWins >= 1 },
  { id: 'words_100', name: 'Bookworm', description: 'Find 100 words in total', icon: '🐛', check: s => s.totalWords >= 100 },
  { id: 'words_500', name: 'Walking Dictionary', description: 'Find 500 words in total', icon: '📚', check: s => s.totalWords >= 500 },
  { id: 'games_10', name: 'Regular', description: 'Play 10 games', icon: '🎮', check: s => s.gamesPlayed >= 10 },
  { id: 'games_50', name: 'Devoted', description: 'Play 50 games', icon: '💚', check: s => s.gamesPlayed >= 50 },
  { id: 'days_3', name: 'Daily Greens', description: 'Play 3 days in a row', icon: '📅', check: (_s, p) => p.playDays >= 3 },
  { id: 'days_7', name: 'Week of Lettus', description: 'Play 7 days in a row', icon: '🗓️', check: (_s, p) => p.playDays >= 7 },
];

const emptyStats = (): Stats => ({
  gamesPlayed: 0, wins: 0, soloWins: 0, hardWins: 0, winStreak: 0, bestWinStreak: 0,
  totalWords: 0, totalPoints: 0, highScore: 0, bestMove: 0, bestCombo: 0, longestWord: '', bonusLetterWords: 0,
});

const empty = (): Progress => ({ xp: 0, stats: emptyStats(), achievements: {}, lastPlayed: null, playDays: 0 });

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { ...empty(), ...parsed, stats: { ...emptyStats(), ...(parsed.stats || {}) } };
  } catch {
    return empty();
  }
}

let cache: Progress = read();
const listeners = new Set<() => void>();

function write(next: Progress) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  listeners.forEach(l => l());
}

// --- Levels: each level needs a little more XP than the last
export const xpForLevel = (level: number) => Math.round(100 * Math.pow(level - 1, 1.5));

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, current: xp - floor, needed: ceil - floor, progress: (xp - floor) / (ceil - floor) };
}

const TITLES = ['Sprout', 'Seedling', 'Leafling', 'Gardener', 'Grower', 'Cultivator', 'Harvester', 'Wordsmith', 'Lexicon', 'Grandmaster'];
export const levelTitle = (level: number) => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];

// --- Live move tracking during a game, so a single great move counts even if the game is abandoned
export function recordMove(points: number, words: string[]) {
  const p = read();
  const s = { ...p.stats };
  s.bestMove = Math.max(s.bestMove, points);
  s.bestCombo = Math.max(s.bestCombo, words.length);
  for (const w of words) {
    if (w.length > s.longestWord.length) s.longestWord = w;
    if (/[ZXQ]/.test(w)) s.bonusLetterWords++;
  }
  return commit({ ...p, stats: s });
}

export type GameRecord = {
  mode: GameMode;
  won: boolean;
  tied?: boolean;
  score: number;
  words: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
};

export type GameReward = {
  xpGained: number;
  breakdown: { label: string; xp: number }[];
  levelBefore: number;
  levelAfter: number;
  unlocked: Achievement[];
};

const today = () => new Date().toLocaleDateString('en-CA');
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('en-CA'); };

export function recordGame(game: GameRecord): GameReward {
  const p = read();
  const s = { ...p.stats };
  const levelBefore = levelInfo(p.xp).level;

  s.gamesPlayed++;
  s.totalWords += game.words.length;
  s.totalPoints += game.score;
  s.highScore = Math.max(s.highScore, game.score);
  for (const w of game.words) if (w.length > s.longestWord.length) s.longestWord = w;

  if (game.won) {
    s.wins++;
    s.winStreak++;
    s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
    if (game.mode === 'solo') s.soloWins++;
    if (game.mode === 'solo' && game.difficulty === 'hard') s.hardWins++;
  } else if (!game.tied) {
    s.winStreak = 0;
  }

  let playDays = p.playDays;
  const t = today();
  if (p.lastPlayed !== t) playDays = p.lastPlayed === yesterday() ? playDays + 1 : 1;

  const breakdown: { label: string; xp: number }[] = [{ label: 'Game played', xp: 20 }];
  if (game.score > 0) breakdown.push({ label: `${game.score} points scored`, xp: game.score * 2 });
  if (game.won) {
    const mult = game.difficulty === 'hard' ? 2 : game.difficulty === 'easy' ? 0.5 : 1;
    breakdown.push({ label: game.difficulty ? `Victory (${game.difficulty})` : 'Victory', xp: Math.round(50 * mult) });
  }
  if (game.won && s.winStreak >= 2) breakdown.push({ label: `${s.winStreak}-win streak`, xp: Math.min(50, s.winStreak * 10) });
  if (p.lastPlayed !== t) breakdown.push({ label: 'First game today', xp: 25 });

  const xpGained = breakdown.reduce((n, b) => n + b.xp, 0);
  const next: Progress = { ...p, xp: p.xp + xpGained, stats: s, lastPlayed: t, playDays };
  const unlocked = commit(next);

  return { xpGained, breakdown, levelBefore, levelAfter: levelInfo(read().xp).level, unlocked };
}

// Save progress and return any achievements that were just unlocked
function commit(next: Progress): Achievement[] {
  const unlocked: Achievement[] = [];
  const achievements = { ...next.achievements };
  for (const a of ACHIEVEMENTS) {
    if (!achievements[a.id] && a.check(next.stats, next)) {
      achievements[a.id] = new Date().toISOString();
      unlocked.push(a);
    }
  }
  // Achievements are worth a little XP each
  write({ ...next, achievements, xp: next.xp + unlocked.length * 30 });
  if (unlocked.length) achievementListeners.forEach(l => l(unlocked));
  return unlocked;
}

const achievementListeners = new Set<(a: Achievement[]) => void>();
export const onAchievements = (fn: (a: Achievement[]) => void) => {
  achievementListeners.add(fn);
  return () => { achievementListeners.delete(fn); };
};

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export const useProgress = () => useSyncExternalStore(subscribe, () => cache);
