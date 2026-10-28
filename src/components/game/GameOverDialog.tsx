import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Home, RotateCcw, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { wordPoints } from '@/game/constants';
import { levelInfo, levelTitle, type GameReward } from '@/lib/progress';
import { AnimatedNumber } from './GameChrome';
import { playerColor } from './MoveFeedback';

export type GameOverPlayer = { name: string; score: number; words: string[]; player: number };

interface GameOverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  players: GameOverPlayer[];
  winnerIndex: number | null;
  reward?: GameReward | null;
  xpAfter?: number;
  shareText?: string;
  onPlayAgain: () => void;
  onHome: () => void;
  playAgainLabel?: string;
  extra?: React.ReactNode;
}

const bestWord = (words: string[]) =>
  words.reduce<string | null>((best, w) => (!best || wordPoints(w) > wordPoints(best) || (wordPoints(w) === wordPoints(best) && w.length > best.length) ? w : best), null);

const GameOverDialog = ({
  open, onOpenChange, title, subtitle, players, winnerIndex, reward, xpAfter, shareText,
  onPlayAgain, onHome, playAgainLabel = 'Play Again', extra,
}: GameOverDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [xpShown, setXpShown] = useState(0);

  useEffect(() => {
    if (!open || !reward) return;
    setXpShown(0);
    const t = setTimeout(() => setXpShown(reward.xpGained), 700);
    return () => clearTimeout(t);
  }, [open, reward]);

  const share = async () => {
    if (!shareText) return;
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* cancelled */ }
  };

  const level = xpAfter !== undefined ? levelInfo(xpAfter) : null;
  const leveledUp = reward && reward.levelAfter > reward.levelBefore;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92dvh] overflow-y-auto border-white/10 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            <DialogTitle className="text-3xl sm:text-4xl text-center font-display">{title}</DialogTitle>
          </motion.div>
          {subtitle && <DialogDescription className="text-center text-base">{subtitle}</DialogDescription>}
        </DialogHeader>

        {/* Scores */}
        <div className={`grid gap-2 ${players.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
          {players.map((p, i) => {
            const best = bestWord(p.words);
            const isWinner = winnerIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="rounded-2xl p-3 text-center relative overflow-hidden"
                style={{
                  background: playerColor(p.player, 0.12),
                  boxShadow: isWinner ? `0 0 0 2px ${playerColor(p.player)}, 0 0 24px ${playerColor(p.player, 0.4)}` : `inset 0 0 0 1px ${playerColor(p.player, 0.25)}`,
                }}
              >
                {isWinner && <div className="absolute top-1 right-2 text-lg">👑</div>}
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: playerColor(p.player) }}>{p.name}</div>
                <AnimatedNumber value={open ? p.score : 0} className="block font-display font-bold text-4xl tabular-nums" />
                <div className="text-[11px] text-muted-foreground">{p.words.length} words</div>
                {best && (
                  <div className="mt-1 text-xs">
                    <span className="text-muted-foreground">Best: </span>
                    <span className="font-display font-semibold">{best}</span>
                    <span className="text-gold ml-1">+{wordPoints(best)}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* XP and level */}
        {reward && level && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="rounded-2xl glass p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-display font-semibold">
                Level {level.level} <span className="text-muted-foreground text-sm font-sans">· {levelTitle(level.level)}</span>
              </div>
              <div className="font-display font-bold text-gold">
                +<AnimatedNumber value={xpShown} /> XP
              </div>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(level.progress * 100)}%` }}
                transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
              />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {reward.breakdown.map(b => <span key={b.label}>{b.label} <span className="text-foreground">+{b.xp}</span></span>)}
            </div>
            {leveledUp && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 1.6, duration: 0.5 }}
                className="text-center font-display font-bold text-lg text-gold"
              >
                ⬆️ Level up! You reached level {reward.levelAfter}
              </motion.div>
            )}
            {reward.unlocked.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {reward.unlocked.map(a => (
                  <span key={a.id} className="text-xs rounded-full px-2 py-1 bg-gold/15 text-gold font-semibold">
                    {a.icon} {a.name}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Word lists */}
        <div className={`grid gap-2 ${players.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {players.map((p, i) => (
            <div key={i} className="min-w-0">
              <div className="text-xs font-semibold mb-1 text-center" style={{ color: playerColor(p.player) }}>{p.name === 'You' ? 'Your' : `${p.name}'s`} words</div>
              <div className="max-h-28 overflow-y-auto rounded-xl bg-black/20 p-1.5 flex flex-wrap gap-1 content-start">
                {p.words.length ? p.words.map((w, wi) => (
                  <span key={wi} className="text-[11px] rounded-md px-1.5 py-0.5 bg-white/5">
                    {w} <span className="text-muted-foreground">+{wordPoints(w)}</span>
                  </span>
                )) : <span className="text-xs text-muted-foreground mx-auto">No words</span>}
              </div>
            </div>
          ))}
        </div>

        {extra}

        <div className="flex flex-wrap gap-2 justify-center pt-1">
          <button onClick={onPlayAgain} className="btn-game tile-p1 text-primary-foreground px-6 h-12 text-lg inline-flex items-center gap-2">
            <RotateCcw className="w-5 h-5" /> {playAgainLabel}
          </button>
          {shareText && (
            <button onClick={share} className="btn-game bg-secondary text-secondary-foreground px-4 h-12 inline-flex items-center gap-2">
              {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />} {copied ? 'Copied' : 'Share'}
            </button>
          )}
          <button onClick={onHome} className="btn-game bg-muted text-foreground px-4 h-12 inline-flex items-center gap-2">
            <Home className="w-5 h-5" /> Home
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GameOverDialog;
