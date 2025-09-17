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
  players: Player[];
  boardSize: 5 | 7 | 10;
  attackLetters: string[];
  roundScores: Record<PlayerId, number>;
  cumulativeScores: Record<PlayerId, number>;
  history: RoundHistory[];
  round: number;
  usedWordsThisRound: Record<PlayerId, Set<string>>;
  currentPlayer: PlayerId | null;
  gameStatus: 'setup' | 'playing' | 'ended';
}

const ATTACK_COUNT: Record<5 | 7 | 10, number> = { 5: 1, 7: 2, 10: 3 };

const initialScores = (players: Player[]) =>
  Object.fromEntries(players.map(p => [p.id, 0]));

const zeroSets = (players: Player[]) => {
  const map: Record<PlayerId, Set<string>> = {};
  players.forEach(p => { map[p.id] = new Set(); });
  return map;
};

const initialState: GameState = {
  players: [],
  boardSize: 5,
  attackLetters: [],
  roundScores: {},
  cumulativeScores: {},
  history: [],
  round: 1,
  usedWordsThisRound: {},
  currentPlayer: null,
  gameStatus: 'setup'
};

export type GameAction =
  | { type: 'INIT_PLAYERS'; players: Player[] }
  | { type: 'SUBMIT_WORD'; playerId: PlayerId; word: string; points: number }
  | { type: 'ROUND_END' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_BOARD_SIZE'; size: 5 | 7 | 10 }
  | { type: 'SET_ATTACK_LETTERS'; letters: string[] }
  | { type: 'SET_CURRENT_PLAYER'; playerId: PlayerId }
  | { type: 'SET_GAME_STATUS'; status: GameState['gameStatus'] };

function generateAttackLetters(count: number): string[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const chosen: string[] = [];
  const available = [...alphabet];
  
  while (chosen.length < count && available.length > 0) {
    const randomIndex = Math.floor(Math.random() * available.length);
    chosen.push(available.splice(randomIndex, 1)[0]);
  }
  
  return chosen;
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'INIT_PLAYERS': {
      const roundScores = initialScores(action.players);
      const cumulativeScores = initialScores(action.players);
      const usedWordsThisRound = zeroSets(action.players);
      const attackLetters = generateAttackLetters(ATTACK_COUNT[state.boardSize]);
      
      return {
        ...state,
        players: action.players,
        roundScores,
        cumulativeScores,
        usedWordsThisRound,
        attackLetters,
        currentPlayer: action.players[0]?.id || null,
        gameStatus: 'playing'
      };
    }
    
    case 'SUBMIT_WORD': {
      const { playerId, word, points } = action;
      
      // Check if word was already used by this player this round
      if (state.usedWordsThisRound[playerId]?.has(word.toLowerCase())) {
        return state;
      }
      
      const roundScores = { 
        ...state.roundScores, 
        [playerId]: (state.roundScores[playerId] ?? 0) + points 
      };
      const cumulativeScores = { 
        ...state.cumulativeScores, 
        [playerId]: (state.cumulativeScores[playerId] ?? 0) + points 
      };
      
      // Update used words for this round
      const usedWordsThisRound = { ...state.usedWordsThisRound };
      usedWordsThisRound[playerId] = new Set(usedWordsThisRound[playerId] ?? []);
      usedWordsThisRound[playerId].add(word.toLowerCase());
      
      // Add to current round's history
      const history = [...state.history];
      const currentRoundIndex = history.findIndex(h => h.round === state.round);
      const submission: GameSubmission = { playerId, word, points, ts: Date.now() };
      
      if (currentRoundIndex >= 0) {
        history[currentRoundIndex].submissions.push(submission);
      } else {
        history.push({ round: state.round, submissions: [submission] });
      }
      
      return { 
        ...state, 
        roundScores, 
        cumulativeScores, 
        usedWordsThisRound, 
        history 
      };
    }
    
    case 'ROUND_END': {
      // Reset only round-specific data, preserve cumulative scores
      const roundScores = initialScores(state.players);
      const usedWordsThisRound = zeroSets(state.players);
      
      return { 
        ...state, 
        round: state.round + 1, 
        roundScores, 
        usedWordsThisRound 
      };
    }
    
    case 'NEW_GAME': {
      const roundScores = initialScores(state.players);
      const cumulativeScores = initialScores(state.players);
      const usedWordsThisRound = zeroSets(state.players);
      const attackLetters = generateAttackLetters(ATTACK_COUNT[state.boardSize]);
      
      return { 
        ...state, 
        round: 1, 
        roundScores, 
        cumulativeScores, 
        history: [], 
        usedWordsThisRound,
        attackLetters,
        gameStatus: 'playing'
      };
    }
    
    case 'SET_BOARD_SIZE': {
      const attackLetters = generateAttackLetters(ATTACK_COUNT[action.size]);
      return { 
        ...state, 
        boardSize: action.size, 
        attackLetters 
      };
    }
    
    case 'SET_ATTACK_LETTERS': {
      return { ...state, attackLetters: action.letters };
    }
    
    case 'SET_CURRENT_PLAYER': {
      return { ...state, currentPlayer: action.playerId };
    }
    
    case 'SET_GAME_STATUS': {
      return { ...state, gameStatus: action.status };
    }
    
    default:
      return state;
  }
}

const GameContext = createContext<{ 
  state: GameState; 
  dispatch: React.Dispatch<GameAction> 
} | null>(null);

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