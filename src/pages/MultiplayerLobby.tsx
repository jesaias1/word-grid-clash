import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Play, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Game = Tables<'games'>;

const MultiplayerLobby = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedBoardSize, setSelectedBoardSize] = useState(5);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load waiting games
    loadWaitingGames();

    // Set up realtime subscription for games
    const channel = supabase
      .channel('games-lobby')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        () => {
          loadWaitingGames();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadWaitingGames = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('game_status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error loading games:', error);
      return;
    }

    setGames(data || []);
  };

  const createGame = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to create a game",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('games')
        .insert({
          player1_id: user.user?.id || null,
          invite_code: '',
          game_status: 'waiting',
          board_size: selectedBoardSize
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Game created!",
        description: `Share invite code: ${data.invite_code}`,
      });

      // Navigate to the game
      navigate(`/multiplayer/${data.id}?player=1&username=${encodeURIComponent(username)}`);
    } catch (error) {
      console.error('Error creating game:', error);
      toast({
        title: "Error",
        description: "Failed to create game",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const joinGameByCode = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Invite code required",
        description: "Please enter an invite code",
        variant: "destructive",
      });
      return;
    }

    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to join a game",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Find the game by invite code
      const { data: game, error: findError } = await supabase
        .from('games')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .eq('game_status', 'waiting')
        .single();

      if (findError || !game) {
        toast({
          title: "Game not found",
          description: "Invalid invite code or game is no longer available",
          variant: "destructive",
        });
        return;
      }

      // Join the game as player 2
      const { error: updateError } = await supabase
        .from('games')
        .update({
          player2_id: user.user?.id || null,
          game_status: 'active'
        })
        .eq('id', game.id);

      if (updateError) throw updateError;

      toast({
        title: "Game joined!",
        description: "Starting multiplayer game...",
      });

      // Navigate to the game
      navigate(`/multiplayer/${game.id}?player=2&username=${encodeURIComponent(username)}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast({
        title: "Error",
        description: "Failed to join game",
        variant: "destructive",
      });
    }
  };

  const joinGame = async (gameId: string) => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to join a game",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('games')
        .update({
          player2_id: user.user?.id || null,
          game_status: 'active'
        })
        .eq('id', gameId);

      if (error) throw error;

      toast({
        title: "Game joined!",
        description: "Starting multiplayer game...",
      });

      navigate(`/multiplayer/${gameId}?player=2&username=${encodeURIComponent(username)}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast({
        title: "Error",
        description: "Failed to join game",
        variant: "destructive",
      });
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen p-4 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS Multiplayer
        </h1>
        <p className="text-muted-foreground">Challenge friends to word battles!</p>
      </div>

      {/* Username Input */}
      <Card className="p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Username</label>
          <Input
            placeholder="Enter your username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
          />
        </div>
      </Card>

      {/* Board Size Selection */}
      <Card className="p-4">
        <div className="space-y-3">
          <label className="text-sm font-medium">Board Size</label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 7, 10].map(size => (
              <button
                key={size}
                onClick={() => setSelectedBoardSize(size)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedBoardSize === size
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold">{size}×{size}</div>
                  <div className="text-xs text-muted-foreground">
                    {size === 5 ? 'Classic' : size === 7 ? 'Medium' : 'Large'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Game Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create Game */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Create Game</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Start a new game and share the invite code with a friend
            </p>
            <Button 
              onClick={createGame} 
              disabled={isCreating || !username.trim()}
              className="w-full"
            >
              {isCreating ? "Creating..." : "Create Game"}
            </Button>
          </div>
        </Card>

        {/* Join by Code */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Join by Code</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter a friend's invite code to join their game
            </p>
            <Input
              placeholder="Enter invite code..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <Button 
              onClick={joinGameByCode} 
              disabled={!inviteCode.trim() || !username.trim()}
              className="w-full"
            >
              Join Game
            </Button>
          </div>
        </Card>
      </div>

      {/* Available Games */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Available Games</h2>
          </div>
          
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No games waiting for players. Create one to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">Code: {game.invite_code}</Badge>
                      <Badge variant="outline">
                        {game.board_size}×{game.board_size}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyInviteCode(game.invite_code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(game.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <Button 
                    onClick={() => joinGame(game.id)}
                    disabled={!username.trim()}
                    size="sm"
                  >
                    Join Game
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Back to Main Game */}
      <div className="text-center">
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Solo Game
        </Button>
      </div>
    </div>
  );
};

export default MultiplayerLobby;