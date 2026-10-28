// A friendly generated name for public boards. Generated rather than typed,
// so nothing offensive can end up on the leaderboard.

const ADJECTIVES = [
  'Crisp', 'Leafy', 'Zesty', 'Crunchy', 'Fresh', 'Sunny', 'Spicy', 'Minty', 'Snappy', 'Peppy',
  'Juicy', 'Tangy', 'Breezy', 'Mighty', 'Clever', 'Swift', 'Lucky', 'Jolly', 'Witty', 'Bold',
];
const NOUNS = [
  'Lettuce', 'Kale', 'Radish', 'Carrot', 'Pepper', 'Basil', 'Celery', 'Turnip', 'Cabbage', 'Fennel',
  'Leek', 'Pea', 'Sprout', 'Chard', 'Rocket', 'Endive', 'Shallot', 'Parsnip', 'Squash', 'Romaine',
];

const KEY = 'lettus_name';

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export function generatePlayerName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${Math.floor(Math.random() * 90) + 10}`;
}

export function getPlayerName(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && /^[A-Za-z0-9 ]{2,20}$/.test(saved)) return saved;
    const name = generatePlayerName();
    localStorage.setItem(KEY, name);
    return name;
  } catch {
    return generatePlayerName();
  }
}

export function rerollPlayerName(): string {
  const name = generatePlayerName();
  try { localStorage.setItem(KEY, name); } catch { /* storage unavailable */ }
  return name;
}
