import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import lettusLogo from '@/assets/lettus-logo.webp';

const LETTERS = [
  { ch: 'L', leaf: false },
  { ch: 'E', leaf: false },
  { ch: 'T', leaf: true },
  { ch: 'T', leaf: false },
  { ch: 'U', leaf: false },
  { ch: 'S', leaf: true },
];

const SEEN_KEY = 'lettus_splash_seen';

/** Tiles drop in and spell LETTUS, then the real logo takes over and the menu fades in. Once per browser session. */
const SplashScreen = () => {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem(SEEN_KEY) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  });
  const [phase, setPhase] = useState<'tiles' | 'logo'>('tiles');

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    const t1 = setTimeout(() => setPhase('logo'), 1150);
    const t2 = setTimeout(() => setShow(false), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [show]);

  const width = 'min(86vw, 520px)';
  const tile = `calc(${width} / 6.9)`;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'radial-gradient(800px 500px at 50% 40%, hsl(95 35% 14%) 0%, hsl(90 8% 7%) 70%)' }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          onClick={() => setShow(false)}
          aria-hidden
        >
          <div className="relative flex items-center justify-center" style={{ width, height: `calc(${tile} * 1.9)` }}>
            {/* Tiles falling into place */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ gap: `calc(${tile} * 0.12)` }}
              animate={{ opacity: phase === 'logo' ? 0 : 1 }}
              transition={{ duration: 0.25 }}
            >
              {LETTERS.map((l, i) => (
                <motion.div
                  key={i}
                  className={`tile ${l.leaf ? 'tile-leaf' : 'tile-p1'} flex items-center justify-center`}
                  style={{ width: tile, height: tile, fontSize: `calc(${tile} * 0.6)` }}
                  initial={{ y: -260, rotate: (i % 2 ? 1 : -1) * 25, opacity: 0 }}
                  animate={{ y: 0, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 17, delay: 0.1 + i * 0.1 }}
                >
                  {l.ch}
                </motion.div>
              ))}
            </motion.div>

            {/* The real logo, with its leaves, pops in over them */}
            <motion.img
              src={lettusLogo}
              alt=""
              className="absolute w-full h-auto drop-shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={phase === 'logo' ? { opacity: 1, scale: [0.92, 1.06, 1] } : { opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            {/* A little sparkle burst when the logo lands */}
            {phase === 'logo' && Array.from({ length: 10 }, (_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{ background: i % 2 ? 'hsl(var(--gold))' : 'hsl(var(--primary))' }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos(angle) * 220, y: Math.sin(angle) * 110, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              );
            })}
          </div>

          <motion.p
            className="mt-6 text-sm text-muted-foreground tracking-wide"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: phase === 'logo' ? 1 : 0, y: phase === 'logo' ? 0 : 8 }}
            transition={{ duration: 0.35 }}
          >
            Grow words. Grab letters. Outscore everyone.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
