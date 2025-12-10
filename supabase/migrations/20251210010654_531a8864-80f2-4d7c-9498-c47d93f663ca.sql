-- Update the function to accept a date parameter
CREATE OR REPLACE FUNCTION public.get_or_create_daily_challenge(p_date date DEFAULT CURRENT_DATE)
 RETURNS daily_challenges
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  challenge public.daily_challenges;
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
  -- Try to get existing challenge for the given date
  SELECT * INTO challenge FROM daily_challenges WHERE challenge_date = p_date;
  
  IF challenge.id IS NOT NULL THEN
    RETURN challenge;
  END IF;
  
  -- Generate deterministic seed from date
  seed := (EXTRACT(YEAR FROM p_date) * 10000 + EXTRACT(MONTH FROM p_date) * 100 + EXTRACT(DAY FROM p_date))::integer;
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
  VALUES (p_date, grid, letter_seq)
  RETURNING * INTO challenge;
  
  RETURN challenge;
END;
$function$;