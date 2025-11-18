-- Allow anyone to view game sessions that are waiting for players
DROP POLICY IF EXISTS "Session participants can view their sessions" ON game_sessions;

CREATE POLICY "Session participants can view their sessions"
ON game_sessions
FOR SELECT
USING (
  (auth.uid() = player1_id) 
  OR (auth.uid() = player2_id) 
  OR (status = 'waiting')
);