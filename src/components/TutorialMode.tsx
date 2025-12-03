import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowRight, ArrowLeft, X, Target, Zap, Trophy, Clock } from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  interactive?: boolean;
}

interface TutorialModeProps {
  onComplete: () => void;
}

const TutorialMode = ({ onComplete }: TutorialModeProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [tutorialGrid, setTutorialGrid] = useState<(string | null)[][]>([
    [null, 'E', null, null, null],
    [null, null, 'A', null, null],
    [null, null, null, 'T', null],
    [null, null, null, null, 'S'],
    ['R', null, null, null, null],
  ]);
  const [selectedLetter, setSelectedLetter] = useState<string>('');
  const [placedLetters, setPlacedLetters] = useState<Set<string>>(new Set());

  // Check if tutorial was already completed
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (hasSeenTutorial === 'true') {
      setIsOpen(false);
      onComplete();
    }
  }, []);

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Welcome to Lettus!",
      description: "Lettus is a strategic word-building game where you compete against opponents to create the highest-scoring words on the grid. Let's learn the basics!",
      icon: <Trophy className="w-10 h-10 text-primary" />
    },
    {
      title: "The Game Board",
      description: "The game is played on a 5x5 grid. Both you and your opponent start with 5 random letters already placed on the board.",
      icon: <Target className="w-10 h-10 text-primary" />
    },
    {
      title: "Placing Letters",
      description: "Select a letter from the available pool and click any empty cell to place it. Try to form words horizontally or vertically!",
      icon: <Zap className="w-10 h-10 text-primary" />,
      interactive: true
    },
    {
      title: "Scoring Words",
      description: "Points are awarded for ALL valid words on the board (horizontal and vertical). Longer words = more points! Each letter = 1 point.",
      icon: <Trophy className="w-10 h-10 text-primary" />
    },
    {
      title: "Letter Cooldowns",
      description: "After using a letter, it goes on cooldown for 4 turns. Plan strategically!",
      icon: <Clock className="w-10 h-10 text-primary" />
    },
    {
      title: "Turn Timer",
      description: "You have 30 seconds per turn. If time runs out, you lose 5 points!",
      icon: <Clock className="w-10 h-10 text-primary" />
    },
    {
      title: "Ready to Play!",
      description: "Start with solo games to practice, then challenge friends online. Good luck!",
      icon: <Trophy className="w-10 h-10 text-primary" />
    }
  ];

  const availableTutorialLetters = ['C', 'H', 'O', 'N'];

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenTutorial', 'true');
    onComplete();
  };

  const handleTutorialCellClick = (row: number, col: number) => {
    if (currentStep !== 2 || !selectedLetter || tutorialGrid[row][col] !== null) return;

    // Allow placing anywhere (no adjacency requirement)
    const newGrid = tutorialGrid.map(r => [...r]);
    newGrid[row][col] = selectedLetter;
    setTutorialGrid(newGrid);
    setPlacedLetters(new Set([...placedLetters, selectedLetter]));
    setSelectedLetter('');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              Tutorial - Step {currentStep + 1} of {tutorialSteps.length}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleComplete}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
            />
          </div>

          {/* Step Content */}
          <Card className="p-4 border-2">
            <div className="flex flex-col items-center text-center space-y-3">
              {tutorialSteps[currentStep].icon}
              <h3 className="text-lg font-bold">{tutorialSteps[currentStep].title}</h3>
              <p className="text-sm text-muted-foreground">
                {tutorialSteps[currentStep].description}
              </p>
            </div>
          </Card>

          {/* Interactive Demo for Step 3 */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="inline-grid gap-0.5 p-2 rounded-lg border-2 bg-card shadow-lg" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {tutorialGrid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const isLightSquare = (rowIndex + colIndex) % 2 === 0;
                      const canPlace = selectedLetter && !cell;
                      
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`
                            w-8 h-8 sm:w-9 sm:h-9 cursor-pointer flex items-center justify-center transition-all duration-200 border border-border/40 rounded
                            ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                            ${cell ? 'bg-gradient-to-br from-primary to-primary/70' : ''}
                            ${canPlace ? 'hover:scale-105 hover:bg-accent/20' : ''}
                          `}
                          onClick={() => handleTutorialCellClick(rowIndex, colIndex)}
                        >
                          {cell && (
                            <span className="font-bold text-sm text-white drop-shadow">
                              {cell}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-card/90 border rounded-lg p-2">
                <div className="text-center mb-2">
                  <span className="text-xs text-muted-foreground">Click a letter, then click any empty cell</span>
                </div>
                <div className="flex gap-1.5 justify-center">
                  {availableTutorialLetters.map(letter => {
                    const isPlaced = placedLetters.has(letter);
                    const isSelected = selectedLetter === letter;
                    return (
                      <button
                        key={letter}
                        onClick={() => !isPlaced && setSelectedLetter(letter)}
                        disabled={isPlaced}
                        className={`
                          w-9 h-9 rounded-lg font-bold text-sm transition-all duration-200
                          ${isSelected ? 'bg-primary text-primary-foreground scale-110 shadow-lg' : ''}
                          ${isPlaced ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed' : 
                            'bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-105 border border-border'}
                        `}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleComplete}>
              Skip Tutorial
            </Button>
            <Button size="sm" onClick={handleNext}>
              {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialMode;
