import { getDictionary } from './dictionary';

export const SCORE_OPTS = () => {
  const dict = getDictionary();
  
  return {
    dictionary: dict,
    useDictionary: true, // ALWAYS use dictionary validation
    dedupe: false,
    minLen: 3 // Minimum 3 letters for valid words
  };
};