import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type GameMode = 'menu' | 'local' | 'local-multiplayer';

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [boardSize, setBoardSize] = useState(5);
  const navigate = useNavigate();

  const handleBackToMenu = () => {
    setGameMode('menu');
  };

  // Menu screen
  if (gameMode === 'menu') {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex items-center justify-center mb-4">
            <img src="/src/assets/lettus-logo.png" alt="Lettus Logo" className="w-[410px] h-[160px] object-contain" />
          </div>
          <p className="text-lg text-muted-foreground">Choose your game mode</p>
          
          {/* Board Size Selection */}
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-center">Choose Board Size</h2>
              <div className="grid grid-cols-3 gap-3">
                {[5, 7, 10].map(size => (
                  <button
                    key={size}
                    onClick={() => setBoardSize(size)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      boardSize === size
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-lg">{size}×{size}</div>
                      <div className="text-xs text-muted-foreground">
                        {size === 5 ? 'Classic' : size === 7 ? 'Medium' : 'Large'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

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
        <GameBoard boardSize={boardSize} />
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
        <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={boardSize} />
      </div>
    );
  }

  return <GameBoard boardSize={boardSize} />;
};

export default Index;