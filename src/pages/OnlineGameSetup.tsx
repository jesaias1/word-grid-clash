import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      const initialGrid = generateStartingTiles(boardSize);
      const availableLetters = generateLetterPool();

      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          player1_name: username,
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

      await supabase
        .from('game_sessions')
        .update({ 
          player2_name: username,
          status: 'playing'
        })
        .eq('id', session.id);

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
      <div className="text-center space-y-4 max-w-md w-full animate-fade-in">
        <div className="flex items-center justify-center mb-2">
          <img src={lettusLogo} alt="Lettus Logo" className="max-w-full h-auto w-[240px] object-contain drop-shadow-2xl" />
        </div>

        <Card className="p-4 shadow-lg border-2">
          <h2 className="text-lg font-bold mb-3 text-foreground">Online Multiplayer</h2>
          
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
                className="w-full h-10 font-bold"
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
                className="w-full h-10 font-bold"
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
          className="shadow-lg"
        >
          Back to Menu
        </Button>
      </div>
    </div>
  );
};

export default OnlineGameSetup;
