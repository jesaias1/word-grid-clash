import { getDictionary, isDictionaryHealthy } from './dictionary';

export const SCORE_OPTS = () => {
  const dict = getDictionary();
  const healthy = isDictionaryHealthy();
  
  return {
    dictionary: dict,
    useDictionary: healthy, // only filter if we have a good dictionary
    dedupe: false,
    minLen: 2
  };
};