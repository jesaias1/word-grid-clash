import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const MultiplayerJoin = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteCode) {
      // Redirect to lobby with the invite code pre-filled
      navigate(`/multiplayer?code=${inviteCode}`);
    }
  }, [inviteCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Joining Game...</h1>
        <p className="text-muted-foreground">
          Redirecting you to join the game with code: <strong>{inviteCode}</strong>
        </p>
        <Button onClick={() => navigate('/multiplayer')} variant="outline">
          Go to Lobby
        </Button>
      </Card>
    </div>
  );
};

export default MultiplayerJoin;