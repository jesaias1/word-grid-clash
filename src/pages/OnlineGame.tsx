import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import OnlineMultiplayerBoard from '@/components/OnlineMultiplayerBoard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, Check } from 'lucide-react';

const OnlineGame = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) {
      navigate('/online-setup');
      return;
    }

    let mounted = true;

    const initializeGame = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      
      if (user) {
        setCurrentUserId(user.id);
      }

      // Set up real-time subscription FIRST
      const channel = supabase
        .channel('game-session-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_sessions',
            filter: `id=eq.${gameId}`
          },
          (payload) => {
            if (mounted) {
              setSession(payload.new);
            }
          }
        )
        .subscribe();

      // THEN fetch initial session data
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', gameId)
        .single();

      if (!mounted) return;

      if (error || !data) {
        toast({
          title: "Game not found",
          description: "This game doesn't exist",
          variant: "destructive"
        });
        navigate('/online-setup');
        return;
      }

      setSession(data);
      setLoading(false);
    };

    initializeGame();

    return () => {
      mounted = false;
      supabase.channel('game-session-changes').unsubscribe();
    };
  }, [gameId, navigate, toast]);

  const copyGameLink = () => {
    const gameUrl = `${window.location.origin}/online-setup?join=${gameId}`;
    navigator.clipboard.writeText(gameUrl);
    setCopied(true);
    toast({
      title: "Link copied!",
      description: "Share this link with your friend"
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  // Only show waiting screen to Player 1 (the one who created the game)
  const isPlayer1 = currentUserId && session?.player1_id === currentUserId;
  
  if (session?.status === 'waiting' && isPlayer1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md w-full shadow-lg border-2 text-center space-y-4 animate-fade-in">
          <h2 className="text-xl font-bold text-foreground">Waiting for Opponent</h2>
          <p className="text-muted-foreground">Share this game link with a friend:</p>
          
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-lg font-mono font-bold text-primary break-all">{gameId}</code>
          </div>

          <Button 
            onClick={copyGameLink}
            variant="secondary"
            className="w-full font-bold"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Game Link
              </>
            )}
          </Button>

          <Button 
            onClick={() => navigate('/')}
            variant="outline"
            className="w-full"
          >
            Back to Menu
          </Button>
        </Card>
      </div>
    );
  }

  // If Player 2 arrives while status is still 'waiting', show a loading state
  if (session?.status === 'waiting' && !isPlayer1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Joining game...</p>
        </div>
      </div>
    );
  }

  return <OnlineMultiplayerBoard sessionId={gameId!} />;
};

export default OnlineGame;
