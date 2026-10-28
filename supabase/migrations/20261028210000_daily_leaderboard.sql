-- Daily Challenge leaderboard.
-- Attempts stay private under RLS (users only read their own rows); the
-- leaderboard is served by a SECURITY DEFINER function that exposes ranks,
-- display names and scores, never user ids.

ALTER TABLE public.daily_challenge_attempts
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.daily_challenge_attempts
  DROP CONSTRAINT IF EXISTS daily_challenge_attempts_display_name_check;
ALTER TABLE public.daily_challenge_attempts
  ADD CONSTRAINT daily_challenge_attempts_display_name_check
  CHECK (display_name IS NULL OR display_name ~ '^[A-Za-z0-9 ]{2,20}$');

CREATE INDEX IF NOT EXISTS daily_challenge_attempts_board_idx
  ON public.daily_challenge_attempts (challenge_date, score DESC)
  WHERE completed = true;

-- Returns {"total": n, "me": {rank, score, beaten} | null, "top": [{rank, name, score, tier, is_me}]}
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(p_date date DEFAULT CURRENT_DATE, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      user_id,
      COALESCE(display_name, 'Anonymous Lettuce') AS name,
      score,
      COALESCE(tier_achieved, 'none') AS tier,
      rank() OVER (ORDER BY score DESC) AS rnk,
      row_number() OVER (ORDER BY score DESC, completed_at ASC) AS pos,
      count(*) OVER () AS total,
      count(*) OVER (ORDER BY score ASC RANGE BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS beaten
    FROM daily_challenge_attempts
    WHERE challenge_date = p_date AND completed = true
  )
  SELECT jsonb_build_object(
    'total', COALESCE((SELECT max(total) FROM ranked), 0),
    'me', (SELECT jsonb_build_object('rank', rnk, 'score', score, 'beaten', beaten)
           FROM ranked WHERE user_id = auth.uid()),
    'top', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'rank', rnk, 'name', name, 'score', score, 'tier', tier,
              'is_me', user_id = auth.uid()) ORDER BY pos)
           FROM ranked WHERE pos <= LEAST(GREATEST(p_limit, 1), 50)), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_leaderboard(date, integer) TO anon, authenticated;
