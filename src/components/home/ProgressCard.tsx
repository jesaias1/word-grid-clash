import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ACHIEVEMENTS, levelInfo, levelTitle, useProgress } from '@/lib/progress';

/** Level, XP bar and quick stats on the home screen, with the achievements list behind it */
const ProgressCard = () => {
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  const { level, current, needed, progress: pct } = levelInfo(progress.xp);
  const s = progress.stats;
  const unlocked = Object.keys(progress.achievements).length;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        className="glass w-full rounded-2xl p-3 text-left flex items-center gap-3"
      >
        <div className="tile tile-leaf w-12 h-12 shrink-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] font-sans font-bold opacity-80">LVL</span>
          <span className="text-xl">{level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display font-semibold truncate">{levelTitle(level)}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{current} / {needed} XP</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-1">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(pct * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
          <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
            <span>🏆 {s.wins} wins</span>
            <span>🔥 {s.winStreak} streak</span>
            <span className="hidden xs:inline sm:inline">⭐ {s.highScore} best</span>
            <span className="ml-auto flex items-center gap-0.5 text-gold font-semibold">
              <Trophy className="w-3 h-3" /> {unlocked}/{ACHIEVEMENTS.length}
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-center">Your Garden</DialogTitle>
            <DialogDescription className="text-center">Level {level} {levelTitle(level)} · {progress.xp} XP total</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Games', s.gamesPlayed],
              ['Wins', s.wins],
              ['Best streak', s.bestWinStreak],
              ['High score', s.highScore],
              ['Best move', s.bestMove],
              ['Words found', s.totalWords],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-white/5 p-2">
                <div className="font-display font-bold text-xl tabular-nums">{value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          {s.longestWord && (
            <div className="text-center text-sm text-muted-foreground">
              Longest word: <span className="font-display font-semibold text-foreground">{s.longestWord}</span>
              {s.bestCombo > 1 && <> · Best combo: <span className="font-semibold text-foreground">{s.bestCombo} words</span></>}
            </div>
          )}

          <div className="font-display font-semibold mt-1">Achievements <span className="text-muted-foreground text-sm">{unlocked}/{ACHIEVEMENTS.length}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {ACHIEVEMENTS.map(a => {
              const got = !!progress.achievements[a.id];
              return (
                <div key={a.id} className={`flex items-center gap-2 rounded-xl p-2 ${got ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-white/[0.03] opacity-55'}`}>
                  <span className={`text-2xl ${got ? '' : 'grayscale'}`}>{a.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{a.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProgressCard;
