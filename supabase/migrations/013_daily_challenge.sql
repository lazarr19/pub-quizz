-- Migration: Daily challenge - a shared set of 10 questions, same for every user, once per day.
-- Completing all 10 (regardless of score) counts as an "active day" for the existing streak system.

-- 1. Tables
CREATE TABLE daily_challenges (
  challenge_date DATE PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_challenge_questions (
  challenge_date DATE NOT NULL REFERENCES daily_challenges(challenge_date) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 10),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (challenge_date, position),
  UNIQUE (challenge_date, question_id)
);

CREATE TABLE daily_challenge_responses (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL REFERENCES daily_challenges(challenge_date) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option SMALLINT NOT NULL CHECK (selected_option BETWEEN 1 AND 3),
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_date, question_id)
);

-- 2. RLS
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read daily_challenges" ON daily_challenges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read daily_challenge_questions" ON daily_challenge_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can read own daily_challenge_responses" ON daily_challenge_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_challenge_responses" ON daily_challenge_responses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND challenge_date = CURRENT_DATE
    AND EXISTS (
      SELECT 1 FROM daily_challenge_questions dcq
      WHERE dcq.challenge_date = daily_challenge_responses.challenge_date
        AND dcq.question_id = daily_challenge_responses.question_id
    )
  );

-- 3. Lazily create today's challenge (10 random questions not used in any past daily challenge).
-- Race-safe: concurrent first-callers may both attempt to insert; ON CONFLICT DO NOTHING
-- means only one set of 10 ends up persisted.
-- Once the never-used pool runs low, top up with previously-used questions so the
-- day's set always has 10 (as long as the overall question bank has >= 10 questions).
CREATE OR REPLACE FUNCTION get_or_create_daily_challenge()
RETURNS DATE AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO daily_challenges (challenge_date)
  VALUES (v_date)
  ON CONFLICT (challenge_date) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM daily_challenge_questions WHERE challenge_date = v_date
  ) THEN
    INSERT INTO daily_challenge_questions (challenge_date, position, question_id)
    SELECT v_date, (row_number() OVER ())::smallint, id
    FROM (
      SELECT id FROM questions
      WHERE id NOT IN (SELECT question_id FROM daily_challenge_questions)
      ORDER BY random()
      LIMIT 10
    ) unused
    ON CONFLICT DO NOTHING;

    SELECT count(*) INTO v_count
    FROM daily_challenge_questions WHERE challenge_date = v_date;

    IF v_count < 10 THEN
      INSERT INTO daily_challenge_questions (challenge_date, position, question_id)
      SELECT v_date, (v_count + row_number() OVER ())::smallint, id
      FROM (
        SELECT id FROM questions
        WHERE id NOT IN (
          SELECT question_id FROM daily_challenge_questions WHERE challenge_date = v_date
        )
        ORDER BY random()
        LIMIT (10 - v_count)
      ) fallback
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Fetch today's challenge: questions, the caller's own progress, and light community stats
CREATE OR REPLACE FUNCTION get_daily_challenge(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_date DATE;
  result JSON;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_date := get_or_create_daily_challenge();

  SELECT json_build_object(
    'challenge_date', v_date,
    'questions', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', q.id,
        'category_id', q.category_id,
        'type', q.type,
        'content', q.content,
        'image_url', q.image_url,
        'option_1', q.option_1,
        'option_2', q.option_2,
        'option_3', q.option_3,
        'correct_option', q.correct_option
      ) ORDER BY dcq.position), '[]'::json)
      FROM daily_challenge_questions dcq
      JOIN questions q ON q.id = dcq.question_id
      WHERE dcq.challenge_date = v_date
    ),
    'responses', (
      SELECT COALESCE(json_agg(json_build_object(
        'question_id', r.question_id,
        'selected_option', r.selected_option,
        'is_correct', r.is_correct
      )), '[]'::json)
      FROM daily_challenge_responses r
      WHERE r.challenge_date = v_date AND r.user_id = p_user_id
    ),
    'stats', (
      SELECT json_build_object(
        'completed_count', COALESCE(COUNT(DISTINCT sub.user_id), 0),
        'avg_score', COALESCE(ROUND(AVG(sub.correct_count), 1), 0)
      )
      FROM (
        SELECT r.user_id, COUNT(*) FILTER (WHERE r.is_correct) AS correct_count
        FROM daily_challenge_responses r
        WHERE r.challenge_date = v_date
        GROUP BY r.user_id
        HAVING COUNT(*) = 10
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Fold daily-challenge completion into the existing streak calculation:
-- an "active day" now also includes any day the user answered all 10 daily
-- challenge questions (regardless of correctness), alongside the existing
-- "at least one correct practice answer" rule.
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

    UNION

    SELECT
      dcr.user_id,
      dcr.challenge_date AS active_date
    FROM daily_challenge_responses dcr
    GROUP BY dcr.user_id, dcr.challenge_date
    HAVING COUNT(*) = 10
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
              i.island_end = CURRENT_DATE
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Fold daily-challenge correct answers into the 7-day accuracy leaderboard too
CREATE OR REPLACE FUNCTION get_leaderboard(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH combined_correct AS (
    SELECT ur.user_id
    FROM user_responses ur
    WHERE ur.is_correct = true
      AND ur.created_at >= now() - interval '7 days'

    UNION ALL

    SELECT dcr.user_id
    FROM daily_challenge_responses dcr
    WHERE dcr.is_correct = true
      AND dcr.created_at >= now() - interval '7 days'
  ),
  ranked AS (
    SELECT
      p.id AS user_id,
      p.display_name,
      COUNT(*) AS correct_count,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, p.display_name ASC) AS rank
    FROM combined_correct cc
    JOIN profiles p ON p.id = cc.user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Daily-challenge-only streak (separate from the general practice streak):
-- consecutive calendar days where the user completed all 10 daily challenge
-- questions, regardless of score.
CREATE OR REPLACE FUNCTION get_daily_challenge_streak(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH completed_days AS (
    SELECT dcr.challenge_date AS active_date
    FROM daily_challenge_responses dcr
    WHERE dcr.user_id = p_user_id
    GROUP BY dcr.challenge_date
    HAVING COUNT(*) = 10
  ),
  numbered AS (
    SELECT
      active_date,
      active_date - (ROW_NUMBER() OVER (ORDER BY active_date))::int AS grp
    FROM completed_days
  ),
  islands AS (
    SELECT
      grp,
      MAX(active_date) AS island_end,
      COUNT(*)::int AS island_length
    FROM numbered
    GROUP BY grp
  ),
  flags AS (
    SELECT
      EXISTS (SELECT 1 FROM completed_days WHERE active_date = CURRENT_DATE) AS completed_today
  )
  SELECT json_build_object(
    'streak', COALESCE((
      SELECT i.island_length
      FROM islands i, flags f
      WHERE i.island_end = CURRENT_DATE
         OR (i.island_end = CURRENT_DATE - 1 AND NOT f.completed_today)
      ORDER BY i.island_length DESC
      LIMIT 1
    ), 0),
    'completed_today', (SELECT completed_today FROM flags)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
