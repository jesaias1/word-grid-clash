-- Create daily_challenges table for storing puzzle data
CREATE TABLE public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL UNIQUE,
  starting_grid jsonb NOT NULL,
  letter_sequence jsonb NOT NULL,
  bronze_target integer NOT NULL DEFAULT 40,
  silver_target integer NOT NULL DEFAULT 60,
  gold_target integer NOT NULL DEFAULT 80,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create daily_challenge_attempts table for tracking user attempts
CREATE TABLE public.daily_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_date date NOT NULL,
  score integer NOT NULL DEFAULT 0,
  tier_achieved text CHECK (tier_achieved IN ('none', 'bronze', 'silver', 'gold', 'diamond')),
  words_found jsonb DEFAULT '[]'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_date)
);

-- Enable RLS
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;

-- Daily challenges are publicly readable (everyone gets same puzzle)
CREATE POLICY "Anyone can view daily challenges"
ON public.daily_challenges
FOR SELECT
USING (true);

-- Users can view their own attempts
CREATE POLICY "Users can view their own attempts"
ON public.daily_challenge_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own attempts
CREATE POLICY "Users can insert their own attempts"
ON public.daily_challenge_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own attempts
CREATE POLICY "Users can update their own attempts"
ON public.daily_challenge_attempts
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to calculate user streak
CREATE OR REPLACE FUNCTION public.get_user_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  streak integer := 0;
  check_date date := CURRENT_DATE;
  attempt_exists boolean;
BEGIN
  -- Check consecutive days backwards from today
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM daily_challenge_attempts
      WHERE user_id = p_user_id
        AND challenge_date = check_date
        AND completed = true
    ) INTO attempt_exists;
    
    IF attempt_exists THEN
      streak := streak + 1;
      check_date := check_date - 1;
    ELSE
      -- If today has no attempt, check if yesterday was completed (streak still valid)
      IF check_date = CURRENT_DATE THEN
        check_date := check_date - 1;
      ELSE
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN streak;
END;
$$;

-- Function to generate or get today's challenge
CREATE OR REPLACE FUNCTION public.get_or_create_daily_challenge()
RETURNS public.daily_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge public.daily_challenges;
  today date := CURRENT_DATE;
  seed integer;
  letters text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','R','S','T','U','V','W','Y'];
  vowels text[] := ARRAY['A','E','I','O','U'];
  consonants text[] := ARRAY['B','C','D','F','G','H','J','K','L','M','N','P','R','S','T','V','W','Y'];
  grid jsonb := '[]'::jsonb;
  letter_seq jsonb := '[]'::jsonb;
  i integer;
  row_data jsonb;
  rand_idx integer;
BEGIN
  -- Try to get existing challenge
  SELECT * INTO challenge FROM daily_challenges WHERE challenge_date = today;
  
  IF challenge.id IS NOT NULL THEN
    RETURN challenge;
  END IF;
  
  -- Generate deterministic seed from date
  seed := (EXTRACT(YEAR FROM today) * 10000 + EXTRACT(MONTH FROM today) * 100 + EXTRACT(DAY FROM today))::integer;
  PERFORM setseed(seed::float / 100000000);
  
  -- Generate 5x5 starting grid with 5 letters (2 vowels, 3 consonants)
  grid := '[
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null]
  ]'::jsonb;
  
  -- Place 2 vowels and 3 consonants in random positions
  FOR i IN 1..5 LOOP
    rand_idx := floor(random() * 25)::integer;
    IF i <= 2 THEN
      -- Place vowel
      grid := jsonb_set(grid, ARRAY[(rand_idx / 5)::text, (rand_idx % 5)::text], 
        to_jsonb(vowels[1 + floor(random() * array_length(vowels, 1))::integer]));
    ELSE
      -- Place consonant
      grid := jsonb_set(grid, ARRAY[(rand_idx / 5)::text, (rand_idx % 5)::text],
        to_jsonb(consonants[1 + floor(random() * array_length(consonants, 1))::integer]));
    END IF;
  END LOOP;
  
  -- Generate letter sequence (20 letters for remaining moves)
  FOR i IN 1..20 LOOP
    letter_seq := letter_seq || to_jsonb(letters[1 + floor(random() * array_length(letters, 1))::integer]);
  END LOOP;
  
  -- Insert new challenge
  INSERT INTO daily_challenges (challenge_date, starting_grid, letter_sequence)
  VALUES (today, grid, letter_seq)
  RETURNING * INTO challenge;
  
  RETURN challenge;
END;
$$;