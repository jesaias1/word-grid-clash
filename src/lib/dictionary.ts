let dictionaryCache: Set<string> | null = null;
let loadingPromise: Promise<Set<string>> | null = null;

export async function loadDictionary(): Promise<Set<string>> {
  if (dictionaryCache) return dictionaryCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch('/words.txt')
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to load dictionary');
      const text = await res.text();
      const set = new Set<string>();
      // words_alpha.txt is one word per line
      text.split('\n').forEach((w) => {
        const word = w.trim().toLowerCase();
        if (word) set.add(word);
      });
      dictionaryCache = set;
      return set;
    })
    .catch((err) => {
      console.error('Dictionary load error:', err);
      dictionaryCache = new Set();
      return dictionaryCache;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}
