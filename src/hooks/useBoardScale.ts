import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const STORAGE_KEY = 'lettus-board-scale';
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.8;
const SCALE_STEP = 0.1;

export const useBoardScale = () => {
  const isMobile = useIsMobile();
  const [scale, setScale] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseFloat(stored) : DEFAULT_SCALE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, scale.toString());
  }, [scale]);

  const increaseScale = () => {
    setScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  };

  const decreaseScale = () => {
    setScale(prev => Math.max(prev - SCALE_STEP, MIN_SCALE));
  };

  const resetScale = () => {
    setScale(DEFAULT_SCALE);
  };

  // Only apply scale on desktop, return 1 for mobile
  const effectiveScale = isMobile ? 1 : scale;

  return {
    scale: effectiveScale,
    increaseScale,
    decreaseScale,
    resetScale,
    canIncrease: scale < MAX_SCALE,
    canDecrease: scale > MIN_SCALE,
  };
};
