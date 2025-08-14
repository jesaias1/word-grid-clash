-- Create games table for multiplayer functionality
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player1_name TEXT NOT NULL DEFAULT 'Player 1',
  player2_name TEXT NOT NULL DEFAULT 'Player 2',
  player1_grid JSONB NOT NULL DEFAULT '[]',
  player2_grid JSONB NOT NULL DEFAULT '[]',
  current_player INTEGER NOT NULL DEFAULT 1 CHECK (current_player IN (1, 2)),
  turn_number INTEGER NOT NULL DEFAULT 1,
  scores INTEGER ARRAY[2] NOT NULL DEFAULT '{0, 0}',
  shared_cooldowns JSONB NOT NULL DEFAULT '{}',
  game_status TEXT NOT NULL DEFAULT 'waiting' CHECK (game_status IN ('waiting', 'active', 'finished')),
  winner INTEGER CHECK (winner IN (1, 2)),
  time_left INTEGER NOT NULL DEFAULT 30,
  last_turn_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Create policies for games
CREATE POLICY "Games are viewable by players" 
ON public.games 
FOR SELECT 
USING (
  auth.uid() = player1_id OR 
  auth.uid() = player2_id OR 
  auth.uid() IS NULL -- Allow guests to view games they have the invite code for
);

CREATE POLICY "Players can update their own games" 
ON public.games 
FOR UPDATE 
USING (
  auth.uid() = player1_id OR 
  auth.uid() = player2_id OR 
  auth.uid() IS NULL -- Allow guests to update games
);

CREATE POLICY "Anyone can create games" 
ON public.games 
FOR INSERT 
WITH CHECK (true);

-- Create function to generate unique invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    code TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        -- Generate a 6-character code
        code := upper(substring(md5(random()::text) from 1 for 6));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM public.games WHERE invite_code = code) INTO exists_check;
        
        -- If code doesn't exist, return it
        IF NOT exists_check THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$;

-- Create function to create empty grid
CREATE OR REPLACE FUNCTION public.create_empty_grid()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    grid JSONB := '[]';
    row_data JSONB;
    i INTEGER;
    j INTEGER;
BEGIN
    FOR i IN 0..4 LOOP
        row_data := '[]';
        FOR j IN 0..4 LOOP
            row_data := row_data || 'null';
        END LOOP;
        grid := grid || jsonb_build_array(row_data);
    END LOOP;
    RETURN grid;
END;
$$;

-- Create trigger to auto-generate invite codes and set up grids
CREATE OR REPLACE FUNCTION public.handle_new_game()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
        NEW.invite_code := generate_invite_code();
    END IF;
    
    IF NEW.player1_grid = '[]' THEN
        NEW.player1_grid := create_empty_grid();
    END IF;
    
    IF NEW.player2_grid = '[]' THEN
        NEW.player2_grid := create_empty_grid();
    END IF;
    
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_game_created
    BEFORE INSERT ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_game();

-- Create trigger for updating updated_at
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for games table
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER TABLE public.games REPLICA IDENTITY FULL;