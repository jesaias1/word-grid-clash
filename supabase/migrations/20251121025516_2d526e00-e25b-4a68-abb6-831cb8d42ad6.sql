-- Add invite_code column to game_sessions for short shareable codes
ALTER TABLE game_sessions ADD COLUMN invite_code TEXT UNIQUE;

-- Create index for faster lookups by invite code
CREATE INDEX idx_game_sessions_invite_code ON game_sessions(invite_code);