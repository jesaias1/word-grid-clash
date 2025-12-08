const STORAGE_KEY_PREFIX = 'lettus_game_state_';
const HISTORY_KEY = 'lettus_game_history';
const MAX_HISTORY_ENTRIES = 50;

export interface PersistedGameState {
  grids: any[];
  currentPlayer: number;
  scores: number[];
  cooldowns: Record<string, number>;
  playerWords: string[][];
  turnTimeRemaining: number;
  gameEnded: boolean;
  timestamp: number;
}

export interface SoloPersistedGameState {
  playerGrid: any[];
  aiGrid: any[];
  currentPlayer: number;
  playerScore: number;
  aiScore: number;
  playerCooldowns: Record<string, number>;
  aiCooldowns: Record<string, number>;
  playerWords: string[];
  aiWords: string[];
  turnTimeRemaining: number;
  gameEnded: boolean;
  timestamp: number;
}

export interface LocalGameHistoryEntry {
  id: string;
  type: 'solo' | 'local';
  created_at: string;
  playerCount?: number;
  players: {
    name: string;
    score: number;
    words: string[];
  }[];
  winnerIndex: number | null; // 0-based, null for tie
}

// Max age for saved games (1 hour in ms)
const MAX_GAME_AGE = 60 * 60 * 1000;

export function saveLocalMultiplayerState(state: PersistedGameState, playerCount: number) {
  try {
    const key = `${STORAGE_KEY_PREFIX}local_${playerCount}`;
    localStorage.setItem(key, JSON.stringify({ ...state, timestamp: Date.now() }));
  } catch (e) {
    console.warn('Failed to save game state:', e);
  }
}

export function loadLocalMultiplayerState(playerCount: number): PersistedGameState | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}local_${playerCount}`;
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    
    const state = JSON.parse(saved) as PersistedGameState;
    
    // Check if game is too old or already ended
    if (Date.now() - state.timestamp > MAX_GAME_AGE || state.gameEnded) {
      localStorage.removeItem(key);
      return null;
    }
    
    return state;
  } catch (e) {
    console.warn('Failed to load game state:', e);
    return null;
  }
}

export function clearLocalMultiplayerState(playerCount: number) {
  try {
    const key = `${STORAGE_KEY_PREFIX}local_${playerCount}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear game state:', e);
  }
}

export function saveSoloGameState(state: SoloPersistedGameState) {
  try {
    const key = `${STORAGE_KEY_PREFIX}solo`;
    localStorage.setItem(key, JSON.stringify({ ...state, timestamp: Date.now() }));
  } catch (e) {
    console.warn('Failed to save solo game state:', e);
  }
}

export function loadSoloGameState(): SoloPersistedGameState | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}solo`;
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    
    const state = JSON.parse(saved) as SoloPersistedGameState;
    
    // Check if game is too old or already ended
    if (Date.now() - state.timestamp > MAX_GAME_AGE || state.gameEnded) {
      localStorage.removeItem(key);
      return null;
    }
    
    return state;
  } catch (e) {
    console.warn('Failed to load solo game state:', e);
    return null;
  }
}

export function clearSoloGameState() {
  try {
    const key = `${STORAGE_KEY_PREFIX}solo`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear solo game state:', e);
  }
}

// Game History Functions
export function saveGameToHistory(entry: Omit<LocalGameHistoryEntry, 'id' | 'created_at'>) {
  try {
    const history = getLocalGameHistory();
    const newEntry: LocalGameHistoryEntry = {
      ...entry,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    
    // Add to beginning and limit size
    history.unshift(newEntry);
    if (history.length > MAX_HISTORY_ENTRIES) {
      history.pop();
    }
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Failed to save game to history:', e);
  }
}

export function getLocalGameHistory(): LocalGameHistoryEntry[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return [];
    return JSON.parse(saved) as LocalGameHistoryEntry[];
  } catch (e) {
    console.warn('Failed to load game history:', e);
    return [];
  }
}

export function clearLocalGameHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.warn('Failed to clear game history:', e);
  }
}
