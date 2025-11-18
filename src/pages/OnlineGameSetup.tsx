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
    
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    const consonants = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
    
    const getRandomLetter = (useVowel: boolean) => {
      const pool = useVowel ? vowels : consonants;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    grid[0][0] = { letter: getRandomLetter(true) };
    grid[size - 1][size - 1] = { letter: getRandomLetter(false) };
    
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

      // Update session with player 2 info and start the game
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({ 
          player2_name: username,
          player2_id: authData.user.id,
          status: 'playing'
        })
        .eq('id', session.id);

      if (updateError) throw updateError;

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
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="text-center"
              maxLength={20}
            />

            <div className="space-y-2">
              <Button 
                onClick={createGame}
                disabled={isCreating || !username.trim()}
                className="w-full h-10 font-bold transition-all duration-300 hover:scale-105 hover:shadow-glow"
                size="lg"
              >
                {isCreating ? 'Creating...' : 'Create New Game'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Input
                placeholder="Enter game code to join"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                className="text-center"
              />

              <Button 
                onClick={joinGame}
                disabled={isJoining || !username.trim() || !gameCode.trim()}
                variant="secondary"
                className="w-full h-10 font-bold transition-all duration-300 hover:scale-105 hover:shadow-glow"
                size="lg"
              >
                {isJoining ? 'Joining...' : 'Join Game'}
              </Button>
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
