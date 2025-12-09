import { useEffect, useRef } from 'react';

interface WordsListProps {
  words: string[];
  playerName: string;
  colorClass?: string;
}

const WordsList = ({ words, playerName, colorClass = 'text-primary' }: WordsListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const prevWordsRef = useRef<string[]>([]);
  
  // Scroll to bottom when new words are added
  useEffect(() => {
    if (listRef.current && words.length > prevWordsRef.current.length) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevWordsRef.current = words;
  }, [words]);
  
  // Find newly added words for animation
  const newWords = words.filter(w => !prevWordsRef.current.includes(w));
  
  return (
    <div className="flex flex-col h-full min-w-[80px] max-w-[100px] md:min-w-[100px] md:max-w-[120px]">
      <div className={`text-xs font-semibold mb-1 text-center ${colorClass}`}>
        {playerName}'s Words
      </div>
      <div 
        ref={listRef}
        className="flex-1 bg-card/50 border border-border/50 rounded-lg p-1.5 overflow-y-auto max-h-[200px] md:max-h-[280px]"
      >
        {words.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/50 text-center italic">
            No words yet
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {words.map((word, index) => {
              const isNew = newWords.includes(word) && index >= words.length - newWords.length;
              return (
                <div 
                  key={`${word}-${index}`}
                  className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded ${colorClass} bg-current/10 font-medium transition-all ${
                    isNew ? 'animate-fade-in scale-105' : ''
                  }`}
                >
                  {word} <span className="opacity-60">+{word.length}</span>
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
