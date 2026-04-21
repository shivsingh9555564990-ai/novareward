
-- Drop the view we created in the previous attempt (if it exists)
DROP VIEW IF EXISTS public.public_leaderboard;

-- Security-definer function returning only the safe leaderboard columns.
-- This bypasses RLS in a controlled way and only exposes name + avatar + coins.
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit integer DEFAULT 100)
RETURNS TABLE(rank bigint, user_id uuid, name text, avatar_url text, coins integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.coins DESC, p.created_at ASC) AS rank,
    p.id AS user_id,
    COALESCE(NULLIF(p.full_name, ''), 'Nova Explorer') AS name,
    p.avatar_url,
    p.coins
  FROM public.profiles p
  WHERE p.coins > 0
  ORDER BY p.coins DESC, p.created_at ASC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated, anon;
