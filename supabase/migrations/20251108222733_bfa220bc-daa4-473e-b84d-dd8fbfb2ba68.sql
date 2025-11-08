-- Add user ID columns to track anonymous players
ALTER TABLE public.game_sessions 
ADD COLUMN player1_id UUID REFERENCES auth.users(id),
ADD COLUMN player2_id UUID REFERENCES auth.users(id);

-- Drop existing overly permissive policies on game_sessions
DROP POLICY IF EXISTS "Anyone can view game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can update game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can create game sessions" ON public.game_sessions;

-- Create secure policies for game_sessions
CREATE POLICY "Players can create their own game sessions"
ON public.game_sessions
FOR INSERT
WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Session participants can view their sessions"
ON public.game_sessions
FOR SELECT
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Session participants can update their sessions"
ON public.game_sessions
FOR UPDATE
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Drop existing overly permissive policies on game_state
DROP POLICY IF EXISTS "Anyone can view game state" ON public.game_state;
DROP POLICY IF EXISTS "Anyone can update game state" ON public.game_state;
DROP POLICY IF EXISTS "Anyone can create game state" ON public.game_state;

-- Create secure policies for game_state
CREATE POLICY "Session participants can create game state"
ON public.game_state
FOR INSERT
WITH CHECK (
  session_id IN (
    SELECT id FROM public.game_sessions 
    WHERE auth.uid() = player1_id OR auth.uid() = player2_id
  )
);

CREATE POLICY "Session participants can view their game state"
ON public.game_state
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM public.game_sessions 
    WHERE auth.uid() = player1_id OR auth.uid() = player2_id
  )
);

CREATE POLICY "Session participants can update their game state"
ON public.game_state
FOR UPDATE
USING (
  session_id IN (
    SELECT id FROM public.game_sessions 
    WHERE auth.uid() = player1_id OR auth.uid() = player2_id
  )
);