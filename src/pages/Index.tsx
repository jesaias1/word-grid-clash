
import { useState } from 'react';
import GameBoard from '@/components/GameBoard';
import GameLobby from '@/components/GameLobby';
import MultiplayerGameBoard from '@/components/MultiplayerGameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import AuthWrapper from '@/components/AuthWrapper';
import { Button } from '@/components/ui/button';

type GameMode = 'menu' | 'local' | 'local-multiplayer' | 'lobby' | 'multiplayer';

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [currentGameId, setCurrentGameId] = useState<string>('');
  const [isGuest, setIsGuest] = useState(false);

  const handleJoinGame = (gameId: string) => {
    setCurrentGameId(gameId);
    setGameMode('multiplayer');
  };

  const handleCreateGame = (gameId: string) => {
    setCurrentGameId(gameId);
    setGameMode('multiplayer');
  };

  const handleBackToLobby = () => {
    setCurrentGameId('');
    setGameMode('lobby');
  };

  const handleBackToMenu = () => {
    setCurrentGameId('');
    setGameMode('menu');
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
  };

  // Menu screen
  if (gameMode === 'menu') {
    return (
      <AuthWrapper allowGuest onGuestLogin={handleGuestLogin}>
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
              {!isGuest && (
                <Button 
                  onClick={() => setGameMode('lobby')} 
                  size="lg" 
                  className="w-48"
                  variant="outline"
                >
                  Online Multiplayer
                </Button>
              )}
            </div>
            {isGuest && (
              <p className="text-sm text-muted-foreground">
                Sign up for online multiplayer features
              </p>
            )}
          </div>
        </div>
      </AuthWrapper>
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

  // Online lobby
  if (gameMode === 'lobby') {
    return (
      <AuthWrapper>
        <div className="absolute top-4 left-4">
          <Button onClick={handleBackToMenu} variant="outline" size="sm">
            Back to Menu
          </Button>
        </div>
        <GameLobby 
          onJoinGame={handleJoinGame}
          onCreateGame={handleCreateGame}
        />
      </AuthWrapper>
    );
  }

  // Multiplayer game
  if (gameMode === 'multiplayer') {
    return (
      <AuthWrapper>
        <MultiplayerGameBoard 
          gameId={currentGameId}
          onBackToLobby={handleBackToLobby}
        />
      </AuthWrapper>
    );
  }

  return <GameBoard />;
};

export default Index;
