import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const MultiplayerJoin = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteCode) {
      // Find the game by invite code and redirect to it
      const findAndJoinGame = async () => {
        try {
          const { data: game } = await supabase
            .from('games')
            .select('*')
            .eq('invite_code', inviteCode)
            .single();
          
          if (game) {
            // Generate a unique session ID for this browser session
            const sessionId = localStorage.getItem('player_session_id') || 
                             `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('player_session_id', sessionId);
            
            // Determine which player this session should be or join as available player
            if (game.player1_id === sessionId) {
              // Already player 1
              navigate(`/multiplayer/${game.id}?player=1&username=Player 1`);
            } else if (game.player2_id === sessionId) {
              // Already player 2
              navigate(`/multiplayer/${game.id}?player=2&username=Player 2`);
            } else if (!game.player1_id) {
              // Join as player 1
              await supabase
                .from('games')
                .update({ player1_id: sessionId })
                .eq('id', game.id);
              navigate(`/multiplayer/${game.id}?player=1&username=Player 1`);
            } else if (!game.player2_id) {
              // Join as player 2
              await supabase
                .from('games')
                .update({ player2_id: sessionId })
                .eq('id', game.id);
              navigate(`/multiplayer/${game.id}?player=2&username=Player 2`);
            } else {
              // Game is full
              navigate(`/multiplayer/${game.id}?spectate=true`);
            }
          } else {
            navigate(`/multiplayer?code=${inviteCode}`);
          }
        } catch (error) {
          console.error('Error finding game:', error);
          navigate(`/multiplayer?code=${inviteCode}`);
        }
      };
      
      findAndJoinGame();
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