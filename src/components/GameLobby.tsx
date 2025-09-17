import React from 'react';
import { Card } from '@/components/ui/card';

interface GameLobbyProps {
  onJoinGame: (gameId: string) => void;
  onCreateGame: (gameId: string) => void;
}

const GameLobby = ({ onJoinGame, onCreateGame }: GameLobbyProps) => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
          LETTUS Multiplayer
        </h1>
        <p className="text-muted-foreground">Multiplayer features temporarily disabled during scoring system update</p>
      </div>

      <Card className="p-6 bg-gradient-card">
        <div className="text-center text-muted-foreground">
          <p>Multiplayer lobby is temporarily disabled while we implement the new scoring system.</p>
          <p className="mt-2">Please use Local Multiplayer mode to test the new scoring features.</p>
        </div>
      </Card>
    </div>
  );
};

export default GameLobby;