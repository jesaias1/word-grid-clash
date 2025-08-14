-- Create games table for multiplayer functionality
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES auth.users(id),
  guest_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  current_player INTEGER DEFAULT 1 CHECK (current_player IN (1, 2)),
  turn_number INTEGER DEFAULT 1,
  time_left INTEGER DEFAULT 30,
  player1_grid JSONB DEFAULT '[]',
  player2_grid JSONB DEFAULT '[]',
  shared_cooldowns JSONB DEFAULT '{}',
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  player1_used_words JSONB DEFAULT '[]',
  player2_used_words JSONB DEFAULT '[]',
  player1_scored_cells JSONB DEFAULT '[]',
  player2_scored_cells JSONB DEFAULT '[]',
  winner INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Create policies for games
CREATE POLICY "Users can view games they're part of" 
ON public.games 
FOR SELECT 
USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Host can create games" 
ON public.games 
FOR INSERT 
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Players can update their games" 
ON public.games 
FOR UPDATE 
USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- Create game moves table for tracking individual moves
CREATE TABLE public.game_moves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id),
  player_number INTEGER CHECK (player_number IN (1, 2)),
  letter TEXT NOT NULL,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  turn_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for moves
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;

-- Create policies for game moves
CREATE POLICY "Users can view moves for their games" 
ON public.game_moves 
FOR SELECT 
USING (
  game_id IN (
    SELECT id FROM public.games 
    WHERE auth.uid() = host_id OR auth.uid() = guest_id
  )
);

CREATE POLICY "Players can create moves for their games" 
ON public.game_moves 
FOR INSERT 
WITH CHECK (
  game_id IN (
    SELECT id FROM public.games 
    WHERE auth.uid() = host_id OR auth.uid() = guest_id
  )
  AND auth.uid() = player_id
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate invite codes (if not exists)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $function$
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
$function$;

-- Create function to initialize empty grids
CREATE OR REPLACE FUNCTION public.create_empty_grid()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    grid JSONB := '[]';
    row_data JSONB;
    i INTEGER;
    j INTEGER;
BEGIN
    FOR i IN 0..4 LOOP -- 5x5 grid (0-4)
        row_data := '[]';
        FOR j IN 0..4 LOOP
            row_data := row_data || 'null';
        END LOOP;
        grid := grid || jsonb_build_array(row_data);
    END LOOP;
    RETURN grid;
END;
$function$;

-- Create trigger to set default values for new games
CREATE OR REPLACE FUNCTION public.handle_new_game()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE TRIGGER handle_new_game_trigger
BEFORE INSERT ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_game();