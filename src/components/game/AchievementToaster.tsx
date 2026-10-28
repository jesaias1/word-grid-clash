import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { onAchievements, type Achievement } from '@/lib/progress';
import { useSoundEffects } from '@/hooks/useSoundEffects';

type Shown = Achievement & { key: number };

/** Slides in a card whenever an achievement unlocks, anywhere in the app */
const AchievementToaster = () => {
  const [items, setItems] = useState<Shown[]>([]);
  const { playFeedback } = useSoundEffects();

  useEffect(() => onAchievements(list => {
    playFeedback('achievement');
    list.forEach((a, i) => {
      const key = Date.now() + i;
      setTimeout(() => {
        setItems(prev => [...prev, { ...a, key }]);
        setTimeout(() => setItems(prev => prev.filter(x => x.key !== key)), 3800);
      }, i * 600);
    });
  }), [playFeedback]);

  return (
    <div className="fixed top-3 inset-x-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-3" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <AnimatePresence>
        {items.map(a => (
          <motion.div
            key={a.key}
            initial={{ y: -80, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className="glass relative overflow-hidden shimmer rounded-2xl pl-3 pr-5 py-2.5 flex items-center gap-3 shadow-lg ring-1 ring-gold/50"
          >
            <motion.span
              className="text-3xl"
              animate={{ rotate: [0, -15, 15, -8, 0], scale: [1, 1.3, 1] }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {a.icon}
            </motion.span>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold font-bold">Achievement unlocked</div>
              <div className="font-display font-semibold">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.description}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AchievementToaster;
