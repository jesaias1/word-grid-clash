-- Create game sessions table for online multiplayer
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_name TEXT NOT NULL,
  player2_name TEXT,
  current_player INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, playing, finished
  board_size INTEGER NOT NULL DEFAULT 5,
  cooldown_turns INTEGER NOT NULL DEFAULT 4,
  winner_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game state table to store each player's grid and state
CREATE TABLE public.game_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_index INTEGER NOT NULL,
  grid_data JSONB NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  available_letters JSONB NOT NULL,
  cooldowns JSONB NOT NULL DEFAULT '{}',
  turn_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, player_index)
);

-- Enable Row Level Security
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read game sessions (for joining games)
CREATE POLICY "Anyone can view game sessions"
ON public.game_sessions
FOR SELECT
USING (true);

-- Allow anyone to create game sessions
CREATE POLICY "Anyone can create game sessions"
ON public.game_sessions
FOR INSERT
WITH CHECK (true);

-- Allow anyone to update game sessions
CREATE POLICY "Anyone can update game sessions"
ON public.game_sessions
FOR UPDATE
USING (true);

-- Allow anyone to view game state
CREATE POLICY "Anyone can view game state"
ON public.game_state
FOR SELECT
USING (true);

-- Allow anyone to create game state
CREATE POLICY "Anyone can create game state"
ON public.game_state
FOR INSERT
WITH CHECK (true);

-- Allow anyone to update game state
CREATE POLICY "Anyone can update game state"
ON public.game_state
FOR UPDATE
USING (true);

-- Create trigger for automatic timestamp updates on game_sessions
CREATE TRIGGER update_game_sessions_updated_at
BEFORE UPDATE ON public.game_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on game_state
CREATE TRIGGER update_game_state_updated_at
BEFORE UPDATE ON public.game_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for game_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;

-- Enable realtime for game_state
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;

-- Set replica identity for realtime updates
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.game_state REPLICA IDENTITY FULL;