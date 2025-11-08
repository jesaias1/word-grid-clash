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

  useEffect(() => {
    if (!gameId) {
      navigate('/online-setup');
      return;
    }

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', gameId)
        .single();

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

    fetchSession();

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
          setSession(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  if (session?.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md w-full shadow-lg border-2 text-center space-y-4 animate-fade-in">
          <h2 className="text-xl font-bold text-foreground">Waiting for Opponent</h2>
          <p className="text-muted-foreground">Share this game code with a friend:</p>
          
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

  return <OnlineMultiplayerBoard sessionId={gameId!} />;
};

export default OnlineGame;
