import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBoardScale } from '@/hooks/useBoardScale';
import { useIsMobile } from '@/hooks/use-mobile';

interface BoardScaleControlProps {
  scale: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
}

export const BoardScaleControl = ({
  scale,
  onIncrease,
  onDecrease,
  onReset,
  canIncrease,
  canDecrease,
}: BoardScaleControlProps) => {
  const isMobile = useIsMobile();

  // Only show on desktop
  if (isMobile) return null;

  return (
    <div className="hidden md:flex items-center gap-1 bg-card/80 rounded-lg px-2 py-1 border border-border/40">
      <span className="text-xs text-muted-foreground mr-1">Size</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onDecrease}
        disabled={!canDecrease}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="text-xs font-medium w-10 text-center">
        {Math.round(scale * 100)}%
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onIncrease}
        disabled={!canIncrease}
      >
        <Plus className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onReset}
        title="Reset to 100%"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  );
};
