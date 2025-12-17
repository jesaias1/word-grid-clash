import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { Tier } from '@/hooks/useDailyChallenge';
import { Circle, Medal, Trophy, Gem } from 'lucide-react';

interface TierBadgeProps {
  currentTier: Tier;
  score: number;
  targets: {
    bronze: number;
    silver: number;
    gold: number;
  };
}

const TierBadge = ({ currentTier, score, targets }: TierBadgeProps) => {
  const { playFeedback } = useSoundEffects(true, true);
  const [previousTier, setPreviousTier] = useState<Tier>('none');
  const [showAnimation, setShowAnimation] = useState(false);
  const hasAnimatedRef = useRef<Set<Tier>>(new Set());

  const diamondTarget = targets.gold + 20;

  useEffect(() => {
    // Only animate if we've moved up a tier and haven't animated this tier yet
    if (currentTier !== 'none' && currentTier !== previousTier && !hasAnimatedRef.current.has(currentTier)) {
      hasAnimatedRef.current.add(currentTier);
      setShowAnimation(true);
      
      // Play sound effect - bigger sound for diamond
      if (currentTier === 'diamond') {
        playFeedback('gameEnd');
      } else {
        playFeedback('score');
      }
      
      // Hide animation after delay
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, currentTier === 'diamond' ? 2000 : 1000);
      
      return () => clearTimeout(timer);
    }
    
    setPreviousTier(currentTier);
  }, [currentTier, previousTier, playFeedback]);

  const getTierConfig = (tier: Tier) => {
    switch (tier) {
      case 'diamond':
        return {
          icon: Gem,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-400/20',
          borderColor: 'border-cyan-400/50',
          glowColor: 'shadow-cyan-400/50',
          label: 'DIAMOND',
          emoji: '💎',
        };
      case 'gold':
        return {
          icon: Trophy,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400/20',
          borderColor: 'border-yellow-400/50',
          glowColor: 'shadow-yellow-400/50',
          label: 'GOLD',
          emoji: '🥇',
        };
      case 'silver':
        return {
          icon: Medal,
          color: 'text-gray-300',
          bgColor: 'bg-gray-300/20',
          borderColor: 'border-gray-300/50',
          glowColor: 'shadow-gray-300/50',
          label: 'SILVER',
          emoji: '🥈',
        };
      case 'bronze':
        return {
          icon: Medal,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/20',
          borderColor: 'border-orange-500/50',
          glowColor: 'shadow-orange-500/50',
          label: 'BRONZE',
          emoji: '🥉',
        };
      default:
        return {
          icon: Circle,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/30',
          borderColor: 'border-muted-foreground/30',
          glowColor: '',
          label: 'NO RANK',
          emoji: '○',
        };
    }
  };

  const config = getTierConfig(currentTier);
  const Icon = config.icon;

  // Get next tier info for progress display
  const getNextTarget = () => {
    if (currentTier === 'none') return targets.bronze;
    if (currentTier === 'bronze') return targets.silver;
    if (currentTier === 'silver') return targets.gold;
    if (currentTier === 'gold') return diamondTarget;
    return null;
  };

  const nextTarget = getNextTarget();

  return (
    <div className="relative flex flex-col items-center">
      {/* Main Badge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTier}
          initial={showAnimation ? { scale: 0, rotate: -180 } : { scale: 1, rotate: 0 }}
          animate={{ 
            scale: showAnimation && currentTier === 'diamond' ? [0, 1.5, 1] : showAnimation ? [0, 1.3, 1] : 1, 
            rotate: 0 
          }}
          exit={{ scale: 0, rotate: 180 }}
          transition={{ 
            duration: currentTier === 'diamond' ? 0.8 : 0.5, 
            ease: "easeOut",
            times: currentTier === 'diamond' ? [0, 0.5, 1] : [0, 0.6, 1]
          }}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full border-2
            ${config.bgColor} ${config.borderColor}
            ${showAnimation && currentTier === 'diamond' ? `shadow-lg ${config.glowColor}` : ''}
          `}
        >
          <span className="text-xl">{config.emoji}</span>
          <span className={`font-bold text-sm ${config.color}`}>{config.label}</span>
        </motion.div>
      </AnimatePresence>

      {/* Diamond Celebration Effect */}
      {showAnimation && currentTier === 'diamond' && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 3] }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="text-6xl">💎✨</div>
        </motion.div>
      )}

      {/* Sparkle Effects for tier ups */}
      {showAnimation && currentTier !== 'none' && (
        <>
          {[...Array(currentTier === 'diamond' ? 12 : 6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
              animate={{ 
                opacity: 0, 
                scale: 1,
                x: Math.cos((i * 360) / (currentTier === 'diamond' ? 12 : 6) * Math.PI / 180) * (currentTier === 'diamond' ? 80 : 50),
                y: Math.sin((i * 360) / (currentTier === 'diamond' ? 12 : 6) * Math.PI / 180) * (currentTier === 'diamond' ? 80 : 50),
              }}
              transition={{ duration: currentTier === 'diamond' ? 1 : 0.6, delay: i * 0.05 }}
              className={`absolute text-lg ${config.color}`}
            >
              ✦
            </motion.div>
          ))}
        </>
      )}

      {/* Next Target Indicator */}
      {nextTarget && (
        <div className="text-[10px] text-muted-foreground mt-1">
          Next: {nextTarget} pts
        </div>
      )}
    </div>
  );
};

export default TierBadge;
