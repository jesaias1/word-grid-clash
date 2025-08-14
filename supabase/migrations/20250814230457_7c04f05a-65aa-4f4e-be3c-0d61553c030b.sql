-- Add board_size column to games table to support different game modes
ALTER TABLE public.games ADD COLUMN board_size INTEGER NOT NULL DEFAULT 5;

-- Update the create_empty_grid function to support different board sizes
CREATE OR REPLACE FUNCTION public.create_empty_grid(grid_size INTEGER DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    grid JSONB := '[]';
    row_data JSONB;
    i INTEGER;
    j INTEGER;
BEGIN
    FOR i IN 0..(grid_size - 1) LOOP
        row_data := '[]';
        FOR j IN 0..(grid_size - 1) LOOP
            row_data := row_data || '{"letter": null, "player": null}';
        END LOOP;
        grid := grid || jsonb_build_array(row_data);
    END LOOP;
    RETURN grid;
END;
$function$;

-- Update the handle_new_game trigger to use the board_size
CREATE OR REPLACE FUNCTION public.handle_new_game()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
        NEW.invite_code := generate_invite_code();
    END IF;
    
    IF NEW.player1_grid = '[]' THEN
        NEW.player1_grid := create_empty_grid(NEW.board_size);
    END IF;
    
    IF NEW.player2_grid = '[]' THEN
        NEW.player2_grid := create_empty_grid(NEW.board_size);
    END IF;
    
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;