import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import { useNavigate } from 'react-router-dom';
import { saveSoloGameState, loadSoloGameState, clearSoloGameState, saveGameToHistory } from '@/hooks/useGameStatePersistence';
import { useDictionaryReady } from '@/hooks/useDictionaryReady';
import { useIsMobile } from '@/hooks/use-mobile';
import WordsList from '@/components/WordsList';
import PlayerSpinner from '@/components/PlayerSpinner';
import ResizableKeyboard from '@/components/ResizableKeyboard';
import GameGrid from '@/components/game/GameGrid';
import LetterKeyboard from '@/components/game/LetterKeyboard';
import GameOverDialog from '@/components/game/GameOverDialog';
import { GameHeader, ScorePill, TurnTimer } from '@/components/game/GameChrome';
import { MoveFeedbackLayer, useMoveFeedback } from '@/components/game/MoveFeedback';
import {
  BOARD_SIZE, TURN_TIME_LIMIT, TIMEOUT_PENALTY, WARNING_THRESHOLD,
  cloneGrid, generateStartingTiles, isGridFull, tickCooldowns, type Grid,
} from '@/game/constants';
import { analyzeMove, scoreGrid, scoredCells } from '@/game/moveAnalysis';
import { chooseAIMove, AI_THINK_MS, type Difficulty } from '@/game/ai';
import { recordGame, recordMove, useProgress, type GameReward } from '@/lib/progress';

type Player = 1 | 2;

interface GameBoardProps {
  boardSize?: number;
  difficulty?: Difficulty;
  onBackToMenu?: () => void;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const GameBoard = ({ boardSize = BOARD_SIZE, difficulty: difficultyProp = 'medium', onBackToMenu }: GameBoardProps) => {
  const { playFeedback } = useSoundEffects();
  const { celebrate } = useVictoryCelebration();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const dictReady = useDictionaryReady();
  const progress = useProgress();
  const feedback = useMoveFeedback();

  // Resume a saved game if there is one
  const [saved] = useState(() => loadSoloGameState());
  const [difficulty, setDifficulty] = useState<Difficulty>(() => (saved?.difficulty as Difficulty) || difficultyProp);

  const [playerGrid, setPlayerGrid] = useState<Grid>(() => saved?.playerGrid || generateStartingTiles(boardSize));
  // Both boards start from the same tiles
  const [aiGrid, setAIGrid] = useState<Grid>(() => saved?.aiGrid || cloneGrid(playerGrid));
  const [currentPlayer, setCurrentPlayer] = useState<Player>(() => (saved?.currentPlayer as Player) || 1);
  const [penalties, setPenalties] = useState<[number, number]>(() => saved?.penalties || [0, 0]);
  // Cooldowns are shared: a letter either side uses is locked for both
  const [cooldowns, setCooldowns] = useState<Record<string, number>>(() => {
    if (!saved) return {};
    const merged: Record<string, number> = { ...saved.playerCooldowns };
    for (const [l, v] of Object.entries(saved.aiCooldowns || {})) merged[l] = Math.max(merged[l] || 0, v);
    for (const l of Object.keys(merged)) if (merged[l] <= 0) delete merged[l];
    return merged;
  });
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(() => saved?.turnTimeRemaining || TURN_TIME_LIMIT);
  const [showSpinner, setShowSpinner] = useState(() => !saved);
  const [lastPlaced, setLastPlaced] = useState<{ player: Player; row: number; col: number } | null>(null);
  const [flash, setFlash] = useState<{ player: Player; cells: Set<string>; key: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [reward, setReward] = useState<GameReward | null>(null);
  const [turnPing, setTurnPing] = useState(0);

  // Scores always come from the boards, minus any timeout penalties
  const playerResult = useMemo(() => (dictReady ? scoreGrid(playerGrid) : null), [playerGrid, dictReady]);
  const aiResult = useMemo(() => (dictReady ? scoreGrid(aiGrid) : null), [aiGrid, dictReady]);
  const playerScore = Math.max(0, (playerResult?.score || 0) - penalties[0]);
  const aiScore = Math.max(0, (aiResult?.score || 0) - penalties[1]);
  const playerWords = useMemo(() => playerResult?.words.map(w => w.text) || [], [playerResult]);
  const aiWords = useMemo(() => aiResult?.words.map(w => w.text) || [], [aiResult]);
  const playerScored = useMemo(() => (dictReady ? scoredCells(playerGrid) : undefined), [playerGrid, dictReady]);
  const aiScored = useMemo(() => (dictReady ? scoredCells(aiGrid) : undefined), [aiGrid, dictReady]);

  const isMyTurn = currentPlayer === 1;
  const playing = !gameEnded && !showSpinner && dictReady;

  // Persist while playing
  useEffect(() => {
    if (gameEnded) return;
    saveSoloGameState({
      playerGrid, aiGrid, currentPlayer, playerScore, aiScore,
      playerCooldowns: cooldowns, aiCooldowns: cooldowns,
      playerWords, aiWords, turnTimeRemaining, gameEnded,
      penalties, difficulty, timestamp: Date.now(),
    });
  }, [playerGrid, aiGrid, currentPlayer, playerScore, aiScore, cooldowns, playerWords, aiWords, turnTimeRemaining, gameEnded, penalties, difficulty]);

  const endGame = useCallback((finalPlayer: Grid, finalAI: Grid, finalPenalties: [number, number]) => {
    const p = scoreGrid(finalPlayer);
    const a = scoreGrid(finalAI);
    const pScore = Math.max(0, p.score - finalPenalties[0]);
    const aScore = Math.max(0, a.score - finalPenalties[1]);
    const pWords = p.words.map(w => w.text);
    const won = pScore > aScore;
    const tie = pScore === aScore;

    setGameEnded(true);
    setSelectedLetter(null);
    clearSoloGameState();
    playFeedback(won || tie ? 'gameEnd' : 'defeat');

    saveGameToHistory({
      type: 'solo',
      players: [
        { name: 'You', score: pScore, words: pWords },
        { name: `AI (${DIFFICULTY_LABEL[difficulty]})`, score: aScore, words: a.words.map(w => w.text) },
      ],
      winnerIndex: tie ? null : won ? 0 : 1,
      completed: true,
    });
    setReward(recordGame({ mode: 'solo', won, tied: tie, score: pScore, words: pWords, difficulty }));

    if (won) celebrate();
    setTimeout(() => setShowVictoryDialog(true), won ? 900 : 600);
  }, [celebrate, difficulty, playFeedback]);

  // Hand the turn to whoever can still play, or end the game
  const advanceTurn = useCallback((from: Player, pGrid: Grid, aGrid: Grid, pens: [number, number]) => {
    const pFull = isGridFull(pGrid);
    const aFull = isGridFull(aGrid);
    if (pFull && aFull) {
      endGame(pGrid, aGrid, pens);
      return;
    }
    let next: Player = from === 1 ? 2 : 1;
    if (next === 1 && pFull) next = 2;
    if (next === 2 && aFull) next = 1;
    setCurrentPlayer(next);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    if (next !== from) playFeedback('turnChange');
    if (next === 1 && from === 2) setTurnPing(p => p + 1);
  }, [endGame, playFeedback]);

  // Apply one placement for either side
  const applyMove = useCallback((who: Player, row: number, col: number, letter: string) => {
    const before = who === 1 ? playerGrid : aiGrid;
    if (before[row][col].letter !== null) return;
    const after = cloneGrid(before);
    after[row][col] = { letter };
    const result = analyzeMove(before, after);

    if (who === 1) setPlayerGrid(after); else setAIGrid(after);
    setCooldowns(prev => tickCooldowns(prev, letter));
    setLastPlaced({ player: who, row, col });

    if (result.newWords.length > 0) {
      setFlash({ player: who, cells: result.highlightCells, key: Date.now() });
      feedback.push({ who: who === 1 ? 'You' : 'AI', player: who, words: result.newWords, gained: result.gained, mine: who === 1 });
      if (who === 1) {
        recordMove(result.gained, result.newWords.map(w => w.text));
        if (result.newWords.length >= 2) playFeedback('combo', result.newWords.length);
        else playFeedback('score', result.gained);
        if (result.gained >= 10) { playFeedback('bigScore'); setShake(s => s + 1); }
      } else {
        playFeedback('score', 2);
      }
    }

    advanceTurn(who, who === 1 ? after : playerGrid, who === 2 ? after : aiGrid, penalties);
  }, [playerGrid, aiGrid, penalties, advanceTurn, feedback, playFeedback]);

  const placeLetter = (row: number, col: number) => {
    if (!selectedLetter || !isMyTurn || !playing) return;
    if (playerGrid[row][col].letter !== null) {
      playFeedback('invalid');
      return;
    }
    playFeedback('place');
    const letter = selectedLetter;
    setSelectedLetter(null);
    applyMove(1, row, col, letter);
  };

  // If the side to move has a full board (e.g. after resuming), pass the turn on
  useEffect(() => {
    if (!playing) return;
    const full = currentPlayer === 1 ? isGridFull(playerGrid) : isGridFull(aiGrid);
    if (full) advanceTurn(currentPlayer, playerGrid, aiGrid, penalties);
  }, [playing, currentPlayer, playerGrid, aiGrid, penalties, advanceTurn]);

  // Turn clock
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTurnTimeRemaining(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [playing, currentPlayer]);

  useEffect(() => {
    if (!playing) return;
    if (isMyTurn && turnTimeRemaining === WARNING_THRESHOLD) playFeedback('timerWarning');
    else if (isMyTurn && turnTimeRemaining > 0 && turnTimeRemaining < WARNING_THRESHOLD) playFeedback('tick');
    if (turnTimeRemaining === 0) {
      // Out of time: lose points and the turn; cooldowns still tick down
      const pens: [number, number] = [...penalties];
      pens[currentPlayer - 1] += TIMEOUT_PENALTY;
      setPenalties(pens);
      setCooldowns(prev => tickCooldowns(prev, null));
      setSelectedLetter(null);
      playFeedback('invalid');
      advanceTurn(currentPlayer, playerGrid, aiGrid, pens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnTimeRemaining]);

  // AI turn
  useEffect(() => {
    if (!playing || currentPlayer !== 2 || isGridFull(aiGrid)) return;
    const [min, max] = AI_THINK_MS[difficulty];
    const timer = setTimeout(() => {
      const move = chooseAIMove(aiGrid, new Set(Object.keys(cooldowns)), difficulty);
      if (move) applyMove(2, move.row, move.col, move.letter);
      else advanceTurn(2, playerGrid, aiGrid, penalties);
    }, min + Math.random() * (max - min));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, currentPlayer, aiGrid]);

  const selectLetter = useCallback((letter: string) => {
    setSelectedLetter(prev => (prev === letter ? null : letter));
    playFeedback('select');
  }, [playFeedback]);

  // Physical keyboard: type a letter to pick it, Escape to clear
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!playing || !isMyTurn || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setSelectedLetter(null); return; }
      const key = e.key.toUpperCase();
      if (key.length === 1 && key >= 'A' && key <= 'Z' && !cooldowns[key]) {
        setSelectedLetter(key);
        playFeedback('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, isMyTurn, cooldowns, playFeedback]);

  const handlePlayAgain = () => {
    clearSoloGameState();
    const start = generateStartingTiles(boardSize);
    setPlayerGrid(start);
    setAIGrid(cloneGrid(start));
    setPenalties([0, 0]);
    setCooldowns({});
    setSelectedLetter(null);
    setCurrentPlayer(1);
    setGameEnded(false);
    setShowVictoryDialog(false);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    setLastPlaced(null);
    setFlash(null);
    setReward(null);
    setShowSpinner(true);
  };

  const goHome = () => {
    clearSoloGameState();
    if (onBackToMenu) onBackToMenu(); else navigate('/');
  };

  const youWon = playerScore > aiScore;
  const tie = playerScore === aiScore;
  const aiThinking = playing && currentPlayer === 2;

  const myCell = isMobile ? 'min(13vw, 6.3dvh, 60px)' : 'min(5.4vw, 8.6dvh, 92px)';
  const aiCell = isMobile ? 'min(8.6vw, 4.3dvh, 40px)' : myCell;

  const playerBoard = (
    <div className="flex items-start gap-2 lg:gap-4">
      <WordsList words={playerWords} playerName="You" colorClass="text-player-1" />
      <motion.div
        key={`shake-${shake}`}
        animate={shake ? { x: [0, -8, 8, -6, 6, -2, 0] } : undefined}
        transition={{ duration: 0.45 }}
      >
        <GameGrid
          grid={playerGrid}
          player={1}
          interactive={playing && isMyTurn}
          active={playing && isMyTurn}
          selectedLetter={selectedLetter}
          onCellClick={placeLetter}
          flashCells={flash?.player === 1 ? flash.cells : undefined}
          flashKey={flash?.key}
          scoredCells={playerScored}
          lastPlaced={lastPlaced?.player === 1 ? lastPlaced : null}
          cellSize={myCell}
        />
      </motion.div>
    </div>
  );

  const aiBoard = (
    <div className="flex items-start gap-2 lg:gap-4">
      <div className="relative">
        <GameGrid
          grid={aiGrid}
          player={2}
          interactive={false}
          active={aiThinking}
          flashCells={flash?.player === 2 ? flash.cells : undefined}
          flashKey={flash?.key}
          scoredCells={aiScored}
          lastPlaced={lastPlaced?.player === 2 ? lastPlaced : null}
          cellSize={aiCell}
        />
        {aiThinking && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 glass rounded-full px-2 py-0.5 flex items-center gap-1 text-[10px] font-bold text-player-2 z-10">
            thinking
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="w-1 h-1 rounded-full bg-player-2" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />
            ))}
          </div>
        )}
      </div>
      <WordsList words={aiWords} playerName="AI" colorClass="text-player-2" />
    </div>
  );

  const turnLabel = gameEnded
    ? (youWon ? 'You win!' : tie ? 'Tie!' : 'AI wins')
    : isMyTurn ? (selectedLetter ? `Place ${selectedLetter}` : 'Your turn') : 'AI is thinking';

  return (
    <>
      {showSpinner && (
        <PlayerSpinner
          playerCount={2}
          onComplete={p => { setCurrentPlayer(p as Player); setShowSpinner(false); setTurnTimeRemaining(TURN_TIME_LIMIT); }}
          playerNames={['You', 'AI']}
        />
      )}
      <MoveFeedbackLayer events={feedback.events} />
      {turnPing > 0 && playing && isMyTurn && (
        <motion.div
          key={turnPing}
          className="pointer-events-none fixed inset-x-0 bottom-[clamp(150px,24dvh,200px)] z-30 flex justify-center"
          initial={{ opacity: 0, y: 12, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [12, 0, 0, -8], scale: [0.8, 1.05, 1, 1] }}
          transition={{ duration: 1.5, times: [0, 0.15, 0.75, 1] }}
        >
          <span className="glass rounded-full px-4 py-1.5 font-display font-semibold text-primary ring-1 ring-primary/50">Your turn!</span>
        </motion.div>
      )}

      <div className="h-[100dvh] p-1.5 sm:p-3 pt-safe mx-auto flex flex-col overflow-hidden">
        <GameHeader
          title={`Solo · ${DIFFICULTY_LABEL[difficulty]}`}
          onHome={() => { playFeedback('click'); if (!gameEnded) setShowBackConfirmDialog(true); else goHome(); }}
          center={
            gameEnded
              ? <div className="font-display font-bold text-xl text-gold">{turnLabel}</div>
              : <TurnTimer remaining={turnTimeRemaining} label={turnLabel} />
          }
        />

        <div className="flex justify-center gap-2 mb-1.5 sm:mb-3 shrink-0">
          <ScorePill name="You" score={playerScore} player={1} active={playing && isMyTurn} />
          <ScorePill name={`AI · ${DIFFICULTY_LABEL[difficulty]}`} score={aiScore} player={2} active={aiThinking} />
        </div>

        {!dictReady ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground animate-pulse">Loading words…</div>
        ) : (
          <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-2 md:gap-6 lg:gap-10 flex-1 min-h-0">
            {isMobile ? <>{aiBoard}{playerBoard}</> : <>{playerBoard}{aiBoard}</>}
          </div>
        )}

        {!gameEnded && (
          <ResizableKeyboard>
            <LetterKeyboard cooldowns={cooldowns} selected={selectedLetter} enabled={playing && isMyTurn} onSelect={selectLetter} />
          </ResizableKeyboard>
        )}
        {gameEnded && !showVictoryDialog && (
          <div className="flex justify-center gap-2 pb-safe mt-2">
            <Button onClick={() => setShowVictoryDialog(true)} size="lg">See results</Button>
            <Button onClick={handlePlayAgain} variant="secondary" size="lg">Play again</Button>
          </div>
        )}
      </div>

      <Dialog open={showBackConfirmDialog} onOpenChange={setShowBackConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">Leave game?</DialogTitle>
            <DialogDescription className="text-center">Your current game will be lost.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-center mt-4">
            <Button variant="outline" onClick={() => setShowBackConfirmDialog(false)}>Keep playing</Button>
            <Button variant="destructive" onClick={() => { setShowBackConfirmDialog(false); goHome(); }}>Leave game</Button>
          </div>
        </DialogContent>
      </Dialog>

      <GameOverDialog
        open={showVictoryDialog}
        onOpenChange={setShowVictoryDialog}
        title={youWon ? '🎉 Victory!' : tie ? '🤝 Tie!' : '😤 So close!'}
        subtitle={youWon ? `You beat the ${DIFFICULTY_LABEL[difficulty]} AI` : tie ? 'Dead even. Rematch?' : `The ${DIFFICULTY_LABEL[difficulty]} AI took this one`}
        players={[
          { name: 'You', score: playerScore, words: playerWords, player: 1 },
          { name: 'AI', score: aiScore, words: aiWords, player: 2 },
        ]}
        winnerIndex={tie ? null : youWon ? 0 : 1}
        reward={reward}
        xpAfter={progress.xp}
        shareText={`🥬 Lettus: I ${youWon ? 'beat' : tie ? 'tied' : 'lost to'} the ${DIFFICULTY_LABEL[difficulty]} AI ${playerScore}–${aiScore} with ${playerWords.length} words. Can you do better? https://lettus.fun`}
        onPlayAgain={handlePlayAgain}
        onHome={() => { setShowVictoryDialog(false); goHome(); }}
        playAgainLabel={youWon ? 'Play again' : 'Rematch'}
        extra={
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Next game:</span>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${difficulty === d ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}
              >
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        }
      />
    </>
  );
};

export default GameBoard;
