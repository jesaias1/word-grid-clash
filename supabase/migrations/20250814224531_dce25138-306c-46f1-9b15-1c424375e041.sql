-- Update RLS policies to allow guest users to create and join games

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all authenticated users to create games" ON public.games;
DROP POLICY IF EXISTS "Players can update their own games or join waiting via code" ON public.games;
DROP POLICY IF EXISTS "Players can view their own games" ON public.games;
DROP POLICY IF EXISTS "Users can view waiting games" ON public.games;

-- Create new policies that allow guest users
CREATE POLICY "Anyone can create games" ON public.games
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view waiting games" ON public.games
FOR SELECT 
USING (game_status = 'waiting');

CREATE POLICY "Players can view their own games" ON public.games
FOR SELECT 
USING (
  (auth.uid() = player1_id) OR 
  (auth.uid() = player2_id) OR
  (player1_id IS NULL) OR
  (player2_id IS NULL)
);

CREATE POLICY "Players can update their games or join waiting games" ON public.games
FOR UPDATE 
USING (
  (auth.uid() = player1_id) OR 
  (auth.uid() = player2_id) OR 
  (player2_id IS NULL AND game_status = 'waiting') OR
  (player1_id IS NULL) OR
  (player2_id IS NULL)
)
WITH CHECK (
  (auth.uid() = player1_id) OR 
  (auth.uid() = player2_id) OR 
  (player2_id = auth.uid() AND game_status IN ('waiting', 'active')) OR
  (player1_id IS NULL) OR
  (player2_id IS NULL)
);

-- Allow player1_id and player2_id to be nullable for guest users
ALTER TABLE public.games ALTER COLUMN player1_id DROP NOT NULL;
ALTER TABLE public.games ALTER COLUMN player2_id DROP NOT NULL;