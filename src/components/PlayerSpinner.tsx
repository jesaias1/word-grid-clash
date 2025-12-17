import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerSpinnerProps {
  playerCount: number;
  onComplete: (selectedPlayer: number) => void;
  playerNames?: string[];
}

const PLAYER_COLORS = [
  'hsl(95, 65%, 55%)',   // Player 1 - lime
  'hsl(30, 90%, 55%)',   // Player 2 - orange
  'hsl(210, 90%, 60%)',  // Player 3 - blue
  'hsl(280, 90%, 70%)',  // Player 4 - purple
  'hsl(0, 90%, 65%)',    // Player 5 - red
];

const PlayerSpinner = ({ playerCount, onComplete, playerNames }: PlayerSpinnerProps) => {
  const [spinning, setSpinning] = useState(true);
  const [currentHighlight, setCurrentHighlight] = useState(1);
  const [finalPlayer, setFinalPlayer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);
  
  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (hasCompletedRef.current) return;
    
    // Randomly select final player at the start
    const selected = Math.floor(Math.random() * playerCount) + 1;
    
    // Calculate how many steps we need to reach the selected player with a nice slowdown
    // We want to cycle through all players multiple times, then land on selected
    const minFullCycles = 2; // At least 2 full rotations
    const extraSteps = Math.floor(Math.random() * playerCount); // Random extra steps
    const totalSteps = (minFullCycles * playerCount) + extraSteps;
    
    // Calculate final landing position - we need to end on selected
    // Start from 1, and we need to land on selected after totalSteps
    // Adjust totalSteps so we land exactly on selected
    const stepsToSelected = ((selected - 1) % playerCount);
    const adjustedTotalSteps = totalSteps - (totalSteps % playerCount) + stepsToSelected;
    const finalTotalSteps = adjustedTotalSteps < totalSteps ? adjustedTotalSteps + playerCount : adjustedTotalSteps;
    
    let step = 0;
    let currentPos = 1;
    
    const getInterval = (currentStep: number, total: number) => {
      const progress = currentStep / total;
      // Smooth slowdown curve
      if (progress < 0.4) return 80;      // Fast
      if (progress < 0.6) return 120;     // Medium
      if (progress < 0.75) return 200;    // Slower
      if (progress < 0.85) return 350;    // Much slower
      if (progress < 0.92) return 500;    // Very slow
      return 700;                         // Crawling to final selection
    };
    
    const spin = () => {
      step++;
      currentPos = ((currentPos) % playerCount) + 1;
      setCurrentHighlight(currentPos);
      
      if (step >= finalTotalSteps) {
        // We've landed on the selected player
        setFinalPlayer(selected);
        setSpinning(false);
        hasCompletedRef.current = true;
        
        setTimeout(() => {
          setShowResult(true);
          setTimeout(() => {
            onCompleteRef.current(selected);
          }, 1500);
        }, 600);
        return;
      }
      
      const nextInterval = getInterval(step, finalTotalSteps);
      setTimeout(spin, nextInterval);
    };
    
    // Start spinning
    setTimeout(spin, 80);
  }, [playerCount]);

  const getPlayerName = useCallback((index: number) => {
    if (playerNames && playerNames[index - 1]) {
      return playerNames[index - 1];
    }
    return `Player ${index}`;
  }, [playerNames]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <div className="text-center space-y-6 p-8">
        <motion.h2 
          className="text-2xl md:text-3xl font-bold text-foreground"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
        >
          {showResult ? 'Starting Player' : 'Selecting First Player...'}
        </motion.h2>
        
        {/* Spinning Wheel */}
        <div className="relative flex justify-center items-center py-8">
          <div className="flex gap-3 md:gap-4">
            {Array.from({ length: playerCount }, (_, i) => i + 1).map((player) => {
              const isHighlighted = currentHighlight === player;
              const isSelected = finalPlayer === player && !spinning;
              
              return (
                <motion.div
                  key={player}
                  animate={{
                    scale: isHighlighted ? 1.25 : 1,
                    opacity: isSelected ? 1 : isHighlighted ? 1 : 0.4,
                  }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={`
                    relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center
                    font-bold text-lg md:text-xl
                    ${isSelected ? 'ring-4 ring-white shadow-2xl' : ''}
                  `}
                  style={{ 
                    backgroundColor: PLAYER_COLORS[player - 1],
                    boxShadow: isHighlighted ? `0 0 40px ${PLAYER_COLORS[player - 1]}` : 'none'
                  }}
                >
                  <span className="text-white drop-shadow-lg">P{player}</span>
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2"
                    >
                      <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white" 
                        style={{ transform: 'rotate(180deg)' }}
                      />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
        
        {/* Result announcement */}
        <AnimatePresence>
          {showResult && finalPlayer && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="space-y-2"
            >
              <p className="text-lg text-muted-foreground">First turn goes to:</p>
              <p 
                className="text-3xl md:text-4xl font-bold"
                style={{ color: PLAYER_COLORS[finalPlayer - 1] }}
              >
                {getPlayerName(finalPlayer)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Spinning indicator */}
        {spinning && (
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ y: [-3, 3, -3] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PlayerSpinner;
