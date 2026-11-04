-- Migration: Question serving v2 - Phase 3 (polish)
--
-- 1. Daily challenge runs easy -> hard: selection is unchanged (10 random
--    never-used questions, topped up from used ones when the pool runs low), but
--    positions are now numbered by difficulty_score, easiest first. Questions not
--    yet in question_stats (added since the last nightly refresh) count as average.
--    get_or_create_daily_challenge() and ensure_daily_challenge() previously
--    duplicated the creation logic; both now call fill_daily_challenge().
-- 2. get_player_stats() gains due_reviews (questions currently due for a review
--    in each category), so the lobby can show finished categories that still
--    have questions to repeat.

-- ---------------------------------------------------------------------------
-- 1. Daily challenge
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fill_daily_challenge(p_date DATE)
RETURNS void AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO daily_challenges (challenge_date)
  VALUES (p_date)
  ON CONFLICT (challenge_date) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM daily_challenge_questions WHERE challenge_date = p_date
  ) THEN
    RETURN;
  END IF;

  -- Race-safe as before: a concurrent caller's identical positions conflict and
  -- are dropped, so only one set of 10 persists.
  INSERT INTO daily_challenge_questions (challenge_date, position, question_id)
  SELECT
    p_date,
    (ROW_NUMBER() OVER (
      ORDER BY COALESCE(qs.difficulty_score, 0.67) DESC, pool.id
    ))::SMALLINT,
    pool.id
  FROM (
    SELECT q.id FROM questions q
    WHERE q.id NOT IN (SELECT dcq.question_id FROM daily_challenge_questions dcq)
    ORDER BY random()
    LIMIT 10
  ) pool
  LEFT JOIN question_stats qs ON qs.question_id = pool.id
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_count
  FROM daily_challenge_questions WHERE challenge_date = p_date;

  -- Top-up once the never-used pool runs low (appended after the ordered part).
  IF v_count < 10 THEN
    INSERT INTO daily_challenge_questions (challenge_date, position, question_id)
    SELECT
      p_date,
      (v_count + ROW_NUMBER() OVER (
        ORDER BY COALESCE(qs.difficulty_score, 0.67) DESC, fallback.id
      ))::SMALLINT,
      fallback.id
    FROM (
      SELECT q.id FROM questions q
      WHERE q.id NOT IN (
        SELECT dcq.question_id FROM daily_challenge_questions dcq
        WHERE dcq.challenge_date = p_date
      )
      ORDER BY random()
      LIMIT (10 - v_count)
    ) fallback
    LEFT JOIN question_stats qs ON qs.question_id = fallback.id
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION fill_daily_challenge(DATE) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION get_or_create_daily_challenge()
RETURNS DATE AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM fill_daily_challenge(v_date);
  RETURN v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION ensure_daily_challenge()
RETURNS DATE AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
BEGIN
  PERFORM fill_daily_challenge(v_date);
  RETURN v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION ensure_daily_challenge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ensure_daily_challenge() TO service_role;

-- ---------------------------------------------------------------------------
-- 2. get_player_stats + due_reviews (return type changes, so drop + create)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_player_stats(UUID);

CREATE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  total_questions BIGINT,
  answered BIGINT,
  correct BIGINT,
  due_reviews BIGINT
) AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS category_id,
    c.name AS category_name,
    COUNT(DISTINCT q.id) AS total_questions,
    COUNT(DISTINCT ur.question_id) AS answered,
    COUNT(DISTINCT CASE WHEN ur.is_correct THEN ur.question_id END) AS correct,
    COUNT(DISTINCT CASE WHEN ur.review_due_at <= now() THEN ur.question_id END) AS due_reviews
  FROM categories c
  LEFT JOIN questions q ON q.category_id = c.id
  LEFT JOIN user_responses ur ON ur.question_id = q.id AND ur.user_id = p_user_id
  GROUP BY c.id, c.name
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_player_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_player_stats(UUID) TO authenticated;
