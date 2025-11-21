-- Add words_found column to game_state table to track all words found by each player
ALTER TABLE game_state 
ADD COLUMN words_found jsonb DEFAULT '[]'::jsonb;