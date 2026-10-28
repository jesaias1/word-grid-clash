import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { comboLabel, type ScoredWord } from '@/game/moveAnalysis';

export type FeedbackEvent = {
  id: number;
  who: string;
  player: number;
  words: ScoredWord[];
  gained: number;
  mine: boolean;
};

const PLAYER_HSL = ['92 58% 52%', '30 92% 56%', '205 85% 58%', '280 70% 66%', '350 80% 64%'];
export const playerColor = (player: number, alpha = 1) => `hsl(${PLAYER_HSL[(player - 1) % PLAYER_HSL.length]} / ${alpha})`;

/** Queue of score popups shown over the boards */
export function useMoveFeedback() {
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  const nextId = useRef(1);

  const push = useCallback((e: Omit<FeedbackEvent, 'id'>) => {
    if (e.words.length === 0) return;
    const id = nextId.current++;
    setEvents(prev => [...prev.slice(-2), { ...e, id }]);
    const ttl = 1700 + Math.min(4, e.words.length) * 250;
    setTimeout(() => setEvents(prev => prev.filter(x => x.id !== id)), ttl);

    // A burst of leaves for big moves by the local player
    if (e.mine && (e.words.length >= 3 || e.gained >= 10)) {
      confetti({
        particleCount: 40 + e.words.length * 15,
        spread: 70,
        startVelocity: 35,
        origin: { y: 0.45 },
        colors: ['#8fd14f', '#5fae3a', '#2f7a4c', '#fff6e0', '#f6c445'],
        scalar: 0.9,
        zIndex: 60,
      });
    }
  }, []);

  return { events, push };
}

export const MoveFeedbackLayer = ({ events }: { events: FeedbackEvent[] }) => (
  <div className="pointer-events-none fixed inset-x-0 top-[18%] z-40 flex flex-col items-center gap-2">
    <AnimatePresence>
      {events.map(e => {
        const combo = comboLabel(e.words.length);
        const color = playerColor(e.player);
        return (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, y: 30, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="flex flex-col items-center gap-1.5"
          >
            {combo && (
              <motion.div
                initial={{ scale: 0.3, rotate: -8 }}
                animate={{ scale: [0.3, 1.25, 1], rotate: [-8, 4, 0] }}
                transition={{ duration: 0.55 }}
                className="font-display font-bold text-3xl sm:text-4xl tracking-wide drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]"
                style={{ color: e.mine ? 'hsl(var(--gold))' : color }}
              >
                {combo}
              </motion.div>
            )}
            <div
              className="glass rounded-2xl px-3 py-2 flex flex-wrap items-center justify-center gap-1.5 max-w-[92vw] shadow-lg"
              style={{ boxShadow: `0 0 0 2px ${playerColor(e.player, 0.5)}, 0 10px 30px rgba(0,0,0,0.45)` }}
            >
              <span className="text-xs font-bold uppercase tracking-wider opacity-80" style={{ color }}>
                {e.who}
              </span>
              {e.words.slice(0, 6).map((w, i) => (
                <motion.span
                  key={`${w.text}-${i}`}
                  initial={{ opacity: 0, scale: 0.5, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.08, type: 'spring', stiffness: 500, damping: 20 }}
                  className="font-display font-semibold text-sm sm:text-base px-2 py-0.5 rounded-lg text-cream"
                  style={{ background: playerColor(e.player, 0.35) }}
                >
                  {w.text}
                  <span className="ml-1 text-gold">+{w.points}</span>
                </motion.span>
              ))}
              {e.words.length > 6 && <span className="text-xs opacity-70">+{e.words.length - 6} more</span>}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.4, 1] }}
                transition={{ delay: 0.15 + Math.min(6, e.words.length) * 0.08, duration: 0.4 }}
                className="font-display font-bold text-xl sm:text-2xl text-gold ml-1"
              >
                +{e.gained}
              </motion.span>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);
