-- Update the handle_new_game function to use all 26 letters like single player
CREATE OR REPLACE FUNCTION public.handle_new_game()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    all_letters TEXT[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
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
    
    -- Use all 26 letters like single player
    NEW.letter_pool := to_jsonb(all_letters);
    
    -- Generate 5 starting tiles using common letters (one letter per row at random column)
    FOR i IN 0..LEAST(4, NEW.board_size - 1) LOOP
        random_letter := common_letters[floor(random() * array_length(common_letters, 1) + 1)];
        selected_letters := array_append(selected_letters, random_letter);
        
        tile_data := jsonb_build_object(
            'row', i,
            'col', floor(random() * NEW.board_size),
            'letter', random_letter
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