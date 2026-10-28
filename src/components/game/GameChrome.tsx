import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Maximize, Minimize, Volume2, VolumeX, Home } from 'lucide-react';
import { useFullscreen } from '@/hooks/useFullscreen';
import { setSoundEnabled, useSoundSettings } from '@/hooks/useSoundEffects';
import { TURN_TIME_LIMIT } from '@/game/constants';
import { playerColor } from './MoveFeedback';
import lettusIcon from '@/assets/lettus-icon.webp';

/** Number that counts smoothly to its new value */
export const AnimatedNumber = ({ value, className }: { value: number; className?: string }) => {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, v => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={className}>{rounded}</motion.span>;
};

/** Player name + score pill that bounces when the score changes */
export const ScorePill = ({ name, score, player, active, extra }: {
  name: string; score: number; player: number; active: boolean; extra?: React.ReactNode;
}) => {
  const prev = useRef(score);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (score !== prev.current) setBump(b => b + 1);
    prev.current = score;
  }, [score]);

  return (
    <motion.div
      key={bump}
      animate={bump ? { scale: [1, 1.18, 1] } : undefined}
      transition={{ duration: 0.4 }}
      className={`flex items-center gap-2 rounded-full px-3 py-1 glass transition-all ${active ? '' : 'opacity-75'}`}
      style={{ boxShadow: active ? `0 0 0 2px ${playerColor(player, 0.8)}, 0 0 18px ${playerColor(player, 0.35)}` : undefined }}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: playerColor(player) }} />
      <span className="text-xs sm:text-sm font-bold truncate max-w-[7rem]">{name}</span>
      <AnimatedNumber value={score} className="font-display font-bold text-lg sm:text-xl tabular-nums" />
      {extra}
    </motion.div>
  );
};

export const TurnTimer = ({ remaining, limit = TURN_TIME_LIMIT, label }: { remaining: number; limit?: number; label?: string }) => {
  const pct = Math.max(0, Math.min(1, remaining / limit));
  const danger = remaining <= 5;
  const warn = remaining <= 10;
  const color = danger ? 'hsl(var(--destructive))' : warn ? 'hsl(var(--gold))' : 'hsl(var(--primary))';
  const R = 20;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative flex items-center">
      <motion.div
        className="relative w-12 h-12 sm:w-14 sm:h-14"
        animate={danger ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={danger ? { duration: 0.5, repeat: Infinity } : undefined}
      >
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle cx="24" cy="24" r={R} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="5" />
          <circle
            cx="24" cy="24" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-lg sm:text-xl tabular-nums" style={{ color }}>
          {remaining}
        </span>
      </motion.div>
      {/* Hangs off the right so the ring itself stays centred */}
      {label && <span className="absolute left-full ml-2 whitespace-nowrap text-xs sm:text-sm font-semibold text-muted-foreground hidden sm:inline">{label}</span>}
    </div>
  );
};

export const IconButton = ({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full glass flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
  >
    {children}
  </button>
);

export const SoundToggle = () => {
  const { sound } = useSoundSettings();
  return (
    <IconButton onClick={() => setSoundEnabled(!sound)} label={sound ? 'Mute sounds' : 'Unmute sounds'}>
      {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
    </IconButton>
  );
};

/** Top bar used by every game mode */
export const GameHeader = ({ title, onHome, center }: { title: string; onHome: () => void; center: React.ReactNode }) => {
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1 sm:px-2 mb-1 sm:mb-2 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onHome}
          aria-label="Back to menu"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl hover:scale-110 active:scale-95 transition-transform shrink-0 relative group"
        >
          <img src={lettusIcon} alt="" className="w-full h-full object-contain drop-shadow-lg" />
          <Home className="w-3.5 h-3.5 absolute -bottom-0.5 -right-0.5 text-cream bg-background/80 rounded-full p-0.5" />
        </button>
        <h1 className="font-display font-semibold text-sm sm:text-base truncate hidden xs:block sm:block">{title}</h1>
      </div>
      <div className="flex justify-center min-w-0">{center}</div>
      <div className="flex items-center justify-end gap-1.5">
        <SoundToggle />
        <IconButton onClick={toggleFullscreen} label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </IconButton>
      </div>
    </div>
  );
};
