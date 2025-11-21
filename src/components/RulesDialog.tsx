import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, Grid3x3, Zap, Trophy } from 'lucide-react';

export const RulesDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenRules = localStorage.getItem('lettus-has-seen-rules');
    if (!hasSeenRules) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('lettus-has-seen-rules', 'true');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-primary bg-clip-text text-transparent">
            Welcome to Lettus!
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Master the ultimate word-building duel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* How to Play */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Grid3x3 className="w-5 h-5 text-primary" />
              How to Play
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Place letters on your 5×5 grid to form words</li>
              <li>• Letters must connect to existing letters (adjacent horizontally or vertically)</li>
              <li>• Words are scored automatically as you build them</li>
              <li>• Longer words earn more points!</li>
            </ul>
          </div>

          {/* Turn Timer */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Turn Timer (Online Only)
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• You have 30 seconds to make your move</li>
              <li>• If time runs out, you lose 5 points and your turn is skipped</li>
              <li>• Scores can go negative from time penalties</li>
            </ul>
          </div>

          {/* Letter Cooldowns */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Letter Cooldowns
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• After using a letter, it goes on cooldown for 4 turns</li>
              <li>• Cooldown counts down each turn for all players</li>
              <li>• Plan ahead and manage your letter choices wisely</li>
            </ul>
          </div>

          {/* Winning */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Winning the Game
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• The game ends when all grids are completely filled</li>
              <li>• The player with the highest score wins</li>
              <li>• Strategic letter placement is key to victory!</li>
            </ul>
          </div>
        </div>

        <Button onClick={handleClose} className="w-full font-bold" size="lg">
          Let's Play!
        </Button>
      </DialogContent>
    </Dialog>
  );
};
