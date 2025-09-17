import { calculateScore } from './scoring';

export function calculateBoardScore(board: string[][]) {
  const opts = { 
    useDictionary: false, // For now, accept all 3+ sequences
    dedupe: false, 
    excludeCooldown: false, 
    minLen: 3 
  };
  
  const { score } = calculateScore(board, opts);
  return score;
}

export function getDeltaScore(newTotal: number, prevTotal: number): number {
  return Math.max(0, newTotal - prevTotal);
}