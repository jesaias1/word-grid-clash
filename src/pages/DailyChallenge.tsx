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

type GridCell = { letter: string | null };
type Grid = GridCell[][];

interface CooldownState {
  [letter: string]: number;
}

const TURN_TIME_LIMIT = 30;

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
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);
  
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
  
  // Keyboard support
  useEffect(() => {
    if (!gameStarted || gameEnded || !challenge) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const currentLetter = challenge.letter_sequence[currentLetterIndex];
      
      if (key === currentLetter && (cooldowns[key] || 0) === 0) {
        setSelectedLetter(key);
        playFeedback('select');
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameEnded, challenge, currentLetterIndex, cooldowns, playFeedback]);
  
  const handleStartGame = async () => {
    if (hasCompletedToday) {
      setShowResultDialog(true);
      return;
    }
    
    const attemptResult = await startAttempt();
    if (attemptResult) {
      setGameStarted(true);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      playFeedback('click');
    }
  };
  
  const handleTurnTimeout = () => {
    const newScore = Math.max(0, score - 5);
    setScore(newScore);
    updateAttempt(newScore, words);
    advanceToNextLetter();
    
    toast({
      title: "Time's up!",
      description: "-5 points",
      variant: "destructive",
    });
  };
  
  const advanceToNextLetter = () => {
    if (!challenge) return;
    
    const nextIndex = currentLetterIndex + 1;
    if (nextIndex >= challenge.letter_sequence.length) {
      endGame();
    } else {
      setCurrentLetterIndex(nextIndex);
      setSelectedLetter(null);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
    }
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
    
    // Show toast for new words
    if (newWordsFound.length > 0) {
      const pointsGained = newWordsFound.reduce((s, w) => s + w.text.length, 0);
      toast({
        title: `+${pointsGained} points!`,
        description: newWordsFound.map(w => `${w.text} (${w.text.length})`).join(', ')
      });
    }
    
    // Update cooldowns
    const newCooldowns = { ...cooldowns };
    Object.keys(newCooldowns).forEach(l => {
      if (newCooldowns[l] > 0) newCooldowns[l]--;
    });
    newCooldowns[selectedLetter] = 4;
    setCooldowns(newCooldowns);
    
    // Update attempt in database
    updateAttempt(newScore, result.words.map(w => w.text));
    
    // Check if grid is full or advance
    const isFull = newGrid.every(row => row.every(cell => cell.letter !== null));
    if (isFull) {
      endGame();
    } else {
      advanceToNextLetter();
    }
  };
  
  const endGame = async () => {
    setGameEnded(true);
    setGameStarted(false);
    playFeedback('gameEnd');
    
    await completeAttempt(score, words);
    
    const tier = challenge ? getTierFromScore(score, {
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
  
  const currentLetter = challenge.letter_sequence[currentLetterIndex];
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
          
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-2 flex flex-col" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <span className="font-bold">Daily</span>
          {streak > 0 && (
            <span className="flex items-center gap-1 text-orange-500">
              <Flame className="w-4 h-4" />
              {streak}
            </span>
          )}
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full font-mono text-lg font-bold ${
          turnTimeRemaining <= 5 ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary'
        }`}>
          <Clock className="w-4 h-4" />
          {turnTimeRemaining}s
        </div>
        
        <div className={`text-lg font-bold ${getTierColor(currentTier)}`}>
          {getTierEmoji(currentTier)} {score} pts
        </div>
      </div>
      
      {/* Tier Progress Bar */}
      <div className="flex justify-center gap-2 mb-3">
        <div className={`px-2 py-1 rounded text-xs ${score >= challenge.bronze_target ? 'bg-orange-600/20 text-orange-500' : 'bg-secondary/50'}`}>
          🥉 {challenge.bronze_target}
        </div>
        <div className={`px-2 py-1 rounded text-xs ${score >= challenge.silver_target ? 'bg-gray-400/20 text-gray-300' : 'bg-secondary/50'}`}>
          🥈 {challenge.silver_target}
        </div>
        <div className={`px-2 py-1 rounded text-xs ${score >= challenge.gold_target ? 'bg-yellow-400/20 text-yellow-400' : 'bg-secondary/50'}`}>
          🥇 {challenge.gold_target}
        </div>
        <div className={`px-2 py-1 rounded text-xs ${score >= challenge.gold_target + 20 ? 'bg-cyan-400/20 text-cyan-400' : 'bg-secondary/50'}`}>
          💎 {challenge.gold_target + 20}
        </div>
      </div>
      
      {/* Grid */}
      <div className="flex-1 flex items-center justify-center">
        <div className="inline-grid gap-1 p-3 rounded-xl border-2 bg-gradient-card ring-2 ring-primary/30 border-primary/40 shadow-lg">
          {grid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((cell, colIndex) => (
                <button
                  key={colIndex}
                  onClick={() => placeLetter(rowIndex, colIndex)}
                  disabled={!selectedLetter || cell.letter !== null}
                  className={`
                    w-12 h-12 sm:w-14 sm:h-14 rounded-lg font-bold text-xl sm:text-2xl
                    transition-all duration-200 border-2
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
      </div>
      
      {/* Current Letter */}
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="text-sm text-muted-foreground">
          Letter {currentLetterIndex + 1} of {challenge.letter_sequence.length}
        </div>
        <Button
          onClick={() => {
            if ((cooldowns[currentLetter] || 0) === 0) {
              setSelectedLetter(currentLetter);
              playFeedback('select');
            }
          }}
          disabled={(cooldowns[currentLetter] || 0) > 0}
          variant={selectedLetter === currentLetter ? 'default' : 'secondary'}
          className={`w-16 h-16 text-3xl font-bold ${
            selectedLetter === currentLetter ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
          }`}
        >
          {currentLetter}
          {(cooldowns[currentLetter] || 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {cooldowns[currentLetter]}
            </span>
          )}
        </Button>
      </div>
      
      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              Daily Challenge Complete!
            </DialogTitle>
            <DialogDescription className="text-center">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
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
            
            {streak > 0 && (
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
              <Button onClick={handleShare} size="lg" className="w-full">
                <Share2 className="w-4 h-4 mr-2" />
                Share Results
              </Button>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Back to Menu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyChallengePage;
