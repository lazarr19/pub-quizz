-- Migration: Web push notifications infrastructure.
-- One row per browser/device a user has opted into push notifications on.

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own push_subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push_subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push_subscriptions" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push_subscriptions" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Server-only (service_role) function used by the daily cron job: subscriptions
-- belonging to users whose general streak (same definition as get_streak_leaderboard)
-- is still alive but who haven't been active yet today, i.e. they'll lose it if they
-- don't play today. Never exposed to authenticated/anon clients.
CREATE OR REPLACE FUNCTION get_streak_reminder_targets()
RETURNS TABLE (user_id UUID, endpoint TEXT, p256dh TEXT, auth TEXT, streak INT) AS $$
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
      MAX(active_date) AS island_end,
      COUNT(*)::int AS island_length
    FROM numbered_days
    GROUP BY user_id, grp
  ),
  current_streaks AS (
    -- Island ending exactly yesterday = streak still alive, not extended today yet.
    SELECT user_id, island_length AS streak
    FROM islands
    WHERE island_end = CURRENT_DATE - 1
  )
  SELECT ps.user_id, ps.endpoint, ps.p256dh, ps.auth, cs.streak::int
  FROM current_streaks cs
  JOIN push_subscriptions ps ON ps.user_id = cs.user_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_streak_reminder_targets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_streak_reminder_targets() TO service_role;

-- Same creation logic as get_or_create_daily_challenge(), minus the auth.uid() check,
-- so the morning cron job (running as service_role, no user session) can pre-create
-- today's challenge before notifying subscribers. Never exposed to clients.
CREATE OR REPLACE FUNCTION ensure_daily_challenge()
RETURNS DATE AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_count INT;
BEGIN
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
    ) pool
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

REVOKE EXECUTE ON FUNCTION ensure_daily_challenge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ensure_daily_challenge() TO service_role;
