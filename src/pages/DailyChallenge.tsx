import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getDictionary } from '@/game/dictionary';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { useToast } from '@/hooks/use-toast';
import { useDailyChallenge, getTierColor, getTierEmoji, getTierFromScore, Tier } from '@/hooks/useDailyChallenge';
import { ArrowLeft, Share2, Flame, Trophy, Target, Clock } from 'lucide-react';
import WordsList from '@/components/WordsList';

type GridCell = { letter: string | null };
type Grid = GridCell[][];

interface CooldownState {
  [letter: string]: number;
}

const TURN_TIME_LIMIT = 30;

// Countdown to next daily challenge (midnight local time)
const NextChallengeCountdown = () => {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>Next challenge in {timeLeft}</span>
    </div>
  );
};

const DailyChallengePage = () => {
  const navigate = useNavigate();
  const { playFeedback } = useSoundEffects(true, true);
  const { celebrate } = useVictoryCelebration();
  const { toast } = useToast();
  
  const {
    challenge,
    attempt,
    streak,
    loading,
    startAttempt,
    updateAttempt,
    completeAttempt,
    generateShareText,
    hasCompletedToday,
  } = useDailyChallenge();
  
  const [grid, setGrid] = useState<Grid>([]);
  const [score, setScore] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [cooldowns, setCooldowns] = useState<CooldownState>({});
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  
  const ALL_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY'.split('');
  const VOWELS = ['A', 'E', 'I', 'O', 'U'];
  
  // Generate 7 unique random letters (at least 1 vowel, none from previous set) - no cooldowns in daily challenge
  const generateLetterChoices = useCallback((previousLetters: string[] = []) => {
    const previousSet = new Set(previousLetters);
    const availablePool = ALL_LETTERS.filter(l => !previousSet.has(l));
    const availableVowels = VOWELS.filter(v => !previousSet.has(v));
    
    // If not enough letters available (unlikely), use full alphabet
    const pool = availablePool.length >= 7 ? availablePool : ALL_LETTERS;
    const vowelPool = availableVowels.length > 0 ? availableVowels : VOWELS;
    
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const choices: string[] = [];
    const used = new Set<string>();
    
    // Ensure at least 1 vowel from available vowels
    const vowel = vowelPool[Math.floor(Math.random() * vowelPool.length)];
    choices.push(vowel);
    used.add(vowel);
    
    // Fill remaining 6 with unique random letters
    for (const letter of shuffled) {
      if (choices.length >= 7) break;
      if (!used.has(letter)) {
        choices.push(letter);
        used.add(letter);
      }
    }
    
    return choices.sort(() => Math.random() - 0.5);
  }, []);
  
  // Initialize grid from challenge
  useEffect(() => {
    if (challenge && !gameStarted) {
      const initialGrid: Grid = challenge.starting_grid.map(row => 
        row.map(cell => ({ letter: cell }))
      );
      setGrid(initialGrid);
      
      // If already completed today, show results
      if (hasCompletedToday && attempt) {
        setScore(attempt.score);
        setWords(attempt.words_found);
        setGameEnded(true);
        setShowResultDialog(true);
      }
    }
  }, [challenge, gameStarted, hasCompletedToday, attempt]);
  
  // Turn timer
  useEffect(() => {
    if (!gameStarted || gameEnded) return;
    
    const timer = setInterval(() => {
      setTurnTimeRemaining(prev => {
        if (prev <= 1) {
          handleTurnTimeout();
          return TURN_TIME_LIMIT;
        }
        if (prev === 6) {
          playFeedback('timerWarning');
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameStarted, gameEnded]);
  
  // Keyboard support - no cooldowns in daily challenge
  useEffect(() => {
    if (!gameStarted || gameEnded) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      
      if (availableLetters.includes(key)) {
        setSelectedLetter(key);
        playFeedback('select');
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameEnded, availableLetters, playFeedback]);
  
  const handleStartGame = async () => {
    if (hasCompletedToday) {
      setShowResultDialog(true);
      return;
    }
    
    const attemptResult = await startAttempt();
    if (attemptResult) {
      setGameStarted(true);
      setIsPracticeMode(false);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      setAvailableLetters(generateLetterChoices([]));
      playFeedback('click');
    }
  };
  
  const handleStartPractice = () => {
    // Generate random starting grid for practice
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    const consonants = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'Y'];
    
    const practiceGrid: Grid = Array(5).fill(null).map(() => 
      Array(5).fill(null).map(() => ({ letter: null }))
    );
    
    // Place 2 vowels and 3 consonants randomly
    const positions: [number, number][] = [];
    while (positions.length < 5) {
      const row = Math.floor(Math.random() * 5);
      const col = Math.floor(Math.random() * 5);
      if (!positions.some(p => p[0] === row && p[1] === col)) {
        positions.push([row, col]);
      }
    }
    
    positions.forEach((pos, i) => {
      if (i < 2) {
        practiceGrid[pos[0]][pos[1]] = { letter: vowels[Math.floor(Math.random() * vowels.length)] };
      } else {
        practiceGrid[pos[0]][pos[1]] = { letter: consonants[Math.floor(Math.random() * consonants.length)] };
      }
    });
    
    setGrid(practiceGrid);
    setScore(0);
    setWords([]);
    setGameStarted(true);
    setGameEnded(false);
    setIsPracticeMode(true);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    setAvailableLetters(generateLetterChoices([]));
    playFeedback('click');
  };
  
  const handleTurnTimeout = () => {
    const newScore = Math.max(0, score - 5);
    setScore(newScore);
    if (!isPracticeMode) {
      updateAttempt(newScore, words);
    }
    
    // Generate new letters on timeout (different from current set)
    setSelectedLetter(null);
    setAvailableLetters(prev => generateLetterChoices(prev));
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    
    toast({
      title: "Time's up!",
      description: "-5 points",
      variant: "destructive",
    });
  };
  
  const advanceToNextTurn = () => {
    // No turn limit - game continues until board is full
    // Generate new letters different from current set
    setSelectedLetter(null);
    setAvailableLetters(prev => generateLetterChoices(prev));
    setTurnTimeRemaining(TURN_TIME_LIMIT);
  };
  
  const placeLetter = (row: number, col: number) => {
    if (!selectedLetter || gameEnded || !gameStarted) return;
    
    if (grid[row][col].letter !== null) {
      playFeedback('invalid');
      return;
    }
    
    playFeedback('place');
    
    const newGrid = grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col] = { letter: selectedLetter };
    
    // Calculate score
    const gridForScoring = newGrid.map(row => row.map(cell => cell.letter || ''));
    const result = calculateScore(gridForScoring, SCORE_OPTS());
    
    // Find new words
    const existingWords = new Set(words);
    const newWordsFound = result.words.filter(w => !existingWords.has(w.text));
    const newScore = result.score;
    
    setScore(newScore);
    setWords(result.words.map(w => w.text));
    setGrid(newGrid);
    
    // Words are now shown in the WordsList component instead of toast
    if (newWordsFound.length > 0) {
      playFeedback('score');
    }
    
    // No cooldowns in daily challenge mode
    
    // Update attempt in database (only for real challenges, not practice)
    if (!isPracticeMode) {
      updateAttempt(newScore, result.words.map(w => w.text));
    }
    
    // Check if grid is full or advance
    const isFull = newGrid.every(row => row.every(cell => cell.letter !== null));
    if (isFull) {
      // Pass current values to endGame since state hasn't updated yet
      endGame(newScore, result.words.map(w => w.text));
    } else {
      advanceToNextTurn();
    }
  };
  
  const endGame = async (finalScore?: number, finalWords?: string[]) => {
    // Use passed values if available (from last letter placement), otherwise use state
    const scoreToSave = finalScore ?? score;
    const wordsToSave = finalWords ?? words;
    
    setGameEnded(true);
    setGameStarted(false);
    playFeedback('gameEnd');
    
    // Update state with final values
    if (finalScore !== undefined) setScore(finalScore);
    if (finalWords !== undefined) setWords(finalWords);
    
    if (!isPracticeMode) {
      await completeAttempt(scoreToSave, wordsToSave);
    }
    
    const tier = challenge ? getTierFromScore(scoreToSave, {
      bronze: challenge.bronze_target,
      silver: challenge.silver_target,
      gold: challenge.gold_target,
    }) : 'none';
    
    if (tier === 'gold' || tier === 'diamond') {
      celebrate();
    }
    
    setTimeout(() => setShowResultDialog(true), 500);
  };
  
  const handleShare = async () => {
    if (!challenge) return;
    
    const tier = getTierFromScore(score, {
      bronze: challenge.bronze_target,
      silver: challenge.silver_target,
      gold: challenge.gold_target,
    });
    
    const shareText = generateShareText(score, tier);
    
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Copied to clipboard!",
          description: "Share your results with friends",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getShareContent = () => {
    if (!challenge) return { text: '', url: 'https://lettus.fun' };
    
    const tier = getTierFromScore(score, {
      bronze: challenge.bronze_target,
      silver: challenge.silver_target,
      gold: challenge.gold_target,
    });
    
    const emoji = getTierEmoji(tier);
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const text = `${emoji} Lettus Daily Challenge - ${date}\n\nScore: ${score} pts (${tier.toUpperCase()})\nStreak: ${streak} days 🔥\n\nPlay now at lettus.fun`;
    
    return { text, url: 'https://lettus.fun' };
  };

  const handleShareToMessenger = () => {
    const { text, url } = getShareContent();
    const messengerUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=0&redirect_uri=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    window.open(messengerUrl, '_blank', 'width=600,height=400');
    toast({
      title: "Opening Messenger",
      description: "Share your victory with friends!",
    });
  };

  const handleShareToTwitter = () => {
    const { text, url } = getShareContent();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  const handleShareToInstagram = () => {
    // Instagram doesn't support direct sharing via URL, so we copy to clipboard
    const { text } = getShareContent();
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard!",
      description: "Open Instagram and paste in your story. Screenshot this screen to share!",
    });
  };

  const handleCopyToClipboard = async () => {
    const { text } = getShareContent();
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard!",
        description: "Share your results anywhere",
      });
    } catch (error) {
      console.error('Error copying:', error);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading Daily Challenge...</div>
      </div>
    );
  }
  
  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 text-center space-y-4">
          <h2 className="text-xl font-bold">Unable to load challenge</h2>
          <Button onClick={() => navigate('/')}>Back to Menu</Button>
        </Card>
      </div>
    );
  }
  
  const currentTier = getTierFromScore(score, {
    bronze: challenge.bronze_target,
    silver: challenge.silver_target,
    gold: challenge.gold_target,
  });

  // Pre-game screen
  if (!gameStarted && !gameEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
        <div className="text-center space-y-6 max-w-md w-full animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Daily Challenge</h1>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          
          {streak > 0 && (
            <div className="flex items-center justify-center gap-2 text-xl font-bold text-orange-500">
              <Flame className="w-6 h-6" />
              {streak} Day Streak
            </div>
          )}
          
          <Card className="p-4 bg-card/50">
            <h3 className="font-semibold mb-3">Target Scores</h3>
            <div className="flex justify-around text-sm">
              <div className="text-center">
                <div className="text-2xl">🥉</div>
                <div className="text-orange-600">Bronze</div>
                <div className="font-bold">{challenge.bronze_target}+</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🥈</div>
                <div className="text-gray-300">Silver</div>
                <div className="font-bold">{challenge.silver_target}+</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🥇</div>
                <div className="text-yellow-400">Gold</div>
                <div className="font-bold">{challenge.gold_target}+</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">💎</div>
                <div className="text-cyan-400">Diamond</div>
                <div className="font-bold">{challenge.gold_target + 20}+</div>
              </div>
            </div>
          </Card>
          
          {hasCompletedToday && attempt ? (
            <div className="space-y-4">
              <Card className="p-4 bg-primary/10 border-primary/30">
                <div className="text-lg font-bold mb-2">Today's Result</div>
                <div className="text-3xl font-bold">{attempt.score} pts</div>
                <div className={`text-xl ${getTierColor(attempt.tier_achieved || 'none')}`}>
                  {getTierEmoji(attempt.tier_achieved || 'none')} {(attempt.tier_achieved || 'none').toUpperCase()}
                </div>
              </Card>
              <NextChallengeCountdown />
              <Button onClick={handleShare} size="lg" className="w-full">
                <Share2 className="w-4 h-4 mr-2" />
                Share Results
              </Button>
            </div>
          ) : (
            <Button onClick={handleStartGame} size="lg" className="w-full h-14 text-lg">
              Start Challenge
            </Button>
          )}
          
          <Button onClick={handleStartPractice} variant="secondary" className="w-full">
            🎲 Practice Mode (doesn't count)
          </Button>
          
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-[100dvh] p-2 flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-1 px-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <span className="font-bold">{isPracticeMode ? 'Practice' : 'Daily'}</span>
          {!isPracticeMode && streak > 0 && (
            <span className="flex items-center gap-1 text-orange-500">
              <Flame className="w-4 h-4" />
              {streak}
            </span>
          )}
          {isPracticeMode && (
            <span className="text-xs text-muted-foreground">(for fun)</span>
          )}
        </div>
        
        <div className={`text-lg font-bold ${getTierColor(currentTier)}`}>
          {getTierEmoji(currentTier)} {score} pts
        </div>
      </div>
      
      {/* Tier Progress Bar */}
      <div className="flex justify-center gap-1 mb-1">
        <div className={`px-1 py-0.5 rounded text-[9px] ${score >= challenge.bronze_target ? 'bg-orange-600/20 text-orange-500' : 'bg-secondary/50'}`}>
          🥉{challenge.bronze_target}
        </div>
        <div className={`px-1 py-0.5 rounded text-[9px] ${score >= challenge.silver_target ? 'bg-gray-400/20 text-gray-300' : 'bg-secondary/50'}`}>
          🥈{challenge.silver_target}
        </div>
        <div className={`px-1 py-0.5 rounded text-[9px] ${score >= challenge.gold_target ? 'bg-yellow-400/20 text-yellow-400' : 'bg-secondary/50'}`}>
          🥇{challenge.gold_target}
        </div>
        <div className={`px-1 py-0.5 rounded text-[9px] ${score >= challenge.gold_target + 20 ? 'bg-cyan-400/20 text-cyan-400' : 'bg-secondary/50'}`}>
          💎{challenge.gold_target + 20}
        </div>
      </div>
      
      {/* Timer - Below ranks, compact */}
      <div className="flex justify-center mb-1">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-base font-bold ${
          turnTimeRemaining <= 5 ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary'
        }`}>
          <Clock className="w-3 h-3" />
          {turnTimeRemaining}s
        </div>
      </div>
      
      {/* Grid with Word List side by side on desktop */}
      <div className="flex-1 flex items-center justify-center gap-4 min-h-0">
        <div className="inline-grid gap-0.5 p-1.5 rounded-xl border-2 bg-gradient-card ring-2 ring-primary/30 border-primary/40 shadow-lg">
          {grid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-0.5">
              {row.map((cell, colIndex) => (
                <button
                  key={colIndex}
                  onClick={() => placeLetter(rowIndex, colIndex)}
                  disabled={!selectedLetter || cell.letter !== null}
                  className={`
                    w-[12vw] h-[12vw] max-w-12 max-h-12 rounded-md font-bold text-lg sm:text-xl
                    transition-all duration-200 border
                    ${cell.letter 
                      ? 'bg-primary/80 text-primary-foreground border-primary shadow-md' 
                      : selectedLetter && !gameEnded
                        ? 'bg-secondary/50 border-border hover:bg-primary/20 hover:border-primary/50 cursor-pointer'
                        : 'bg-secondary/30 border-border/50'
                    }
                  `}
                >
                  {cell.letter || ''}
                </button>
              ))}
            </div>
          ))}
        </div>
        {/* Words list only visible on larger screens */}
        <div className="hidden md:block">
          <WordsList words={words} playerName="You" colorClass="text-primary" />
        </div>
      </div>
      
      {/* Letter Choices - No cooldowns in daily challenge */}
      <div className="flex flex-col items-center gap-0.5 py-1 pb-3 shrink-0">
        <div className="text-[10px] text-muted-foreground">
          Choose a letter
        </div>
        <div className="flex gap-1">
          {availableLetters.map((letter, index) => {
            const isSelected = selectedLetter === letter;
            const isBonusLetter = ['Q', 'X', 'Z'].includes(letter);
            
            return (
              <Button
                key={`${letter}-${index}`}
                onClick={() => {
                  setSelectedLetter(letter);
                  playFeedback('select');
                }}
                variant={isSelected ? 'default' : 'secondary'}
                className={`w-10 h-10 sm:w-11 sm:h-11 text-lg sm:text-lg font-bold p-0 ${
                  isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                } ${isBonusLetter && !isSelected ? 'text-amber-400 border-amber-400/50' : ''}`}
              >
                {letter}
              </Button>
            );
          })}
        </div>
      </div>
      
      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              {isPracticeMode ? 'Practice Complete!' : 'Daily Challenge Complete!'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {isPracticeMode ? 'This was just for fun - no stats recorded' : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="text-5xl mb-2">{getTierEmoji(currentTier)}</div>
              <div className={`text-3xl font-bold ${getTierColor(currentTier)}`}>
                {currentTier.toUpperCase()}
              </div>
              <div className="text-4xl font-bold mt-2">{score} pts</div>
            </div>
            
            {!isPracticeMode && streak > 0 && (
              <div className="flex items-center justify-center gap-2 text-xl font-bold text-orange-500">
                <Flame className="w-6 h-6" />
                {streak} Day Streak!
              </div>
            )}
            
            {words.length > 0 && (
              <div className="bg-secondary/30 rounded-lg p-3">
                <h4 className="font-semibold mb-2">Words Found ({words.length})</h4>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-1">
                  {words.map((word, i) => (
                    <span key={i} className="bg-primary/20 px-2 py-0.5 rounded">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              {isPracticeMode ? (
                <>
                  <Button onClick={handleStartPractice} size="lg" className="w-full">
                    🎲 Try Another Practice
                  </Button>
                  <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                    Back to Home
                  </Button>
                </>
              ) : (
                <>
                  {/* Share Options */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleShareToMessenger()}
                      variant="outline"
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.04.57.61.94 1.13.71l1.98-.87c.17-.08.36-.1.53-.06.91.25 1.88.38 2.9.38 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm5.89 7.58l-2.91 4.65c-.47.75-1.49.94-2.19.42l-2.31-1.74c-.18-.13-.42-.13-.6 0l-3.12 2.38c-.42.32-.96-.17-.68-.61l2.91-4.65c.47-.75 1.49-.94 2.19-.42l2.31 1.74c.18.13.42.13.6 0l3.12-2.38c.42-.32.96.17.68.61z"/>
                      </svg>
                      Messenger
                    </Button>
                    <Button
                      onClick={() => handleShareToTwitter()}
                      variant="outline"
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      X / Twitter
                    </Button>
                    <Button
                      onClick={() => handleShareToInstagram()}
                      variant="outline"
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      Instagram
                    </Button>
                    <Button
                      onClick={() => handleCopyToClipboard()}
                      variant="outline"
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy
                    </Button>
                  </div>
                  
                  <Button onClick={() => navigate('/')} size="lg" className="w-full mt-2">
                    Back to Home
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyChallengePage;
