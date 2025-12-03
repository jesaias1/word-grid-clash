import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import TutorialMode from '@/components/TutorialMode';
import { Button } from '@/components/ui/button';
import lettusLogo from '@/assets/lettus-logo.png';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { GraduationCap, Users, ArrowLeft } from 'lucide-react';

type GameMode = 'menu' | 'local' | 'local-multiplayer-select' | 'local-multiplayer';

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [localPlayerCount, setLocalPlayerCount] = useState<number>(2);
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

  // Player count selection screen
  if (gameMode === 'local-multiplayer-select') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md w-full animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Users className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-bold">Local Multiplayer</h1>
          </div>
          
          <p className="text-muted-foreground">How many players?</p>
          
          <div className="grid grid-cols-2 gap-3">
            {[2, 3, 4, 5].map((count) => (
              <Button
                key={count}
                onClick={() => {
                  playFeedback('click');
                  setLocalPlayerCount(count);
                  setGameMode('local-multiplayer');
                }}
                size="lg"
                variant="secondary"
                className="h-20 text-xl font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105"
              >
                {count} Players
              </Button>
            ))}
          </div>
          
          <Button
            onClick={() => {
              playFeedback('click');
              setGameMode('menu');
            }}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

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
                setGameMode('local-multiplayer-select');
              }}
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up col-span-2"
              variant="secondary"
            >
              <Users className="w-5 h-5 mr-2" />
              Local Multiplayer (2-5 Players)
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
    return <GameBoard boardSize={boardSize} onBackToMenu={handleBackToMenu} />;
  }

  // Local multiplayer game (2-5 players)
  if (gameMode === 'local-multiplayer') {
    return <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={boardSize} playerCount={localPlayerCount} cooldownTurns={cooldownTurns} />;
  }

  return <GameBoard boardSize={boardSize} onBackToMenu={handleBackToMenu} />;
};

export default Index;
