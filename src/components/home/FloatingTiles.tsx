import { useMemo } from 'react';
import { motion } from 'framer-motion';

const LETTERS = 'LETTUSWORDGRID'.split('');
const COLORS = ['tile-p1', 'tile-leaf', 'tile-p1', 'tile-p1', 'tile-leaf'];

/** Slowly drifting letter tiles behind the menu */
const FloatingTiles = ({ count = 14 }: { count?: number }) => {
  const tiles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    letter: LETTERS[i % LETTERS.length],
    color: COLORS[i % COLORS.length],
    left: (i * 61) % 100,
    size: 28 + ((i * 37) % 34),
    delay: (i * 1.7) % 12,
    duration: 18 + ((i * 7) % 14),
    rotate: ((i * 47) % 50) - 25,
  })), [count]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0" aria-hidden>
      {tiles.map((t, i) => (
        <motion.div
          key={i}
          className={`tile ${t.color} absolute flex items-center justify-center opacity-[0.13]`}
          style={{ left: `${t.left}%`, width: t.size, height: t.size, fontSize: t.size * 0.55, bottom: -80 }}
          initial={{ y: 0, rotate: t.rotate }}
          animate={{ y: '-120vh', rotate: t.rotate + 90 }}
          transition={{ duration: t.duration, delay: t.delay, repeat: Infinity, ease: 'linear' }}
        >
          {t.letter}
        </motion.div>
      ))}
    </div>
  );
};

export default FloatingTiles;
