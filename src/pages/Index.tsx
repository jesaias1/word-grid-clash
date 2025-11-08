import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import lettusLogo from '@/assets/lettus-logo.png';

type GameMode = 'menu' | 'local' | 'local-multiplayer-2' | 'local-multiplayer-3';

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [boardSize, setBoardSize] = useState(5);
  const [cooldownTurns, setCooldownTurns] = useState(4);
  const navigate = useNavigate();

  const handleBackToMenu = () => {
    setGameMode('menu');
  };

  // Menu screen
  if (gameMode === 'menu') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-8 max-w-2xl w-full animate-fade-in">
          <div className="flex items-center justify-center mb-8">
            <img src={lettusLogo} alt="Lettus Logo" className="max-w-full h-auto w-[600px] object-contain drop-shadow-2xl" />
          </div>
          <p className="text-xl text-muted-foreground font-medium">Choose your game mode</p>
          
          {/* Board Size Selection */}
          <Card className="p-8 shadow-lg border-2">
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-center text-foreground">Choose Board Size</h2>
              <div className="grid grid-cols-3 gap-4">
                {[5, 7, 10].map(size => (
                  <button
                    key={size}
                    onClick={() => setBoardSize(size)}
                    className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                      boardSize === size
                        ? 'border-primary bg-primary/15 text-primary shadow-glow scale-105'
                        : 'border-border hover:border-primary/60 hover:bg-card/80 hover:scale-105'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-bold text-2xl mb-1">{size}×{size}</div>
                      <div className="text-sm text-muted-foreground font-medium">
                        {size === 5 ? 'Classic' : size === 7 ? 'Medium' : 'Large'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Cooldown Duration Selection (for Multiplayer) */}
          <Card className="p-8 shadow-lg border-2">
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-center text-foreground">Letter Cooldown Duration</h2>
              <p className="text-sm text-muted-foreground text-center font-medium">Turns before a letter can be used again (multiplayer only)</p>
              <div className="grid grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(turns => (
                  <button
                    key={turns}
                    onClick={() => setCooldownTurns(turns)}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                      cooldownTurns === turns
                        ? 'border-primary bg-primary/15 text-primary shadow-glow scale-105'
                        : 'border-border hover:border-primary/60 hover:bg-card/80 hover:scale-105'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-bold text-xl mb-1">{turns}</div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {turns === 1 ? 'Easy' : turns === 2 ? 'Easier' : turns === 3 ? 'Normal' : turns === 4 ? 'Hard' : 'Harder'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-4 pt-4">
            <Button 
              onClick={() => setGameMode('local')} 
              size="lg" 
              className="w-64 h-14 text-lg font-bold shadow-lg hover:shadow-glow transition-all duration-300"
            >
              Solo Game
            </Button>
            <Button 
              onClick={() => setGameMode('local-multiplayer-2')} 
              size="lg" 
              className="w-64 h-14 text-lg font-bold shadow-lg hover:shadow-glow transition-all duration-300"
              variant="secondary"
            >
              2 Player Local
            </Button>
            <Button 
              onClick={() => setGameMode('local-multiplayer-3')} 
              size="lg" 
              className="w-64 h-14 text-lg font-bold shadow-lg hover:shadow-glow transition-all duration-300"
              variant="secondary"
            >
              3 Player Local
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
        <div className="absolute top-6 left-6 z-10">
          <Button onClick={handleBackToMenu} variant="outline" size="lg" className="shadow-lg">
            Back to Menu
          </Button>
        </div>
        <GameBoard boardSize={boardSize} />
      </div>
    );
  }

  // Local 2-player game
  if (gameMode === 'local-multiplayer-2') {
    return (
      <div>
        <div className="absolute top-6 left-6 z-10">
          <Button onClick={handleBackToMenu} variant="outline" size="lg" className="shadow-lg">
            Back to Menu
          </Button>
        </div>
        <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={boardSize} playerCount={2} cooldownTurns={cooldownTurns} />
      </div>
    );
  }

  // Local 3-player game
  if (gameMode === 'local-multiplayer-3') {
    return (
      <div>
        <div className="absolute top-6 left-6 z-10">
          <Button onClick={handleBackToMenu} variant="outline" size="lg" className="shadow-lg">
            Back to Menu
          </Button>
        </div>
        <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={boardSize} playerCount={3} cooldownTurns={cooldownTurns} />
      </div>
    );
  }

  return <GameBoard boardSize={boardSize} />;
};

export default Index;