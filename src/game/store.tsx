import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

export interface GameSubmission {
  playerId: PlayerId;
  word: string;
  points: number;
  ts: number;
}

export interface RoundHistory {
  round: number;
  submissions: GameSubmission[];
}

export interface GameState {
  mode: 'solo' | 'offline-mp';
  players: Player[];
  activePlayerId: PlayerId;
  boardSize: 5 | 7 | 10;
  boardByPlayer: Record<PlayerId, string[][]>;
  
  round: number;
  roundScores: Record<PlayerId, number>;
  cumulativeScores: Record<PlayerId, number>;
  
  // Per-turn random letter (replaces alphabet picker)
  currentLetter: string;
  
  // Sub-word dup guard (per round)
  completedWordHashesThisRound: Record<PlayerId, Set<string>>;
  
  // Attacks
  attackVowel: 'A' | 'E' | 'I' | 'O' | 'U';
  attacksRemaining: Record<PlayerId, number>;
  isAttacking: boolean;
  
  // Timers (optional)
  turnSeconds?: number;
  
  history: RoundHistory[];
  gameStatus: 'setup' | 'playing' | 'ended';
}

const ATTACK_LIMIT: Record<5 | 7 | 10, number> = { 5: 1, 7: 2, 10: 3 };
const VOWELS: ('A' | 'E' | 'I' | 'O' | 'U')[] = ['A', 'E', 'I', 'O', 'U'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const initialScores = (players: Player[]) =>
  Object.fromEntries(players.map(p => [p.id, 0]));

const zeroSets = (players: Player[]) => {
  const map: Record<PlayerId, Set<string>> = {};
  players.forEach(p => { map[p.id] = new Set(); });
  return map;
};

const createEmptyGrid = (size: number): string[][] => 
  Array(size).fill(null).map(() => Array(size).fill(''));

const initializeBoards = (players: Player[], size: number): Record<PlayerId, string[][]> => {
  const boards: Record<PlayerId, string[][]> = {};
  players.forEach(player => {
    boards[player.id] = createEmptyGrid(size);
  });
  return boards;
};

const generateAttackVowel = (): 'A' | 'E' | 'I' | 'O' | 'U' => 
  VOWELS[Math.floor(Math.random() * VOWELS.length)];

const generateRandomLetter = (): string => 
  LETTERS[Math.floor(Math.random() * LETTERS.length)];

const initialState: GameState = {
  mode: 'offline-mp',
  players: [],
  activePlayerId: '',
  boardSize: 5,
  boardByPlayer: {},
  round: 1,
  roundScores: {},
  cumulativeScores: {},
  currentLetter: 'A',
  completedWordHashesThisRound: {},
  attackVowel: 'A',
  attacksRemaining: {},
  isAttacking: false,
  turnSeconds: 30,
  history: [],
  gameStatus: 'setup'
};

export type GameAction =
  | { type: 'INIT_PLAYERS'; players: Player[]; mode: 'solo' | 'offline-mp' }
  | { type: 'PLACE_ON_CELL'; actorId: PlayerId; targetId: PlayerId; r: number; c: number }
  | { type: 'START_TURN' }
  | { type: 'END_TURN' }
  | { type: 'TOGGLE_ATTACK' }
  | { type: 'ROUND_END' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_BOARD_SIZE'; size: 5 | 7 | 10 }
  | { type: 'SET_CURRENT_PLAYER'; playerId: PlayerId }
  | { type: 'SET_GAME_STATUS'; status: GameState['gameStatus'] };


function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'INIT_PLAYERS': {
      const roundScores = initialScores(action.players);
      const cumulativeScores = initialScores(action.players);
      const completedWordHashesThisRound = zeroSets(action.players);
      const boardByPlayer = initializeBoards(action.players, state.boardSize);
      const attacksRemaining: Record<PlayerId, number> = {};
      action.players.forEach(p => {
        attacksRemaining[p.id] = ATTACK_LIMIT[state.boardSize];
      });
      
      return {
        ...state,
        mode: action.mode,
        players: action.players,
        activePlayerId: action.players[0]?.id || '',
        roundScores,
        cumulativeScores,
        completedWordHashesThisRound,
        boardByPlayer,
        attacksRemaining,
        attackVowel: generateAttackVowel(),
        currentLetter: generateRandomLetter(),
        gameStatus: 'playing'
      };
    }
    
    case 'PLACE_ON_CELL': {
      const { actorId, targetId, r, c } = action;
      
      // Choose the letter based on mode
      const letter = state.isAttacking ? state.attackVowel : state.currentLetter;
      const board = JSON.parse(JSON.stringify(state.boardByPlayer[targetId]));
      
      if (board[r][c]) return state; // cannot overwrite
      
      board[r][c] = letter;
      
      // Calculate points using simple scoring for now
      let gained = 1; // Simple: 1 point per letter placed
      const dup = state.completedWordHashesThisRound[actorId] ?? new Set<string>();
      
      const roundScores = { 
        ...state.roundScores, 
        [actorId]: (state.roundScores[actorId] ?? 0) + gained 
      };
      const cumulativeScores = { 
        ...state.cumulativeScores, 
        [actorId]: (state.cumulativeScores[actorId] ?? 0) + gained 
      };
      
      const attacksRemaining = { ...state.attacksRemaining };
      if (state.isAttacking) {
        attacksRemaining[actorId] = Math.max(0, attacksRemaining[actorId] - 1);
      }
      
      return {
        ...state,
        boardByPlayer: { ...state.boardByPlayer, [targetId]: board },
        roundScores,
        cumulativeScores,
        attacksRemaining,
        completedWordHashesThisRound: { ...state.completedWordHashesThisRound, [actorId]: dup },
        isAttacking: false
      };
    }
    
    case 'START_TURN': {
      return { 
        ...state, 
        currentLetter: generateRandomLetter(), 
        isAttacking: false 
      };
    }
    
    case 'END_TURN': {
      // Switch to next player
      const currentIndex = state.players.findIndex(p => p.id === state.activePlayerId);
      const nextIndex = (currentIndex + 1) % state.players.length;
      return { 
        ...state, 
        activePlayerId: state.players[nextIndex].id,
        currentLetter: generateRandomLetter()
      };
    }
    
    case 'TOGGLE_ATTACK': {
      if ((state.attacksRemaining[state.activePlayerId] ?? 0) <= 0) return state;
      return {
        ...state,
        isAttacking: !state.isAttacking
      };
    }
    
    case 'ROUND_END': {
      // Reset only round-specific data, preserve cumulative scores
      const roundScores = initialScores(state.players);
      const completedWordHashesThisRound = zeroSets(state.players);
      const attackVowel = generateAttackVowel();
      
      return { 
        ...state, 
        round: state.round + 1, 
        roundScores, 
        completedWordHashesThisRound,
        attackVowel,
        currentLetter: generateRandomLetter(),
        isAttacking: false
      };
    }
    
    case 'NEW_GAME': {
      const roundScores = initialScores(state.players);
      const cumulativeScores = initialScores(state.players);
      const completedWordHashesThisRound = zeroSets(state.players);
      const boardByPlayer = initializeBoards(state.players, state.boardSize);
      const attacksRemaining: Record<PlayerId, number> = {};
      state.players.forEach(p => {
        attacksRemaining[p.id] = ATTACK_LIMIT[state.boardSize];
      });
      
      return { 
        ...state, 
        round: 1, 
        roundScores, 
        cumulativeScores, 
        history: [], 
        completedWordHashesThisRound,
        boardByPlayer,
        attacksRemaining,
        attackVowel: generateAttackVowel(),
        currentLetter: generateRandomLetter(),
        isAttacking: false,
        gameStatus: 'playing'
      };
    }
    
    case 'SET_BOARD_SIZE': {
      const boardByPlayer = initializeBoards(state.players, action.size);
      const attacksRemaining: Record<PlayerId, number> = {};
      state.players.forEach(p => {
        attacksRemaining[p.id] = ATTACK_LIMIT[action.size];
      });
      
      return { 
        ...state, 
        boardSize: action.size,
        boardByPlayer,
        attacksRemaining
      };
    }
    
    case 'SET_CURRENT_PLAYER': {
      return { ...state, activePlayerId: action.playerId };
    }
    
    case 'SET_GAME_STATUS': {
      return { ...state, gameStatus: action.status };
    }
    
    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};