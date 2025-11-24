import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Welcome to Lettus!",
      description: "Lettus is a strategic word-building game where you compete against opponents to create the highest-scoring words on the grid. Let's learn the basics!",
      icon: <Trophy className="w-12 h-12 text-primary" />
    },
    {
      title: "The Game Board",
      description: "The game is played on a 5x5 grid (or larger). Both you and your opponent will start with 5 random letters already placed on the board.",
      icon: <Target className="w-12 h-12 text-primary" />
    },
    {
      title: "Placing Letters",
      description: "Select a letter from the available pool below and click on an empty cell to place it. New letters must be placed adjacent to existing letters to form or extend words.",
      icon: <Zap className="w-12 h-12 text-primary" />,
      interactive: true
    },
    {
      title: "Scoring Words",
      description: "Points are awarded for ALL valid words found on the board (horizontal and vertical). Longer words score more points! Each letter in a word = 1 point.",
      icon: <Trophy className="w-12 h-12 text-primary" />
    },
    {
      title: "Letter Cooldowns",
      description: "After using a letter, it goes on cooldown for several turns. You can't use that letter again until the cooldown expires. Plan your moves strategically!",
      icon: <Clock className="w-12 h-12 text-primary" />
    },
    {
      title: "Turn Timer",
      description: "You have 30 seconds per turn. If time runs out, your turn is skipped and you lose 5 points. Stay focused and play quickly!",
      icon: <Clock className="w-12 h-12 text-primary" />
    },
    {
      title: "Ready to Play!",
      description: "You now know the basics! Start with local games to practice, then challenge friends in online multiplayer. Good luck!",
      icon: <Trophy className="w-12 h-12 text-primary" />
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
    onComplete();
  };

  const handleTutorialCellClick = (row: number, col: number) => {
    if (currentStep !== 2 || !selectedLetter || tutorialGrid[row][col] !== null) return;

    // Check if adjacent to existing letter
    const hasAdjacent = 
      (row > 0 && tutorialGrid[row - 1][col] !== null) ||
      (row < 4 && tutorialGrid[row + 1][col] !== null) ||
      (col > 0 && tutorialGrid[row][col - 1] !== null) ||
      (col < 4 && tutorialGrid[row][col + 1] !== null);

    if (!hasAdjacent) return;

    const newGrid = tutorialGrid.map(r => [...r]);
    newGrid[row][col] = selectedLetter;
    setTutorialGrid(newGrid);
    setPlacedLetters(new Set([...placedLetters, selectedLetter]));
    setSelectedLetter('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              Tutorial - Step {currentStep + 1} of {tutorialSteps.length}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleComplete}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
            />
          </div>

          {/* Step Content */}
          <Card className="p-6 border-2">
            <div className="flex flex-col items-center text-center space-y-4">
              {tutorialSteps[currentStep].icon}
              <h3 className="text-xl font-bold">{tutorialSteps[currentStep].title}</h3>
              <p className="text-muted-foreground max-w-xl">
                {tutorialSteps[currentStep].description}
              </p>
            </div>
          </Card>

          {/* Interactive Demo for Step 3 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="inline-grid gap-1 p-3 rounded-xl border-2 bg-card shadow-lg" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {tutorialGrid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const isLightSquare = (rowIndex + colIndex) % 2 === 0;
                      const canPlace = selectedLetter && !cell;
                      
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`
                            w-12 h-12 cursor-pointer flex items-center justify-center transition-all duration-300 border border-border/40 rounded-lg
                            ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                            ${cell ? 'bg-gradient-to-br from-primary to-primary/70' : ''}
                            ${canPlace ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                          `}
                          onClick={() => handleTutorialCellClick(rowIndex, colIndex)}
                        >
                          {cell && (
                            <span className="font-bold text-lg text-white drop-shadow-lg">
                              {cell}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-card/90 border rounded-lg p-3">
                <div className="text-center mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Click a letter, then click an adjacent empty cell</span>
                </div>
                <div className="flex gap-2 justify-center">
                  {availableTutorialLetters.map(letter => {
                    const isPlaced = placedLetters.has(letter);
                    const isSelected = selectedLetter === letter;
                    return (
                      <button
                        key={letter}
                        onClick={() => !isPlaced && setSelectedLetter(letter)}
                        disabled={isPlaced}
                        className={`
                          w-12 h-12 rounded-lg font-bold text-lg transition-all duration-200
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

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleComplete}>
              Skip Tutorial
            </Button>
            <Button onClick={handleNext}>
              {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialMode;
