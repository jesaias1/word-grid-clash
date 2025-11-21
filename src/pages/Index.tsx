import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import lettusLogo from '@/assets/lettus-logo.png';
import { RulesDialog } from '@/components/RulesDialog';

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
      <div className="min-h-screen flex items-center justify-center p-3 py-4">
        <RulesDialog />
        <div className="text-center space-y-2.5 max-w-2xl w-full animate-fade-in-up">
          <div className="flex items-center justify-center mb-1 animate-float">
            <img src={lettusLogo} alt="Lettus Logo" className="max-w-full h-auto w-[280px] object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105" />
          </div>
          
          {/* Board Size Selection */}
          <Card className="p-3 shadow-lg border-2 animate-scale-in transition-all duration-300 hover:shadow-xl hover:border-primary/30">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-center text-foreground">Board Size</h2>
              <div className="grid grid-cols-3 gap-2.5">
                {[5, 7, 10].map(size => (
                  <button
                    key={size}
                    onClick={() => setBoardSize(size)}
                    className={`p-2 rounded-xl border-2 transition-all duration-300 ${
                      boardSize === size
                        ? 'border-primary bg-primary/15 text-primary shadow-glow scale-105'
                        : 'border-border hover:border-primary/60 hover:bg-card/80 hover:scale-105'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-bold text-lg mb-0.5">{size}×{size}</div>
                      <div className="text-[10px] text-muted-foreground font-medium">
                        {size === 5 ? 'Classic' : size === 7 ? 'Medium' : 'Large'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Cooldown Duration Selection (for Multiplayer) */}
          <Card className="p-3 shadow-lg border-2 animate-scale-in transition-all duration-300 hover:shadow-xl hover:border-primary/30" style={{ animationDelay: '0.1s' }}>
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-center text-foreground">Cooldown Duration</h2>
              <p className="text-[10px] text-muted-foreground text-center font-medium">Turns before letter reuse (multiplayer)</p>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map(turns => (
                  <button
                    key={turns}
                    onClick={() => setCooldownTurns(turns)}
                    className={`p-1.5 rounded-xl border-2 transition-all duration-300 ${
                      cooldownTurns === turns
                        ? 'border-primary bg-primary/15 text-primary shadow-glow scale-105'
                        : 'border-border hover:border-primary/60 hover:bg-card/80 hover:scale-105'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-bold text-base mb-0.5">{turns}</div>
                      <div className="text-[9px] text-muted-foreground font-medium">
                        {turns === 1 ? 'Easy' : turns === 2 ? 'Easier' : turns === 3 ? 'Normal' : turns === 4 ? 'Hard' : 'Harder'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 pt-1 max-w-md mx-auto">
            <Button 
              onClick={() => setGameMode('local')} 
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              style={{ animationDelay: '0.2s' }}
            >
              Solo Game
            </Button>
            <Button 
              onClick={() => navigate('/online-setup')} 
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              variant="default"
              style={{ animationDelay: '0.3s' }}
            >
              Online 1v1
            </Button>
            <Button 
              onClick={() => setGameMode('local-multiplayer-2')} 
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              variant="secondary"
              style={{ animationDelay: '0.4s' }}
            >
              2 Player Local
            </Button>
            <Button 
              onClick={() => setGameMode('local-multiplayer-3')} 
              size="lg" 
              className="w-full h-16 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              variant="secondary"
              style={{ animationDelay: '0.5s' }}
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