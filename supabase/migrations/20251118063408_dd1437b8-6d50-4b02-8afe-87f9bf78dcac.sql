-- Fix RLS policy to allow Player 2 to join waiting games
DROP POLICY IF EXISTS "Session participants can update their sessions" ON game_sessions;

CREATE POLICY "Session participants can update their sessions"
ON game_sessions
FOR UPDATE
USING (
  (auth.uid() = player1_id) 
  OR (auth.uid() = player2_id)
  OR (status = 'waiting' AND player2_id IS NULL)
);