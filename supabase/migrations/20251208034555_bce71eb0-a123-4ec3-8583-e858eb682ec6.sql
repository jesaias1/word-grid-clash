-- Create game_moves table to record every move in online games
CREATE TABLE public.game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_index INTEGER NOT NULL,
  move_number INTEGER NOT NULL,
  letter TEXT NOT NULL,
  position_row INTEGER NOT NULL,
  position_col INTEGER NOT NULL,
  words_formed TEXT[] DEFAULT '{}',
  points_scored INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;

-- Create index for efficient querying
CREATE INDEX idx_game_moves_session ON public.game_moves(session_id, move_number);

-- RLS policies: session participants can view and insert moves
CREATE POLICY "Session participants can view moves"
ON public.game_moves
FOR SELECT
USING (session_id IN (
  SELECT id FROM public.game_sessions
  WHERE auth.uid() = player1_id OR auth.uid() = player2_id
));

CREATE POLICY "Session participants can insert moves"
ON public.game_moves
FOR INSERT
WITH CHECK (session_id IN (
  SELECT id FROM public.game_sessions
  WHERE auth.uid() = player1_id OR auth.uid() = player2_id
));