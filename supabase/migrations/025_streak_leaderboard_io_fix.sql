-- Migration: replace get_streak_leaderboard() / get_streak_reminder_targets()'s
-- recompute-from-scratch design with an incrementally maintained streak table.
--
-- Both functions scanned the ENTIRE history of user_responses and
-- answer_events, for EVERY user, with no date filter at all - unlike
-- get_leaderboard(), which correctly windows to 7 days. Every call
-- recomputed every user's lifetime streak from scratch, and cost only grew
-- as answer history accumulated.
--
-- Measured at a modest future-scale test (300 users, ~250 days of history,
-- 85k rows - nowhere near eventual scale): get_streak_leaderboard() took
-- 9.65s and spilled 166k temp-file pages to disk.
--
-- A time-windowed version was tried first (cap the lookback, same shape of
-- query) and got that down to ~140-340ms, but it can only ever show a
-- truncated number for a streak longer than the window - an approximation,
-- not a fix. This version instead maintains a tiny per-user
-- `user_streak_state` row (current_streak, last_active_date), bumped
-- incrementally by record_answer()/daily-challenge completion exactly the
-- way `first_is_correct` and `review_chain` are already maintained
-- elsewhere in this schema, instead of recomputed from full history on
-- every read. The leaderboard query becomes a scan of one row per USER
-- (bounded forever, however large answer history gets) instead of one row
-- per ANSWER ever given - exact numbers, no window, no truncation, and
-- cheaper than the windowed version too.

-- ---------------------------------------------------------------------------
-- 1. Streak state table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_streak_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_streak_state IS
  'One row per user: streak as of last_active_date. A streak only counts as currently alive if last_active_date is today or yesterday - read it that way rather than trusting current_streak blindly, since a long-inactive user''s row is never proactively reset to 0.';

ALTER TABLE user_streak_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_streak_state FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Increment helper - called from record_answer() and the daily-challenge
--    completion trigger, never directly by clients.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_user_streak(p_user_id UUID, p_active_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO user_streak_state (user_id, current_streak, last_active_date)
  VALUES (p_user_id, 1, p_active_date)
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = CASE
      WHEN user_streak_state.last_active_date = p_active_date THEN user_streak_state.current_streak
      WHEN user_streak_state.last_active_date = p_active_date - 1 THEN user_streak_state.current_streak + 1
      WHEN user_streak_state.last_active_date > p_active_date THEN user_streak_state.current_streak
      ELSE 1
    END,
    last_active_date = GREATEST(user_streak_state.last_active_date, p_active_date),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION bump_user_streak(UUID, DATE) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Backfill: one-time computation from full history (same shape as the
--    old unbounded query), so existing users keep their current streak.
--    This is the only place this codebase ever scans full answer history -
--    once, at migration time, never again on a read path.
-- ---------------------------------------------------------------------------
INSERT INTO user_streak_state (user_id, current_streak, last_active_date)
WITH user_active_days AS (
  SELECT DISTINCT
    ur.user_id,
    (ur.created_at AT TIME ZONE 'UTC')::date AS active_date
  FROM user_responses ur
  WHERE ur.is_correct = true

  UNION

  SELECT DISTINCT
    ae.user_id,
    (ae.answered_at AT TIME ZONE 'UTC')::date AS active_date
  FROM answer_events ae
  WHERE ae.source = 'review' AND ae.is_correct = true

  UNION

  SELECT
    dcr.user_id,
    dcr.challenge_date AS active_date
  FROM daily_challenge_responses dcr
  GROUP BY dcr.user_id, dcr.challenge_date
  HAVING COUNT(*) = 10
),
numbered_days AS (
  SELECT
    user_id,
    active_date,
    active_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY active_date))::int AS grp
  FROM user_active_days
),
islands AS (
  SELECT user_id, grp, MAX(active_date) AS island_end, COUNT(*)::int AS island_length
  FROM numbered_days
  GROUP BY user_id, grp
),
latest_island AS (
  SELECT DISTINCT ON (user_id) user_id, island_end, island_length
  FROM islands
  ORDER BY user_id, island_end DESC
)
SELECT user_id, island_length, island_end FROM latest_island
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. record_answer(): same signature/behaviour as 023, now also bumps the
--    streak on every genuinely new correct fresh answer, correct review, or
--    corrected practice mistake - exactly the events the old unbounded
--    query treated as "active days".
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_answer(
  p_question_id UUID,
  p_is_correct BOOLEAN,
  p_mode TEXT DEFAULT 'fresh',
  p_served_reason TEXT DEFAULT 'random',
  p_session_pos INT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_chain SMALLINT;
  v_inserted INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_mode = 'fresh' THEN
    PERFORM set_config('app.served_reason', COALESCE(p_served_reason, 'random'), true);
    PERFORM set_config('app.session_pos', COALESCE(p_session_pos::TEXT, ''), true);

    INSERT INTO user_responses (user_id, question_id, is_correct)
    VALUES (v_uid, p_question_id, p_is_correct)
    ON CONFLICT (user_id, question_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    PERFORM set_config('app.served_reason', '', true);
    PERFORM set_config('app.session_pos', '', true);

    -- Already answered: keep the first answer, but leave a trace.
    IF v_inserted = 0 THEN
      INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos)
      VALUES (v_uid, p_question_id, p_is_correct, 'fresh', 'duplicate_fresh', p_session_pos);
    ELSIF p_is_correct THEN
      PERFORM bump_user_streak(v_uid, (now() AT TIME ZONE 'UTC')::date);
    END IF;

  ELSIF p_mode = 'review' THEN
    SELECT review_chain INTO v_chain
    FROM user_responses
    WHERE user_id = v_uid AND question_id = p_question_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos)
    VALUES (v_uid, p_question_id, p_is_correct, 'review',
            COALESCE(p_served_reason, 'review_due'), p_session_pos);

    IF p_is_correct THEN
      PERFORM bump_user_streak(v_uid, (now() AT TIME ZONE 'UTC')::date);
    END IF;

    v_chain := CASE WHEN p_is_correct THEN LEAST(v_chain + 1, 3) ELSE 0 END;

    UPDATE user_responses
    SET review_chain = v_chain,
        review_due_at = CASE
          WHEN NOT p_is_correct THEN now() + INTERVAL '7 days'
          WHEN v_chain = 1 THEN now() + INTERVAL '60 days'
          WHEN v_chain = 2 THEN now() + INTERVAL '180 days'
          ELSE NULL
        END,
        last_reviewed_at = now(),
        review_count = review_count + 1,
        review_forced = false
    WHERE user_id = v_uid AND question_id = p_question_id;

  ELSIF p_mode = 'practice' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_responses
      WHERE user_id = v_uid AND question_id = p_question_id AND NOT is_correct
    ) THEN
      RETURN;
    END IF;

    INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos)
    VALUES (v_uid, p_question_id, p_is_correct, 'practice', 'practice', p_session_pos);

    IF p_is_correct THEN
      -- created_at is still bumped: streaks read activity dates from it.
      UPDATE user_responses
      SET is_correct = true, created_at = now(), mistake_resolved_at = now()
      WHERE user_id = v_uid AND question_id = p_question_id AND NOT is_correct;

      PERFORM bump_user_streak(v_uid, (now() AT TIME ZONE 'UTC')::date);
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown mode %', p_mode;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Daily challenge completion also bumps the streak (10th response of the
--    day, matching the old HAVING COUNT(*) = 10 condition).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION daily_challenge_bump_streak()
RETURNS trigger AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM daily_challenge_responses
  WHERE user_id = NEW.user_id AND challenge_date = NEW.challenge_date;

  IF v_count = 10 THEN
    PERFORM bump_user_streak(NEW.user_id, NEW.challenge_date);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS daily_challenge_responses_bump_streak ON daily_challenge_responses;
CREATE TRIGGER daily_challenge_responses_bump_streak
  AFTER INSERT ON daily_challenge_responses
  FOR EACH ROW EXECUTE FUNCTION daily_challenge_bump_streak();

REVOKE EXECUTE ON FUNCTION daily_challenge_bump_streak() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_streak_leaderboard() / get_streak_reminder_targets(): now a scan of
--    one row per user instead of one row per answer ever given. Same output
--    shape as before (021/013), numbers are exact, no cap.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_streak_leaderboard(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH live AS (
    SELECT
      s.user_id,
      p.display_name,
      CASE WHEN s.last_active_date >= CURRENT_DATE - 1 THEN s.current_streak ELSE 0 END AS streak,
      (s.last_active_date = CURRENT_DATE) AS answered_today,
      (s.last_active_date = CURRENT_DATE - 1) AS answered_yesterday
    FROM user_streak_state s
    JOIN profiles p ON p.id = s.user_id
  ),
  ranked AS (
    SELECT l.*, ROW_NUMBER() OVER (ORDER BY l.streak DESC, l.display_name ASC) AS rank
    FROM live l
    WHERE l.streak > 0
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
      0 AS streak,
      false AS answered_today,
      COALESCE(s.last_active_date = CURRENT_DATE - 1, false) AS answered_yesterday,
      NULL::bigint AS rank
    FROM profiles p
    LEFT JOIN user_streak_state s ON s.user_id = p_user_id
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

CREATE OR REPLACE FUNCTION get_streak_reminder_targets()
RETURNS TABLE (user_id UUID, endpoint TEXT, p256dh TEXT, auth TEXT, streak INT) AS $$
  SELECT s.user_id, ps.endpoint, ps.p256dh, ps.auth, s.current_streak::int
  FROM user_streak_state s
  JOIN push_subscriptions ps ON ps.user_id = s.user_id
  WHERE s.last_active_date = CURRENT_DATE - 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_streak_reminder_targets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_streak_reminder_targets() TO service_role;
