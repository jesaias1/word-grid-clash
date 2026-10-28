import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { useToast } from '@/hooks/use-toast';
import { useDailyChallenge, getTierColor, getTierEmoji, getTierFromScore } from '@/hooks/useDailyChallenge';
import { useDictionaryReady } from '@/hooks/useDictionaryReady';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowLeft, Share2, Flame, Target, Clock, Dices } from 'lucide-react';
import WordsList from '@/components/WordsList';
import TierBadge from '@/components/TierBadge';
import GameGrid from '@/components/game/GameGrid';
import FloatingTiles from '@/components/home/FloatingTiles';
import { GameHeader, TurnTimer, AnimatedNumber } from '@/components/game/GameChrome';
import { MoveFeedbackLayer, useMoveFeedback } from '@/components/game/MoveFeedback';
import { TURN_TIME_LIMIT, TIMEOUT_PENALTY, WARNING_THRESHOLD, cloneGrid, emptyGrid, isGridFull, wordPoints, type Grid } from '@/game/constants';
import { analyzeMove, scoreGrid, scoredCells } from '@/game/moveAnalysis';
import { recordGame, recordMove } from '@/lib/progress';

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY'.split('');
const VOWELS = ['A', 'E', 'I', 'O', 'U'];

// Small seeded random generator so everyone gets the same letters on the same day
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// 7 unique letters, at least one vowel, none from the previous set
function generateLetterChoices(previous: string[], rand: () => number) {
  const prev = new Set(previous);
  const pool = ALL_LETTERS.filter(l => !prev.has(l));
  const vowels = VOWELS.filter(v => !prev.has(v));
  const source = pool.length >= 7 ? pool : ALL_LETTERS;
  const vowelSource = vowels.length ? vowels : VOWELS;

  const shuffle = (arr: string[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const choices = [vowelSource[Math.floor(rand() * vowelSource.length)]];
  for (const l of shuffle(source)) {
    if (choices.length >= 7) break;
    if (!choices.includes(l)) choices.push(l);
  }
  return shuffle(choices);
}

const NextChallengeCountdown = () => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>Next challenge in <span className="tabular-nums text-foreground">{timeLeft}</span></span>
    </div>
  );
};

const DailyChallengePage = () => {
  const navigate = useNavigate();
  const { playFeedback } = useSoundEffects();
  const { celebrate } = useVictoryCelebration();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const dictReady = useDictionaryReady();
  const feedback = useMoveFeedback();

  const { challenge, attempt, streak, loading, startAttempt, updateAttempt, completeAttempt, generateShareText, hasCompletedToday } = useDailyChallenge();

  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [penalty, setPenalty] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [lastPlaced, setLastPlaced] = useState<{ row: number; col: number } | null>(null);
  const [flash, setFlash] = useState<{ cells: Set<string>; key: number } | null>(null);
  // Completed result loaded from the server (score/words aren't recomputed from a grid)
  const [savedResult, setSavedResult] = useState<{ score: number; words: string[] } | null>(null);
  const turnRef = useRef(0);
  const randRef = useRef<() => number>(Math.random);

  const result = useMemo(() => (dictReady ? scoreGrid(grid) : null), [grid, dictReady]);
  const score = savedResult ? savedResult.score : Math.max(0, (result?.score || 0) - penalty);
  const words = useMemo(() => savedResult ? savedResult.words : result?.words.map(w => w.text) || [], [savedResult, result]);
  const scored = useMemo(() => (dictReady ? scoredCells(grid) : undefined), [grid, dictReady]);

  const targets = challenge ? { bronze: challenge.bronze_target, silver: challenge.silver_target, gold: challenge.gold_target } : null;
  const currentTier = targets ? getTierFromScore(score, targets) : 'none';

  const nextLetters = useCallback((prev: string[]) => {
    turnRef.current++;
    return generateLetterChoices(prev, randRef.current);
  }, []);

  // Show the challenge's starting grid, or today's finished result
  useEffect(() => {
    if (!challenge || gameStarted) return;
    setGrid(challenge.starting_grid.map(row => row.map(cell => ({ letter: cell }))));
    if (hasCompletedToday && attempt) {
      setSavedResult({ score: attempt.score, words: attempt.words_found });
      setGameEnded(true);
      setShowResultDialog(true);
    }
  }, [challenge, gameStarted, hasCompletedToday, attempt]);

  const playing = gameStarted && !gameEnded && dictReady;

  const endGame = useCallback(async (finalGrid: Grid, finalPenalty: number) => {
    const r = scoreGrid(finalGrid);
    const finalScore = Math.max(0, r.score - finalPenalty);
    const finalWords = r.words.map(w => w.text);

    setGameEnded(true);
    setGameStarted(false);
    setSelectedLetter(null);
    playFeedback('gameEnd');

    if (!isPracticeMode) {
      await completeAttempt(finalScore, finalWords);
    }
    const tier = targets ? getTierFromScore(finalScore, targets) : 'none';
    recordGame({ mode: 'daily', won: !isPracticeMode && tier !== 'none', score: finalScore, words: finalWords });
    if (tier === 'gold' || tier === 'diamond') celebrate();
    setTimeout(() => setShowResultDialog(true), 700);
  }, [celebrate, completeAttempt, isPracticeMode, playFeedback, targets]);

  // Turn clock
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setTurnTimeRemaining(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    if (turnTimeRemaining === WARNING_THRESHOLD) playFeedback('timerWarning');
    else if (turnTimeRemaining > 0 && turnTimeRemaining < WARNING_THRESHOLD) playFeedback('tick');
    if (turnTimeRemaining === 0) {
      const newPenalty = penalty + TIMEOUT_PENALTY;
      setPenalty(newPenalty);
      if (!isPracticeMode) updateAttempt(Math.max(0, (result?.score || 0) - newPenalty), words);
      setSelectedLetter(null);
      setAvailableLetters(prev => nextLetters(prev));
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      playFeedback('invalid');
      toast({ title: "Time's up!", description: `-${TIMEOUT_PENALTY} points`, variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnTimeRemaining]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setSelectedLetter(null); return; }
      const key = e.key.toUpperCase();
      if (availableLetters.includes(key)) {
        setSelectedLetter(key);
        playFeedback('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, availableLetters, playFeedback]);

  const beginRound = (startGrid: Grid, practice: boolean) => {
    randRef.current = practice || !challenge ? Math.random : seededRandom(`lettus-${challenge.challenge_date}`);
    turnRef.current = 0;
    setGrid(startGrid);
    setPenalty(0);
    setSavedResult(null);
    setLastPlaced(null);
    setFlash(null);
    setSelectedLetter(null);
    setGameStarted(true);
    setGameEnded(false);
    setShowResultDialog(false);
    setIsPracticeMode(practice);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    setAvailableLetters(generateLetterChoices([], randRef.current));
    playFeedback('click');
  };

  const handleStartGame = async () => {
    if (hasCompletedToday) {
      setShowResultDialog(true);
      return;
    }
    if (!challenge) return;
    const ok = await startAttempt();
    if (ok) beginRound(challenge.starting_grid.map(row => row.map(cell => ({ letter: cell }))), false);
  };

  const handleStartPractice = () => {
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    const consonants = 'BCDFGHJKLMNPRSTVWY'.split('');
    const g = emptyGrid();
    const spots = new Set<string>();
    while (spots.size < 5) spots.add(`${Math.floor(Math.random() * 5)}-${Math.floor(Math.random() * 5)}`);
    [...spots].forEach((key, i) => {
      const [r, c] = key.split('-').map(Number);
      const pool = i < 2 ? vowels : consonants;
      g[r][c] = { letter: pool[Math.floor(Math.random() * pool.length)] };
    });
    beginRound(g, true);
  };

  const placeLetter = (row: number, col: number) => {
    if (!selectedLetter || !playing || grid[row][col].letter !== null) return;
    playFeedback('place');

    const after = cloneGrid(grid);
    after[row][col] = { letter: selectedLetter };
    const move = analyzeMove(grid, after);
    setGrid(after);
    setLastPlaced({ row, col });
    setSelectedLetter(null);

    if (move.newWords.length > 0) {
      setFlash({ cells: move.highlightCells, key: Date.now() });
      feedback.push({ who: 'You', player: 1, words: move.newWords, gained: move.gained, mine: true });
      recordMove(move.gained, move.newWords.map(w => w.text));
      if (move.newWords.length >= 2) playFeedback('combo', move.newWords.length);
      else playFeedback('score', move.gained);
    }

    const newScore = Math.max(0, move.score - penalty);
    if (!isPracticeMode) updateAttempt(newScore, move.words);

    if (isGridFull(after)) {
      endGame(after, penalty);
    } else {
      setAvailableLetters(prev => nextLetters(prev));
      setTurnTimeRemaining(TURN_TIME_LIMIT);
    }
  };

  const shareText = () => {
    if (!challenge) return '';
    return generateShareText(score, currentTier);
  };

  const handleShare = async () => {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard!', description: 'Share your result with friends' });
      }
    } catch { /* cancelled */ }
  };

  const handleShareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}`;
    window.open(url, '_blank', 'noopener,width=600,height=400');
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-5xl">🥬</motion.div>
      </div>
    );
  }

  if (!challenge || !targets) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-xl font-bold">Couldn't load today's challenge</h2>
          <p className="text-sm text-muted-foreground">Check your connection, or practise in the meantime.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate('/')} variant="outline">Back to menu</Button>
          </div>
        </div>
      </div>
    );
  }

  const tiers = [
    { emoji: '🥉', name: 'Bronze', color: 'text-orange-500', value: targets.bronze },
    { emoji: '🥈', name: 'Silver', color: 'text-gray-300', value: targets.silver },
    { emoji: '🥇', name: 'Gold', color: 'text-yellow-400', value: targets.gold },
    { emoji: '💎', name: 'Diamond', color: 'text-cyan-400', value: targets.gold + 20 },
  ];

  // Pre-game screen
  if (!gameStarted && !gameEnded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 pt-safe">
        <FloatingTiles count={8} />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative text-center space-y-5 max-w-md w-full">
          <div>
            <div className="flex items-center justify-center gap-2">
              <Target className="w-8 h-8 text-amber-400" />
              <h1 className="text-3xl font-bold">Daily Challenge</h1>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {streak > 0 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center gap-2 text-lg font-bold text-orange-400 glass rounded-full px-4 py-1.5">
              <Flame className="w-5 h-5" /> {streak} day streak
            </motion.div>
          )}

          <div className="glass rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-3">Everyone gets the same board and the same letters today. Fill the grid and hit the targets:</div>
            <div className="grid grid-cols-4 gap-2 text-sm">
              {tiers.map(t => (
                <div key={t.name} className="rounded-xl bg-white/5 py-2">
                  <div className="text-2xl">{t.emoji}</div>
                  <div className={t.color}>{t.name}</div>
                  <div className="font-display font-bold">{t.value}+</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStartGame}
              className="btn-game w-full h-14 text-lg text-white bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 overflow-hidden shimmer"
            >
              Start today's challenge
            </motion.button>
            <Button onClick={handleStartPractice} variant="secondary" className="w-full">
              <Dices className="w-4 h-4 mr-2" /> Practice (doesn't count)
            </Button>
            <Button onClick={() => navigate('/')} variant="ghost" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to menu
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const cell = isMobile ? 'min(15vw, 8dvh, 64px)' : 'min(7vw, 10dvh, 100px)';
  const keySize = isMobile ? 'min(11.5vw, 50px)' : '52px';

  return (
    <div className="h-[100dvh] p-1.5 sm:p-3 pt-safe flex flex-col overflow-hidden">
      <MoveFeedbackLayer events={feedback.events} />
      <GameHeader
        title={isPracticeMode ? 'Practice' : 'Daily Challenge'}
        onHome={() => navigate('/')}
        center={
          gameEnded
            ? <div className="font-display font-bold text-lg text-gold">Complete!</div>
            : <TurnTimer remaining={turnTimeRemaining} label={selectedLetter ? `Place ${selectedLetter}` : 'Pick a letter'} />
        }
      />

      <div className="flex flex-col items-center gap-1.5 mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`font-display font-bold text-3xl tabular-nums ${getTierColor(currentTier)}`}>
            <AnimatedNumber value={score} /> <span className="text-base text-muted-foreground font-sans">pts</span>
          </div>
          {!isPracticeMode && streak > 0 && (
            <span className="text-orange-400 text-sm font-bold flex items-center gap-1"><Flame className="w-4 h-4" />{streak}</span>
          )}
        </div>
        <TierBadge currentTier={currentTier} score={score} targets={targets} />
      </div>

      <div className="flex-1 flex items-center justify-center gap-3 lg:gap-6 min-h-0">
        {/* Same width as the words list, so the board stays centred */}
        <div className="hidden lg:block w-[100px] xl:w-[120px] shrink-0" aria-hidden />
        <GameGrid
          grid={grid}
          player={1}
          interactive={playing}
          active={playing}
          selectedLetter={selectedLetter}
          onCellClick={placeLetter}
          flashCells={flash?.cells}
          flashKey={flash?.key}
          scoredCells={scored}
          lastPlaced={lastPlaced}
          cellSize={cell}
        />
        <WordsList words={words} playerName="You" colorClass="text-primary" />
      </div>

      {playing && (
        <div className="flex flex-col items-center gap-1.5 py-2 pb-safe shrink-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Choose a letter</div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center max-w-[22rem] sm:max-w-none">
            {availableLetters.map((letter, i) => {
              const isSelected = selectedLetter === letter;
              return (
                <motion.button
                  key={`${turnRef.current}-${letter}`}
                  initial={{ y: 30, opacity: 0, rotate: -10 }}
                  animate={{ y: isSelected ? -6 : 0, opacity: 1, rotate: 0, scale: isSelected ? 1.12 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22, delay: isSelected ? 0 : i * 0.03 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => { setSelectedLetter(isSelected ? null : letter); playFeedback('select'); }}
                  aria-pressed={isSelected}
                  className={`tile ${isSelected ? 'tile-gold text-amber-950 [text-shadow:none]' : 'tile-p1'} flex items-center justify-center`}
                  style={{ width: keySize, height: keySize, fontSize: `calc(${keySize} * 0.52)` }}
                >
                  {letter}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
      {gameEnded && !showResultDialog && (
        <div className="flex justify-center gap-2 pb-safe mt-2">
          <Button onClick={() => setShowResultDialog(true)} size="lg">See result</Button>
          <Button onClick={handleStartPractice} variant="secondary" size="lg"><Dices className="w-4 h-4 mr-2" />Practice</Button>
        </div>
      )}

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-display">
              {isPracticeMode ? 'Practice complete!' : 'Daily Challenge complete!'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {isPracticeMode ? 'Just for fun. Nothing recorded.' : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }} className="text-6xl mb-1">
                {getTierEmoji(currentTier)}
              </motion.div>
              <div className={`text-2xl font-display font-bold ${getTierColor(currentTier)}`}>{currentTier.toUpperCase()}</div>
              <div className="text-4xl font-display font-bold mt-1"><AnimatedNumber value={showResultDialog ? score : 0} /> pts</div>
              {currentTier !== 'diamond' && (
                <div className="text-xs text-muted-foreground mt-1">
                  {(() => {
                    const next = tiers.find(t => score < t.value);
                    return next ? `${next.value - score} more for ${next.emoji} ${next.name}` : null;
                  })()}
                </div>
              )}
            </div>

            {!isPracticeMode && streak > 0 && (
              <div className="flex items-center justify-center gap-2 text-lg font-bold text-orange-400">
                <Flame className="w-5 h-5" /> {streak} day streak!
              </div>
            )}

            {!isPracticeMode && <NextChallengeCountdown />}

            {words.length > 0 && (
              <div className="rounded-xl bg-black/20 p-3">
                <h4 className="font-semibold mb-2 text-sm">Words found ({words.length})</h4>
                <div className="flex flex-wrap gap-1">
                  {words.map((w, i) => (
                    <span key={i} className="text-xs bg-primary/15 px-2 py-0.5 rounded">{w} <span className="text-muted-foreground">+{wordPoints(w)}</span></span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!isPracticeMode && (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleShare} className="w-full"><Share2 className="w-4 h-4 mr-2" />Share</Button>
                  <Button onClick={handleShareToTwitter} variant="outline" className="w-full">
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    Post on X
                  </Button>
                </div>
              )}
              <Button onClick={handleStartPractice} variant="secondary" className="w-full">
                <Dices className="w-4 h-4 mr-2" /> {isPracticeMode ? 'Another practice round' : 'Practice (doesn\'t count)'}
              </Button>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">Back to home</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyChallengePage;
