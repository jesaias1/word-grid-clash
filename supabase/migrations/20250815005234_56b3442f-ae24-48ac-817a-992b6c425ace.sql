-- Add letter_pool column to games table to store the 5 available letters
ALTER TABLE public.games 
ADD COLUMN letter_pool jsonb NOT NULL DEFAULT '["A","B","C","D","E"]'::jsonb;

-- Add starting_tiles column to store the initial tiles placement
ALTER TABLE public.games 
ADD COLUMN starting_tiles jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Update the handle_new_game function to generate 5 random letters and starting tiles
CREATE OR REPLACE FUNCTION public.handle_new_game()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    common_letters TEXT[] := ARRAY['A', 'E', 'I', 'O', 'U', 'R', 'S', 'T', 'L', 'N'];
    selected_letters TEXT[] := ARRAY[]::TEXT[];
    starting_tiles JSONB := '[]'::jsonb;
    i INTEGER;
    random_letter TEXT;
    tile_data JSONB;
BEGIN
    IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
        NEW.invite_code := generate_invite_code();
    END IF;
    
    -- Generate 5 random letters from common letters
    FOR i IN 1..5 LOOP
        random_letter := common_letters[floor(random() * array_length(common_letters, 1) + 1)];
        selected_letters := array_append(selected_letters, random_letter);
    END LOOP;
    
    NEW.letter_pool := to_jsonb(selected_letters);
    
    -- Generate starting tiles (one letter per row at random column)
    FOR i IN 0..LEAST(4, NEW.board_size - 1) LOOP
        tile_data := jsonb_build_object(
            'row', i,
            'col', floor(random() * NEW.board_size),
            'letter', selected_letters[i + 1]
        );
        starting_tiles := starting_tiles || jsonb_build_array(tile_data);
    END LOOP;
    
    NEW.starting_tiles := starting_tiles;
    
    IF NEW.player1_grid = '[]'::jsonb THEN
        NEW.player1_grid := create_empty_grid(NEW.board_size);
    END IF;
    
    IF NEW.player2_grid = '[]'::jsonb THEN
        NEW.player2_grid := create_empty_grid(NEW.board_size);
    END IF;
    
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;