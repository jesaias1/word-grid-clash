import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import TutorialMode from '@/components/TutorialMode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import lettusLogo from '@/assets/lettus-logo.png';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { GraduationCap } from 'lucide-react';

type GameMode = 'menu' | 'local' | 'local-multiplayer-2' | 'local-multiplayer-3';

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [showTutorial, setShowTutorial] = useState(false);
  const navigate = useNavigate();
  const { playFeedback } = useSoundEffects(true, true);
  
  const boardSize = 5;
  const cooldownTurns = 4;

  // Check if user has seen tutorial
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleBackToMenu = () => {
    setGameMode('menu');
  };

  // Menu screen
  if (gameMode === 'menu') {
    return (
      <div className="min-h-screen flex items-center justify-center p-2 py-2">
        {showTutorial && (
          <TutorialMode
            onComplete={() => {
              setShowTutorial(false);
              localStorage.setItem('hasSeenTutorial', 'true');
            }}
          />
        )}
        <div className="text-center space-y-1.5 max-w-2xl w-full animate-fade-in-up">
          <div className="flex items-center justify-center mb-4 animate-float">
            <img src={lettusLogo} alt="Lettus Logo" className="max-w-full h-auto w-[380px] sm:w-[480px] object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105" />
          </div>

          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <Button 
              onClick={() => {
                playFeedback('click');
                setGameMode('local');
              }}
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
            >
              Solo Game
            </Button>
            <Button 
              onClick={() => {
                playFeedback('click');
                navigate('/online-setup');
              }}
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              variant="default"
            >
              Online 1v1
            </Button>
            <Button 
              onClick={() => {
                playFeedback('click');
                setGameMode('local-multiplayer-2');
              }}
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              variant="secondary"
            >
              2 Player Local
            </Button>
            <Button 
              onClick={() => {
                playFeedback('click');
                setGameMode('local-multiplayer-3');
              }}
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              variant="secondary"
            >
              3 Player Local
            </Button>
          </div>

          {/* Game History and Tutorial Buttons */}
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <Button 
              onClick={() => {
                playFeedback('click');
                navigate('/history');
              }}
              size="lg" 
              variant="outline"
              className="w-full h-12 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
            >
              Game History
            </Button>
            <Button 
              onClick={() => {
                playFeedback('click');
                setShowTutorial(true);
              }}
              size="lg" 
              variant="outline"
              className="w-full h-12 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Tutorial
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Local solo game
  if (gameMode === 'local') {
    return <GameBoard boardSize={boardSize} />;
  }

  // Local 2-player game
  if (gameMode === 'local-multiplayer-2') {
    return <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={boardSize} playerCount={2} cooldownTurns={cooldownTurns} />;
  }

  // Local 3-player game
  if (gameMode === 'local-multiplayer-3') {
    return <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={boardSize} playerCount={3} cooldownTurns={cooldownTurns} />;
  }

  return <GameBoard boardSize={boardSize} />;
};

export default Index;