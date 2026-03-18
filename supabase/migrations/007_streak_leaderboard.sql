-- Streak Leaderboard RPC: Consecutive days with at least one correct answer
-- Logic:
--   - "streak" = number of consecutive calendar days with >= 1 correct answer
--   - If user answered correctly today, streak counts backwards from today.
--   - If user answered correctly yesterday but NOT today, streak counts backwards
--     from yesterday and is marked "at_risk" (they can extend it today).
--   - If last correct answer was 2+ days ago, streak = 0.
-- Returns top 10 by streak + requesting user's data.

CREATE OR REPLACE FUNCTION get_streak_leaderboard(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH user_active_days AS (
    SELECT DISTINCT
      ur.user_id,
      (ur.created_at AT TIME ZONE 'UTC')::date AS active_date
    FROM user_responses ur
    WHERE ur.is_correct = true
  ),
  user_flags AS (
    SELECT
      u.user_id,
      p.display_name,
      EXISTS (
        SELECT 1 FROM user_active_days d
        WHERE d.user_id = u.user_id AND d.active_date = CURRENT_DATE
      ) AS answered_today,
      EXISTS (
        SELECT 1 FROM user_active_days d
        WHERE d.user_id = u.user_id AND d.active_date = CURRENT_DATE - 1
      ) AS answered_yesterday
    FROM (SELECT DISTINCT user_id FROM user_active_days) u
    JOIN profiles p ON p.id = u.user_id
  ),
  streak_calc AS (
    SELECT
      uf.user_id,
      uf.display_name,
      uf.answered_today,
      uf.answered_yesterday,
      CASE
        WHEN NOT uf.answered_today AND NOT uf.answered_yesterday THEN 0
        ELSE (
          -- Count consecutive days backwards using recursive-like approach:
          -- anchor = today if answered_today, else yesterday
          -- then count how many consecutive prior days also exist
          SELECT COUNT(*)::int
          FROM (
            SELECT d.active_date
            FROM user_active_days d
            WHERE d.user_id = uf.user_id
              AND d.active_date <= CASE WHEN uf.answered_today THEN CURRENT_DATE ELSE CURRENT_DATE - 1 END
            ORDER BY d.active_date DESC
          ) consecutive
          WHERE consecutive.active_date = (
            CASE WHEN uf.answered_today THEN CURRENT_DATE ELSE CURRENT_DATE - 1 END
          ) - (
            -- row_number - 1 gives offset from anchor; we need the date to match anchor - offset
            -- but we can't use row_number here easily, so use a different approach
            (CASE WHEN uf.answered_today THEN CURRENT_DATE ELSE CURRENT_DATE - 1 END) - consecutive.active_date
          )
        )
      END AS streak
    FROM user_flags uf
  ),
  -- Actually let's do the streak properly with a recursive CTE per user
  -- Recompute using a simpler gap-and-island technique
  numbered_days AS (
    SELECT
      d.user_id,
      d.active_date,
      d.active_date - (ROW_NUMBER() OVER (PARTITION BY d.user_id ORDER BY d.active_date))::int AS grp
    FROM user_active_days d
  ),
  islands AS (
    SELECT
      user_id,
      grp,
      MIN(active_date) AS island_start,
      MAX(active_date) AS island_end,
      COUNT(*)::int AS island_length
    FROM numbered_days
    GROUP BY user_id, grp
  ),
  user_streaks AS (
    SELECT
      uf.user_id,
      uf.display_name,
      uf.answered_today,
      uf.answered_yesterday,
      COALESCE(
        (
          SELECT i.island_length
          FROM islands i
          WHERE i.user_id = uf.user_id
            AND (
              -- island includes today
              i.island_end = CURRENT_DATE
              -- or island includes yesterday (at-risk streak)
              OR (i.island_end = CURRENT_DATE - 1 AND NOT uf.answered_today)
            )
          ORDER BY i.island_length DESC
          LIMIT 1
        ),
        0
      ) AS streak
    FROM user_flags uf
  ),
  ranked AS (
    SELECT
      us.*,
      ROW_NUMBER() OVER (ORDER BY us.streak DESC, us.display_name ASC) AS rank
    FROM user_streaks us
    WHERE us.streak > 0
  ),
  top10 AS (
    SELECT * FROM ranked WHERE rank <= 10
  ),
  current_user_data AS (
    SELECT * FROM ranked WHERE user_id = p_user_id
  ),
  current_user_fallback AS (
    SELECT
      p_user_id AS user_id,
      p.display_name,
      false AS answered_today,
      EXISTS (
        SELECT 1 FROM user_active_days d
        WHERE d.user_id = p_user_id AND d.active_date = CURRENT_DATE - 1
      ) AS answered_yesterday,
      0 AS streak,
      NULL::bigint AS rank
    FROM profiles p
    WHERE p.id = p_user_id
      AND NOT EXISTS (SELECT 1 FROM current_user_data)
  )
  SELECT json_build_object(
    'leaderboard', (SELECT COALESCE(json_agg(json_build_object(
      'user_id', t.user_id,
      'display_name', t.display_name,
      'streak', t.streak,
      'answered_today', t.answered_today,
      'rank', t.rank
    ) ORDER BY t.rank), '[]'::json) FROM top10 t),
    'current_user', (
      SELECT json_build_object(
        'user_id', COALESCE(cu.user_id, cf.user_id),
        'display_name', COALESCE(cu.display_name, cf.display_name),
        'streak', COALESCE(cu.streak, cf.streak),
        'answered_today', COALESCE(cu.answered_today, cf.answered_today),
        'answered_yesterday', COALESCE(cu.answered_yesterday, cf.answered_yesterday),
        'rank', cu.rank
      )
      FROM (SELECT 1) x
      LEFT JOIN current_user_data cu ON true
      LEFT JOIN current_user_fallback cf ON true
      WHERE cu.user_id IS NOT NULL OR cf.user_id IS NOT NULL
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
