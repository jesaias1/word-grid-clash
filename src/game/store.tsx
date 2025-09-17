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
  boardByPlayer: Record<PlayerId, string[][]>;
  attackVowel: 'A' | 'E' | 'I' | 'O' | 'U';
  attacksRemaining: Record<PlayerId, number>;
  isAttacking: boolean;
  selectedCell: { row: number; col: number } | null;
  roundScores: Record<PlayerId, number>;
  cumulativeScores: Record<PlayerId, number>;
  history: RoundHistory[];
  round: number;
  completedWordHashesThisRound: Record<PlayerId, Set<string>>;
  currentPlayer: PlayerId | null;
  gameStatus: 'setup' | 'playing' | 'ended';
}

const ATTACK_LIMIT: Record<5 | 7 | 10, number> = { 5: 1, 7: 2, 10: 3 };
const VOWELS: ('A' | 'E' | 'I' | 'O' | 'U')[] = ['A', 'E', 'I', 'O', 'U'];

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

const initialState: GameState = {
  players: [],
  boardSize: 5,
  boardByPlayer: {},
  attackVowel: 'A',
  attacksRemaining: {},
  isAttacking: false,
  selectedCell: null,
  roundScores: {},
  cumulativeScores: {},
  history: [],
  round: 1,
  completedWordHashesThisRound: {},
  currentPlayer: null,
  gameStatus: 'setup'
};

export type GameAction =
  | { type: 'INIT_PLAYERS'; players: Player[] }
  | { type: 'PLACE_LETTER'; playerId: PlayerId; targetBoardId: PlayerId; row: number; col: number; letter: string; points: number; newWords: string[] }
  | { type: 'SELECT_CELL'; row: number; col: number }
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
        players: action.players,
        roundScores,
        cumulativeScores,
        completedWordHashesThisRound,
        boardByPlayer,
        attacksRemaining,
        attackVowel: generateAttackVowel(),
        currentPlayer: action.players[0]?.id || null,
        gameStatus: 'playing'
      };
    }
    
    case 'PLACE_LETTER': {
      const { playerId, targetBoardId, row, col, letter, points, newWords } = action;
      
      // Update the board
      const boardByPlayer = { ...state.boardByPlayer };
      boardByPlayer[targetBoardId] = boardByPlayer[targetBoardId].map(r => [...r]);
      boardByPlayer[targetBoardId][row][col] = letter;
      
      // Update scores
      const roundScores = { 
        ...state.roundScores, 
        [playerId]: (state.roundScores[playerId] ?? 0) + points 
      };
      const cumulativeScores = { 
        ...state.cumulativeScores, 
        [playerId]: (state.cumulativeScores[playerId] ?? 0) + points 
      };
      
      // Update completed words for this round
      const completedWordHashesThisRound = { ...state.completedWordHashesThisRound };
      completedWordHashesThisRound[playerId] = new Set(completedWordHashesThisRound[playerId] ?? []);
      newWords.forEach(word => completedWordHashesThisRound[playerId].add(word.toLowerCase()));
      
      // Update attack quota if this was an attack
      let attacksRemaining = state.attacksRemaining;
      if (targetBoardId !== playerId && state.isAttacking) {
        attacksRemaining = { 
          ...state.attacksRemaining, 
          [playerId]: Math.max(0, (state.attacksRemaining[playerId] ?? 0) - 1) 
        };
      }
      
      // Add to current round's history
      const history = [...state.history];
      const currentRoundIndex = history.findIndex(h => h.round === state.round);
      const submission: GameSubmission = { playerId, word: newWords.join(', '), points, ts: Date.now() };
      
      if (currentRoundIndex >= 0) {
        history[currentRoundIndex].submissions.push(submission);
      } else {
        history.push({ round: state.round, submissions: [submission] });
      }
      
      return { 
        ...state, 
        boardByPlayer,
        roundScores, 
        cumulativeScores, 
        completedWordHashesThisRound,
        attacksRemaining,
        history,
        selectedCell: null,
        isAttacking: false
      };
    }
    
    case 'SELECT_CELL': {
      return {
        ...state,
        selectedCell: { row: action.row, col: action.col }
      };
    }
    
    case 'TOGGLE_ATTACK': {
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
        selectedCell: null,
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
        selectedCell: null,
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
      return { ...state, currentPlayer: action.playerId };
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