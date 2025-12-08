-- Add turn_started_at column to track when current turn began for synchronized timer
ALTER TABLE game_sessions 
ADD COLUMN turn_started_at TIMESTAMP WITH TIME ZONE DEFAULT now();