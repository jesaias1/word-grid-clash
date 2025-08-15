-- Fix security vulnerability: Remove access to games with null player IDs
-- from the "Players can view their own games" policy

-- Drop the existing policy
DROP POLICY IF EXISTS "Players can view their own games" ON public.games;

-- Create a more secure policy that only allows players to view games they're actually in
CREATE POLICY "Players can view their own games" ON public.games
FOR SELECT 
USING (
  (auth.uid() = player1_id) OR 
  (auth.uid() = player2_id)
);

-- The "Anyone can view waiting games" policy already handles the lobby functionality
-- so we don't need to allow access to games with null player IDs