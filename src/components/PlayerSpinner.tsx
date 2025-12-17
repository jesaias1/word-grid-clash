import { useState, useEffect } from 'react';
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
  const [currentHighlight, setCurrentHighlight] = useState(0);
  const [finalPlayer, setFinalPlayer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // Randomly select final player
    const selected = Math.floor(Math.random() * playerCount) + 1;
    
    // Spinning animation - cycles through players with decreasing speed
    let interval = 80;
    let cycles = 0;
    const maxCycles = 20 + Math.floor(Math.random() * 10);
    
    const spin = () => {
      setCurrentHighlight(prev => (prev % playerCount) + 1);
      cycles++;
      
      if (cycles >= maxCycles) {
        // Final spin to selected player
        setCurrentHighlight(selected);
        setFinalPlayer(selected);
        setSpinning(false);
        
        setTimeout(() => {
          setShowResult(true);
          setTimeout(() => onComplete(selected), 1500);
        }, 500);
        return;
      }
      
      // Gradually slow down
      interval = Math.min(interval + 15, 300);
      setTimeout(spin, interval);
    };
    
    setTimeout(spin, interval);
  }, [playerCount, onComplete]);

  const getPlayerName = (index: number) => {
    if (playerNames && playerNames[index - 1]) {
      return playerNames[index - 1];
    }
    return `Player ${index}`;
  };

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
                    scale: isHighlighted ? 1.2 : 1,
                    opacity: isSelected ? 1 : isHighlighted ? 1 : 0.5,
                  }}
                  transition={{ duration: 0.1 }}
                  className={`
                    relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center
                    font-bold text-lg md:text-xl transition-all duration-100
                    ${isSelected ? 'ring-4 ring-white shadow-2xl' : ''}
                  `}
                  style={{ 
                    backgroundColor: PLAYER_COLORS[player - 1],
                    boxShadow: isHighlighted ? `0 0 30px ${PLAYER_COLORS[player - 1]}` : 'none'
                  }}
                >
                  <span className="text-white drop-shadow-lg">P{player}</span>
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2"
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
