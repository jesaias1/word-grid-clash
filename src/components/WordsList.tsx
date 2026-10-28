import { useEffect, useRef, useState } from 'react';
import { wordPoints } from '@/game/constants';

interface WordsListProps {
  words: string[];
  playerName: string;
  colorClass?: string;
}

const WordsList = ({ words, playerName, colorClass = 'text-primary' }: WordsListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const prevWordsRef = useRef<string[]>([]);
  const [recentWords, setRecentWords] = useState<Set<string>>(new Set());
  
  // Track new words and highlight them temporarily
  useEffect(() => {
    const newWords = words.filter(w => !prevWordsRef.current.includes(w));
    if (newWords.length > 0) {
      setRecentWords(new Set(newWords));
      // Clear highlight after 2 seconds
      const timer = setTimeout(() => {
        setRecentWords(new Set());
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevWordsRef.current = words;
  }, [words]);
  
  // Update prevWordsRef after processing
  useEffect(() => {
    prevWordsRef.current = words;
  }, [words]);
  
  // Scroll to top when new words are added (newest at top)
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [words.length]);
  
  // Show words in reverse order (newest first)
  const reversedWords = [...words].reverse();
  
  return (
    <div className="hidden lg:flex flex-col w-[100px] xl:w-[120px] shrink-0">
      <div className={`text-xs font-semibold mb-1 text-center ${colorClass}`}>
        {playerName === 'You' ? 'Your' : `${playerName}'s`} words
      </div>
      <div 
        ref={listRef}
        className="flex-1 glass rounded-xl p-1.5 overflow-y-auto max-h-[40vh]"
      >
        {words.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/50 text-center italic">
            No words yet
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {reversedWords.map((word, index) => {
              const isRecent = recentWords.has(word);
              return (
                <div 
                  key={`${word}-${index}`}
                  className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded font-medium transition-all ${
                    isRecent 
                      ? 'bg-gold/20 text-gold ring-1 ring-gold/50 animate-fade-in' 
                      : `${colorClass} bg-white/5`
                  }`}
                >
                  {word} <span className="opacity-60">+{wordPoints(word)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WordsList;
