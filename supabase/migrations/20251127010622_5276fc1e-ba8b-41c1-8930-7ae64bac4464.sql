-- Add rematch_requested_by field to track rematch requests
ALTER TABLE game_sessions
ADD COLUMN rematch_requested_by integer;

COMMENT ON COLUMN game_sessions.rematch_requested_by IS 'Player index (1 or 2) who requested rematch, or null if no request';