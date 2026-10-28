import { useEffect, useState } from 'react';
import { loadDictionary, isDictionaryLoaded } from '@/game/dictionary';

/** True once the word list has loaded, so scoring never runs against an empty dictionary */
export const useDictionaryReady = () => {
  const [ready, setReady] = useState(isDictionaryLoaded());
  useEffect(() => {
    if (ready) return;
    let alive = true;
    loadDictionary().then(() => alive && setReady(true));
    return () => { alive = false; };
  }, [ready]);
  return ready;
};
