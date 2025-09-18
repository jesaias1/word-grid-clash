import { getDictionary } from './dictionary';

export const SCORE_OPTS = () => ({
  dictionary: getDictionary(),
  useDictionary: true,  // set to false if you want to accept ANY 2+ substring
  dedupe: false,        // <- count every occurrence; NO "once per player"
  minLen: 2             // <- include 2-letter words (ON, IN, AT, …)
});