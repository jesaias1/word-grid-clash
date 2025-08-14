-- Fix the create_empty_grid function that's being called incorrectly
DROP FUNCTION IF EXISTS public.create_empty_grid();

-- Update the create_empty_grid function to work with variable size
CREATE OR REPLACE FUNCTION public.create_empty_grid(grid_size integer DEFAULT 5)
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

-- Add a trigger to fix existing games with wrong grid sizes
CREATE OR REPLACE FUNCTION public.fix_game_grids()
RETURNS trigger AS $$
BEGIN
    -- If the grid size doesn't match the board_size, recreate the grids
    IF (
        jsonb_array_length(NEW.player1_grid) != NEW.board_size OR
        jsonb_array_length(NEW.player2_grid) != NEW.board_size
    ) THEN
        NEW.player1_grid := create_empty_grid(NEW.board_size);
        NEW.player2_grid := create_empty_grid(NEW.board_size);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fix_game_grids
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.fix_game_grids();