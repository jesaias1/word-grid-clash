
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import { Button } from '@/components/ui/button';

type GameMode = 'menu' | 'local' | 'local-multiplayer';

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const navigate = useNavigate();

  const handleBackToMenu = () => {
    setGameMode('menu');
  };

  // Menu screen
  if (gameMode === 'menu') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            LETTUS
          </h1>
          <p className="text-lg text-muted-foreground">Choose your game mode</p>
          <div className="space-y-4">
            <Button 
              onClick={() => setGameMode('local')} 
              size="lg" 
              className="w-48"
            >
              Solo Game
            </Button>
            <Button 
              onClick={() => setGameMode('local-multiplayer')} 
              size="lg" 
              className="w-48"
              variant="secondary"
            >
              Local Multiplayer
            </Button>
            <Button 
              onClick={() => navigate('/multiplayer')} 
              size="lg" 
              className="w-48"
              variant="outline"
            >
              Online Multiplayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Local solo game
  if (gameMode === 'local') {
    return (
      <div>
        <div className="absolute top-4 left-4">
          <Button onClick={handleBackToMenu} variant="outline" size="sm">
            Back to Menu
          </Button>
        </div>
        <GameBoard />
      </div>
    );
  }

  // Local multiplayer game
  if (gameMode === 'local-multiplayer') {
    return (
      <div>
        <div className="absolute top-4 left-4">
          <Button onClick={handleBackToMenu} variant="outline" size="sm">
            Back to Menu
          </Button>
        </div>
        <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} />
      </div>
    );
  }

  return <GameBoard />;
};

export default Index;
