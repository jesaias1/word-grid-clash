import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import lettusLogo from '@/assets/lettus-logo.png';

const OnlineGameSetup = () => {
  const [username, setUsername] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Auto-populate game code from URL parameter
  useEffect(() => {
    const joinGameId = searchParams.get('join');
    if (joinGameId) {
      setGameCode(joinGameId);
      toast({
        title: "Ready to join!",
        description: "Enter your username and click Join Game"
      });
    }
  }, [searchParams, toast]);

  const boardSize = 5;
  const cooldownTurns = 4;

  const generateLetterPool = () => {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  };

  const generateStartingTiles = (size: number) => {
    const grid = Array(size).fill(null).map(() => 
      Array(size).fill(null).map(() => ({ letter: null as string | null }))
    );
    
    const letterPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    // Pick 5 random letters from the pool for starting tiles
    const startingLetters = [];
    for (let i = 0; i < Math.min(5, size); i++) {
      const letter = letterPool[Math.floor(Math.random() * letterPool.length)];
      startingLetters.push(letter);
    }
    
    // Place one letter in each row at random column
    for (let row = 0; row < Math.min(5, size); row++) {
      const col = Math.floor(Math.random() * size);
      grid[row][col] = { letter: startingLetters[row] };
    }
    
    return grid;
  };

  const createGame = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      // Sign in anonymously to get a user ID
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const initialGrid = generateStartingTiles(boardSize);
      const availableLetters = generateLetterPool();

      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          player1_name: username,
          player1_id: authData.user.id,
          board_size: boardSize,
          cooldown_turns: cooldownTurns,
          status: 'waiting'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      await supabase.from('game_state').insert({
        session_id: session.id,
        player_index: 1,
        grid_data: initialGrid,
        score: 0,
        available_letters: availableLetters,
        cooldowns: {}
      });

      navigate(`/online/${session.id}`);
    } catch (error) {
      console.error('Error creating game:', error);
      toast({
        title: "Error",
        description: "Failed to create game",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const joinGame = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    if (!gameCode.trim()) {
      toast({
        title: "Game code required",
        description: "Please enter a game code",
        variant: "destructive"
      });
      return;
    }

    setIsJoining(true);
    try {
      // Sign in anonymously to get a user ID
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const { data: session, error: fetchError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', gameCode)
        .single();

      if (fetchError || !session) {
        toast({
          title: "Game not found",
          description: "Invalid game code",
          variant: "destructive"
        });
        return;
      }

      if (session.status !== 'waiting') {
        toast({
          title: "Game unavailable",
          description: "This game has already started or finished",
          variant: "destructive"
        });
        return;
      }

      if (session.player2_name) {
        toast({
          title: "Game full",
          description: "This game already has two players",
          variant: "destructive"
        });
        return;
      }

      // Update session with player 2 info FIRST so RLS allows game_state insert
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({ 
          player2_name: username,
          player2_id: authData.user.id,
          status: 'playing'
        })
        .eq('id', session.id);

      if (updateError) throw updateError;

      // Now insert game state (RLS will allow it since player2_id is set)
      const initialGrid = generateStartingTiles(session.board_size);
      const availableLetters = generateLetterPool();

      await supabase.from('game_state').insert({
        session_id: session.id,
        player_index: 2,
        grid_data: initialGrid,
        score: 0,
        available_letters: availableLetters,
        cooldowns: {}
      });

      // Wait briefly to ensure the update propagates
      await new Promise(resolve => setTimeout(resolve, 300));

      navigate(`/online/${session.id}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast({
        title: "Error",
        description: "Failed to join game",
        variant: "destructive"
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md w-full animate-fade-in-up">
        <div className="flex items-center justify-center mb-2 animate-float">
          <img src={lettusLogo} alt="Lettus Logo" className="max-w-full h-auto w-[240px] object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105" />
        </div>

        <Card className="p-4 shadow-lg border-2 transition-all duration-300 hover:shadow-xl hover:border-primary/30">
          <h2 className="text-lg font-bold mb-3 text-foreground animate-slide-in-left">Online Multiplayer</h2>
          
          <div className="space-y-3">
            <Input
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="text-center"
              maxLength={20}
            />

            <Input
              placeholder="Game code (to join)"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value)}
              className="text-center"
            />

            <Button 
              onClick={createGame}
              disabled={isCreating || !username.trim()}
              className="w-full h-10 font-bold transition-all duration-300 hover:scale-105 hover:shadow-glow"
              size="lg"
            >
              {isCreating ? 'Creating...' : 'Create New Game'}
            </Button>

            <Button 
              onClick={joinGame}
              disabled={isJoining || !username.trim() || !gameCode.trim()}
              variant="secondary"
              className="w-full h-10 font-bold transition-all duration-300 hover:scale-105 hover:shadow-glow"
              size="lg"
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </Button>

            <div className="text-xs text-muted-foreground text-center mt-2 p-2 bg-muted/50 rounded">
              💡 To test multiplayer: Use a different browser or incognito window for Player 2
            </div>
          </div>
        </Card>

        <Button 
          onClick={() => navigate('/')}
          variant="outline"
          className="shadow-lg transition-all duration-300 hover:scale-105"
        >
          Back to Menu
        </Button>
      </div>
    </div>
  );
};

export default OnlineGameSetup;
