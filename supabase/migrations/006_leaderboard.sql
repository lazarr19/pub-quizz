-- Leaderboard RPC: Top players by correct answers in the last 7 days
-- Returns the top 10 + the requesting user's rank/score (even if outside top 10)

CREATE OR REPLACE FUNCTION get_leaderboard(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH ranked AS (
    SELECT
      p.id AS user_id,
      p.display_name,
      COUNT(*) AS correct_count,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, p.display_name ASC) AS rank
    FROM user_responses ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.is_correct = true
      AND ur.created_at >= now() - interval '7 days'
    GROUP BY p.id, p.display_name
  ),
  top10 AS (
    SELECT * FROM ranked WHERE rank <= 10
  ),
  current_user_rank AS (
    SELECT * FROM ranked WHERE user_id = p_user_id
  )
  SELECT json_build_object(
    'leaderboard', (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.rank), '[]'::json) FROM top10 t),
    'current_user', (SELECT row_to_json(c) FROM current_user_rank c)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
