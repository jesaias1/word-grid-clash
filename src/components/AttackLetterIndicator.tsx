import { useGame } from '@/game/store';
import { Badge } from '@/components/ui/badge';

interface AttackLetterIndicatorProps {
  letter: string;
  className?: string;
}

export function AttackLetterIndicator({ letter, className = "" }: AttackLetterIndicatorProps) {
  const { state } = useGame();
  const isAttackLetter = state.attackLetters.includes(letter.toUpperCase());

  if (!isAttackLetter) {
    return null;
  }

  return (
    <Badge 
      variant="destructive" 
      className={`absolute top-0.5 right-0.5 text-xs font-bold w-4 h-4 p-0 flex items-center justify-center ${className}`}
    >
      ⚡
    </Badge>
  );
}