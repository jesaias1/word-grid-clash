import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { saveLocalMultiplayerState, loadLocalMultiplayerState, clearLocalMultiplayerState, saveGameToHistory } from '@/hooks/useGameStatePersistence';
import { useDictionaryReady } from '@/hooks/useDictionaryReady';
import { useIsMobile } from '@/hooks/use-mobile';
import WordsList from '@/components/WordsList';
import PlayerSpinner from '@/components/PlayerSpinner';
import ResizableKeyboard from '@/components/ResizableKeyboard';
import GameGrid from '@/components/game/GameGrid';
import LetterKeyboard from '@/components/game/LetterKeyboard';
import GameOverDialog from '@/components/game/GameOverDialog';
import { GameHeader, ScorePill, TurnTimer } from '@/components/game/GameChrome';
import { MoveFeedbackLayer, playerColor, useMoveFeedback } from '@/components/game/MoveFeedback';
import {
  BOARD_SIZE, COOLDOWN_TURNS, TURN_TIME_LIMIT, TIMEOUT_PENALTY, WARNING_THRESHOLD,
  cloneGrid, generateStartingTiles, isGridFull, tickCooldowns, type Grid,
} from '@/game/constants';
import { analyzeMove, scoreGrid, scoredCells } from '@/game/moveAnalysis';
import { recordMove } from '@/lib/progress';

interface LocalMultiplayerBoardProps {
  onBackToMenu: () => void;
  boardSize?: number;
  playerCount?: number;
  cooldownTurns?: number;
}

const LocalMultiplayerBoard = ({ onBackToMenu, boardSize = BOARD_SIZE, playerCount = 2, cooldownTurns = COOLDOWN_TURNS }: LocalMultiplayerBoardProps) => {
  const { playFeedback } = useSoundEffects();
  const { celebrate } = useVictoryCelebration();
  const isMobile = useIsMobile();
  const dictReady = useDictionaryReady();
  const feedback = useMoveFeedback();

  const [saved] = useState(() => loadLocalMultiplayerState(playerCount));

  // Every player starts from the same tiles
  const [grids, setGrids] = useState<Grid[]>(() => {
    if (saved?.grids) return saved.grids as Grid[];
    const start = generateStartingTiles(boardSize);
    return Array.from({ length: playerCount }, () => cloneGrid(start));
  });
  const [currentPlayer, setCurrentPlayer] = useState<number>(() => saved?.currentPlayer || 1);
  const [penalties, setPenalties] = useState<number[]>(() => saved?.penalties || Array(playerCount).fill(0));
  const [cooldowns, setCooldowns] = useState<Record<string, number>>(() => saved?.cooldowns || {});
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(() => saved?.turnTimeRemaining || TURN_TIME_LIMIT);
  const [transitionTo, setTransitionTo] = useState<number | null>(null);
  // Blocks input between placing a letter and the hand-over
  const [locked, setLocked] = useState(false);
  const [showSpinner, setShowSpinner] = useState(() => !saved);
  const [lastPlaced, setLastPlaced] = useState<{ player: number; row: number; col: number } | null>(null);
  const [flash, setFlash] = useState<{ player: number; cells: Set<string>; key: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const results = useMemo(() => (dictReady ? grids.map(g => scoreGrid(g)) : null), [grids, dictReady]);
  const scores = grids.map((_, i) => Math.max(0, (results?.[i].score || 0) - (penalties[i] || 0)));
  const playerWords = useMemo(() => grids.map((_, i) => results?.[i].words.map(w => w.text) || []), [grids, results]);
  const scored = useMemo(() => (dictReady ? grids.map(g => scoredCells(g)) : null), [grids, dictReady]);

  const playing = !gameEnded && !showSpinner && dictReady && transitionTo === null && !locked;

  useEffect(() => {
    if (gameEnded) return;
    saveLocalMultiplayerState({
      grids, currentPlayer, scores, cooldowns, playerWords, turnTimeRemaining, gameEnded, penalties, timestamp: Date.now(),
    }, playerCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grids, currentPlayer, cooldowns, turnTimeRemaining, gameEnded, penalties, playerCount]);

  // Next player (1-based) whose board still has space, starting after `from`
  const nextActive = (from: number, gs: Grid[]) => {
    for (let i = 1; i <= playerCount; i++) {
      const p = ((from - 1 + i) % playerCount) + 1;
      if (!isGridFull(gs[p - 1])) return p;
    }
    return null;
  };

  const endLocalGame = (gs: Grid[], pens: number[]) => {
    const final = gs.map((g, i) => Math.max(0, scoreGrid(g).score - (pens[i] || 0)));
    const words = gs.map(g => scoreGrid(g).words.map(w => w.text));
    const top = Math.max(...final);
    const isTie = final.filter(s => s === top).length > 1;

    setGameEnded(true);
    setSelectedLetter(null);
    clearLocalMultiplayerState(playerCount);
    playFeedback('gameEnd');
    if (!isTie) celebrate();

    saveGameToHistory({
      type: 'local',
      playerCount,
      players: final.map((score, idx) => ({ name: `Player ${idx + 1}`, score, words: words[idx] })),
      winnerIndex: isTie ? null : final.indexOf(top),
      completed: true,
    });
    later(() => setShowVictoryDialog(true), 800);
  };

  const passTurn = (from: number, gs: Grid[], pens: number[]) => {
    setLocked(false);
    const next = nextActive(from, gs);
    if (next === null) {
      endLocalGame(gs, pens);
      return;
    }
    if (next === from) {
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      return;
    }
    // Short hand-over screen so the next player knows it's their go
    playFeedback('turnChange');
    setTransitionTo(next);
    later(() => {
      setTransitionTo(null);
      setCurrentPlayer(next);
      setTurnTimeRemaining(TURN_TIME_LIMIT);
    }, 1100);
  };

  const placeLetter = (playerIndex: number, row: number, col: number) => {
    if (!selectedLetter || currentPlayer !== playerIndex + 1 || !playing) return;
    const before = grids[playerIndex];
    if (before[row][col].letter !== null) {
      playFeedback('invalid');
      return;
    }
    playFeedback('place');
    const after = cloneGrid(before);
    after[row][col] = { letter: selectedLetter };
    const result = analyzeMove(before, after);
    const newGrids = grids.map((g, i) => (i === playerIndex ? after : g));

    setGrids(newGrids);
    setCooldowns(prev => tickCooldowns(prev, selectedLetter, cooldownTurns));
    setSelectedLetter(null);
    setLastPlaced({ player: playerIndex + 1, row, col });
    setLocked(true);

    if (result.newWords.length > 0) {
      setFlash({ player: playerIndex + 1, cells: result.highlightCells, key: Date.now() });
      feedback.push({ who: `Player ${playerIndex + 1}`, player: playerIndex + 1, words: result.newWords, gained: result.gained, mine: true });
      recordMove(result.gained, result.newWords.map(w => w.text));
      if (result.newWords.length >= 2) playFeedback('combo', result.newWords.length);
      else playFeedback('score', result.gained);
      if (result.gained >= 10) playFeedback('bigScore');
    }

    // Let the score popup breathe before the hand-over screen
    const from = currentPlayer;
    later(() => passTurn(from, newGrids, penalties), result.newWords.length ? 750 : 250);
  };

  // Pass on immediately if the current player's board is full (e.g. after resuming)
  useEffect(() => {
    if (!playing) return;
    if (isGridFull(grids[currentPlayer - 1])) passTurn(currentPlayer, grids, penalties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, currentPlayer]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTurnTimeRemaining(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [playing, currentPlayer]);

  useEffect(() => {
    if (!playing) return;
    if (turnTimeRemaining === WARNING_THRESHOLD) playFeedback('timerWarning');
    else if (turnTimeRemaining > 0 && turnTimeRemaining < WARNING_THRESHOLD) playFeedback('tick');
    if (turnTimeRemaining === 0) {
      const pens = [...penalties];
      pens[currentPlayer - 1] = (pens[currentPlayer - 1] || 0) + TIMEOUT_PENALTY;
      setPenalties(pens);
      setCooldowns(prev => tickCooldowns(prev, null, cooldownTurns));
      setSelectedLetter(null);
      playFeedback('invalid');
      passTurn(currentPlayer, grids, pens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnTimeRemaining]);

  const selectLetter = useCallback((letter: string) => {
    setSelectedLetter(prev => (prev === letter ? null : letter));
    playFeedback('select');
  }, [playFeedback]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!playing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setSelectedLetter(null); return; }
      const key = e.key.toUpperCase();
      if (key.length === 1 && key >= 'A' && key <= 'Z' && !cooldowns[key]) {
        setSelectedLetter(key);
        playFeedback('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, cooldowns, playFeedback]);

  const handlePlayAgain = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearLocalMultiplayerState(playerCount);
    const start = generateStartingTiles(boardSize);
    setGrids(Array.from({ length: playerCount }, () => cloneGrid(start)));
    setCurrentPlayer(1);
    setPenalties(Array(playerCount).fill(0));
    setCooldowns({});
    setSelectedLetter(null);
    setGameEnded(false);
    setShowVictoryDialog(false);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    setTransitionTo(null);
    setLocked(false);
    setLastPlaced(null);
    setFlash(null);
    setShowSpinner(true);
  };

  const top = Math.max(...scores);
  const leaders = scores.map((s, i) => (s === top ? i : -1)).filter(i => i >= 0);
  const winnerIndex = leaders.length === 1 ? leaders[0] : null;

  const cellSize = isMobile
    ? (playerCount === 2 ? 'min(11vw, 5.4dvh, 50px)' : 'min(7vw, 3.8dvh, 32px)')
    : (playerCount === 2 ? 'min(5.4vw, 8.6dvh, 92px)' : playerCount === 3 ? 'min(3.8vw, 7dvh, 72px)' : 'min(3.4vw, 6.2dvh, 64px)');
  // On a phone the active player's board gets bigger so it is easy to tap
  const activeCell = isMobile && playerCount > 2 ? 'min(10vw, 5dvh, 46px)' : cellSize;

  const renderBoard = (idx: number) => {
    const isActive = currentPlayer === idx + 1;
    return (
      <div key={idx} className="flex items-start gap-2 lg:gap-3">
        {playerCount === 2 && idx === 0 && <WordsList words={playerWords[idx]} playerName={`P${idx + 1}`} colorClass="text-player-1" />}
        <GameGrid
          grid={grids[idx]}
          player={idx + 1}
          interactive={playing && isActive}
          active={!gameEnded && isActive}
          selectedLetter={selectedLetter}
          onCellClick={(r, c) => placeLetter(idx, r, c)}
          flashCells={flash?.player === idx + 1 ? flash.cells : undefined}
          flashKey={flash?.key}
          scoredCells={scored?.[idx]}
          lastPlaced={lastPlaced?.player === idx + 1 ? lastPlaced : null}
          cellSize={isActive && !gameEnded ? activeCell : cellSize}
        />
        {playerCount === 2 && idx === 1 && <WordsList words={playerWords[idx]} playerName={`P${idx + 1}`} colorClass="text-player-2" />}
      </div>
    );
  };

  return (
    <>
      {showSpinner && (
        <PlayerSpinner
          playerCount={playerCount}
          onComplete={p => { setCurrentPlayer(p); setShowSpinner(false); setTurnTimeRemaining(TURN_TIME_LIMIT); }}
          playerNames={Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`)}
        />
      )}
      <MoveFeedbackLayer events={feedback.events} />

      <div className="h-[100dvh] p-1.5 sm:p-3 pt-safe mx-auto flex flex-col overflow-hidden">
        <GameHeader
          title={`${playerCount} Player Local`}
          onHome={() => {
            playFeedback('click');
            if (!gameEnded) setShowBackConfirmDialog(true);
            else { clearLocalMultiplayerState(playerCount); onBackToMenu(); }
          }}
          center={
            gameEnded
              ? <div className="font-display font-bold text-xl text-gold">{winnerIndex !== null ? `Player ${winnerIndex + 1} wins!` : 'Tie!'}</div>
              : <TurnTimer remaining={turnTimeRemaining} label={`Player ${currentPlayer}'s turn`} />
          }
        />

        <div className="flex justify-center flex-wrap gap-1.5 sm:gap-2 mb-1.5 sm:mb-3 shrink-0">
          {scores.map((s, i) => (
            <ScorePill key={i} name={`P${i + 1}`} score={s} player={i + 1} active={!gameEnded && currentPlayer === i + 1} />
          ))}
        </div>

        {!dictReady ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground animate-pulse">Loading words…</div>
        ) : (
          <div className={`flex-1 min-h-0 flex ${
            playerCount === 2
              ? 'flex-col md:flex-row items-center md:items-start justify-center gap-2 md:gap-6 lg:gap-10'
              : 'flex-wrap items-center justify-center content-center gap-2 md:gap-4'
          }`}>
            {grids.map((_, idx) => renderBoard(idx))}
          </div>
        )}

        {!gameEnded && (
          <ResizableKeyboard>
            <LetterKeyboard cooldowns={cooldowns} selected={selectedLetter} enabled={playing} onSelect={selectLetter} cooldownTurns={cooldownTurns} />
          </ResizableKeyboard>
        )}
        {gameEnded && !showVictoryDialog && (
          <div className="flex justify-center gap-2 pb-safe mt-2">
            <Button onClick={() => setShowVictoryDialog(true)} size="lg">See results</Button>
            <Button onClick={handlePlayAgain} variant="secondary" size="lg">Rematch</Button>
          </div>
        )}
      </div>

      {/* Hand-over screen */}
      <AnimatePresence>
        {transitionTo !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -6 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              className="text-center space-y-3"
            >
              <div className={`tile tile-p${transitionTo} w-24 h-24 mx-auto flex items-center justify-center text-5xl`}>P{transitionTo}</div>
              <div className="font-display font-bold text-4xl" style={{ color: playerColor(transitionTo) }}>Player {transitionTo}</div>
              <div className="text-lg text-muted-foreground">Your turn!</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GameOverDialog
        open={showVictoryDialog}
        onOpenChange={setShowVictoryDialog}
        title={winnerIndex !== null ? `🎉 Player ${winnerIndex + 1} wins!` : '🤝 Tie game!'}
        subtitle={winnerIndex !== null ? `${scores[winnerIndex]} points with ${playerWords[winnerIndex].length} words` : 'Nobody could pull ahead'}
        players={scores.map((score, i) => ({ name: `Player ${i + 1}`, score, words: playerWords[i], player: i + 1 }))}
        winnerIndex={winnerIndex}
        shareText={`🥬 Lettus ${playerCount}-player showdown: ${scores.map((s, i) => `P${i + 1} ${s}`).join(' · ')}. Play at https://lettus.fun`}
        onPlayAgain={handlePlayAgain}
        onHome={() => { setShowVictoryDialog(false); onBackToMenu(); }}
        playAgainLabel="Quick rematch"
      />

      <Dialog open={showBackConfirmDialog} onOpenChange={setShowBackConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">Leave game?</DialogTitle>
            <DialogDescription className="text-center">Your current game will be lost.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-center mt-4">
            <Button variant="outline" onClick={() => setShowBackConfirmDialog(false)}>Keep playing</Button>
            <Button variant="destructive" onClick={() => { clearLocalMultiplayerState(playerCount); setShowBackConfirmDialog(false); onBackToMenu(); }}>Leave game</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LocalMultiplayerBoard;
