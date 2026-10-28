import { memo } from 'react';
import { motion } from 'framer-motion';
import { ALPHABET, BONUS_LETTERS, COOLDOWN_TURNS } from '@/game/constants';
import { useIsMobile } from '@/hooks/use-mobile';

interface LetterKeyboardProps {
  cooldowns: Record<string, number>;
  selected: string | null;
  enabled: boolean;
  onSelect: (letter: string) => void;
  /** Restrict to these letters (others shown as unavailable) */
  allowed?: string[];
  cooldownTurns?: number;
}

const DESKTOP_ROWS = [ALPHABET.slice(0, 13), ALPHABET.slice(13)];
const MOBILE_ROWS = [ALPHABET.slice(0, 9), ALPHABET.slice(9, 18), ALPHABET.slice(18)];

const LetterKeyboard = ({ cooldowns, selected, enabled, onSelect, allowed, cooldownTurns = COOLDOWN_TURNS }: LetterKeyboardProps) => {
  const isMobile = useIsMobile();
  const rows = isMobile ? MOBILE_ROWS : DESKTOP_ROWS;
  const keySize = isMobile ? 'min(9.6vw, 44px)' : 'clamp(30px, 3.4vw, 46px)';

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5"
      initial={false}
      animate={{ opacity: enabled ? 1 : 0.6, y: enabled ? 0 : 3, scale: enabled ? 1 : 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
    >
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1 sm:gap-1.5 justify-center">
          {row.map(letter => {
            const cooldown = cooldowns[letter] || 0;
            const blocked = cooldown > 0 || (allowed ? !allowed.includes(letter) : false);
            const canSelect = enabled && !blocked;
            const isSelected = selected === letter && canSelect;
            const bonus = BONUS_LETTERS.has(letter);
            const fill = cooldown > 0 ? (cooldown / cooldownTurns) * 100 : 0;

            return (
              <motion.button
                key={letter}
                type="button"
                disabled={!canSelect}
                onClick={() => canSelect && onSelect(letter)}
                whileTap={canSelect ? { scale: 0.88 } : undefined}
                whileHover={canSelect && !isSelected ? { y: -2 } : undefined}
                animate={{ y: isSelected ? -5 : 0, scale: isSelected ? 1.12 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                aria-label={cooldown > 0 ? `${letter}, cooling down for ${cooldown} turns` : letter}
                aria-pressed={isSelected}
                className={`relative rounded-[22%] font-display font-semibold flex items-center justify-center overflow-hidden ${
                  isSelected
                    ? 'tile tile-gold text-amber-950 [text-shadow:none] z-10'
                    : blocked
                      ? 'bg-muted/40 text-muted-foreground/60 cursor-not-allowed'
                      : `tile ${bonus ? 'tile-leaf' : 'tile-p1'} ${canSelect ? 'cursor-pointer hover:brightness-110' : 'cursor-not-allowed'}`
                }`}
                style={{ width: keySize, height: keySize, fontSize: `calc(${keySize} * 0.5)` }}
              >
                {/* Cooldown drains from top to bottom as turns pass */}
                {cooldown > 0 && (
                  <motion.span
                    className="absolute inset-x-0 bottom-0 bg-destructive/25"
                    initial={false}
                    animate={{ height: `${fill}%` }}
                    transition={{ duration: 0.4 }}
                  />
                )}
                <span className="relative">{letter}</span>
                {bonus && !blocked && !isSelected && (
                  <span className="absolute bottom-[6%] right-[10%] text-[0.42em] leading-none text-cream/90">×2</span>
                )}
                {cooldown > 0 && (
                  <span
                    className={`absolute top-[4%] right-[6%] text-[0.42em] leading-none font-bold ${
                      cooldown === 1 ? 'text-gold' : 'text-destructive'
                    }`}
                  >
                    {cooldown}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      ))}
    </motion.div>
  );
};

export default memo(LetterKeyboard);
