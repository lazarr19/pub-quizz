-- Migration: Question serving v2 - Phase 0 (data foundation, no visible behaviour change)
--
-- 1. Security: reset_category_responses / update_practice_response / get_player_stats
--    were SECURITY DEFINER with a caller-supplied p_user_id and no auth.uid() check,
--    so any client could reset or edit another user's history (user ids are exposed
--    by the leaderboard RPCs). Added the same guard every newer RPC uses.
-- 2. Immutable first-answer record on user_responses (first_is_correct,
--    first_answered_at) + mistake_resolved_at. `is_correct` / `created_at` keep their
--    current meaning (latest state, practice-corrected), so stats, leaderboards and
--    streaks are unchanged.
-- 3. answer_events: append-only log of every answer (fresh / practice, later review),
--    with why it was served. Survives category resets.
-- 4. questions.content_updated_at: answers given before a question was edited no
--    longer count toward its difficulty.
-- 5. question_stats: materialized replacement for 015's question_difficulty view.
--    Same Bayesian-shrinkage formula (k=5, validated on held-out answers 2026-11-04),
--    but computed from first answers only, excluding breaker-served answers,
--    pre-edit answers and backfilled answers of unknown first outcome.
-- 6. record_answer(): single write path for the quiz client.
--
-- If 015 was never applied, it can be skipped: this migration supersedes it.

-- ---------------------------------------------------------------------------
-- 1. Security fixes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_category_responses(
  p_user_id UUID,
  p_category_ids UUID[]
)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM user_responses
  WHERE user_id = p_user_id
    AND question_id IN (
      SELECT q.id FROM questions q WHERE q.category_id = ANY(p_category_ids)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  total_questions BIGINT,
  answered BIGINT,
  correct BIGINT
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
    COUNT(DISTINCT CASE WHEN ur.is_correct THEN ur.question_id END) AS correct
  FROM categories c
  LEFT JOIN questions q ON q.category_id = c.id
  LEFT JOIN user_responses ur ON ur.question_id = q.id AND ur.user_id = p_user_id
  GROUP BY c.id, c.name
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 2. First-answer record on user_responses
-- ---------------------------------------------------------------------------
ALTER TABLE user_responses
  ADD COLUMN IF NOT EXISTS first_is_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS first_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mistake_resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN user_responses.is_correct IS
  'Latest state: practice mode flips false -> true when a mistake is corrected. Use first_is_correct for analytics/difficulty.';
COMMENT ON COLUMN user_responses.created_at IS
  'Last activity on this row: practice mode rewrites it on correction (feeds streaks). Use first_answered_at for the original answer time.';
COMMENT ON COLUMN user_responses.first_is_correct IS
  'Outcome of the first answer, never updated. NULL = unknown (pre-2026-11 rows detected as already rewritten by practice mode).';
COMMENT ON COLUMN user_responses.first_answered_at IS
  'Time of the first answer, never updated. For backfilled rows this is created_at as of the migration (may already be a practice rewrite).';

UPDATE user_responses
SET first_is_correct = is_correct,
    first_answered_at = created_at
WHERE first_answered_at IS NULL;

-- Backfill caveat: update_practice_response has been rewriting is_correct=true and
-- created_at=now() on corrected mistakes, so the original outcome of those rows is
-- lost. They cluster into practice "sessions" (30-min gap) where every row is
-- correct, because wrong practice answers write nothing. Flag an all-correct session
-- as practice when its probability under the user's normal accuracy is < 1%
-- (n * ln(p) < ln(0.01), p from the user's sessions that contain a miss), and mark
-- those first outcomes as unknown rather than guessing either way.
WITH seq AS (
  SELECT
    user_id, question_id, is_correct, created_at,
    CASE
      WHEN lag(created_at) OVER w IS NULL
        OR created_at - lag(created_at) OVER w > INTERVAL '30 minutes'
      THEN 1 ELSE 0
    END AS starts_session
  FROM user_responses
  WINDOW w AS (PARTITION BY user_id ORDER BY created_at, question_id)
),
sess AS (
  SELECT *, SUM(starts_session) OVER (
    PARTITION BY user_id ORDER BY created_at, question_id
  ) AS sid
  FROM seq
),
sess_agg AS (
  SELECT user_id, sid,
         COUNT(*) AS n,
         BOOL_AND(is_correct) AS all_correct,
         SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) AS c
  FROM sess
  GROUP BY user_id, sid
),
base AS (
  SELECT user_id, SUM(c)::NUMERIC / SUM(n) AS p
  FROM sess_agg
  WHERE NOT all_correct
  GROUP BY user_id
),
flagged AS (
  SELECT s.user_id, s.sid
  FROM sess_agg s
  LEFT JOIN base b USING (user_id)
  WHERE s.all_correct
    AND s.n >= 5
    AND s.n * ln(LEAST(GREATEST(COALESCE(b.p, 0.95), 0.01), 0.98)) < ln(0.01)
)
UPDATE user_responses ur
SET first_is_correct = NULL
FROM sess s
JOIN flagged f USING (user_id, sid)
WHERE ur.user_id = s.user_id
  AND ur.question_id = s.question_id;

ALTER TABLE user_responses ALTER COLUMN first_answered_at SET NOT NULL;

-- Keep the first-answer columns immutable regardless of write path.
CREATE OR REPLACE FUNCTION user_responses_first_answer()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.first_is_correct := NEW.is_correct;
    NEW.first_answered_at := COALESCE(NEW.created_at, now());
  ELSE
    NEW.first_is_correct := OLD.first_is_correct;
    NEW.first_answered_at := OLD.first_answered_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS user_responses_first_answer ON user_responses;
CREATE TRIGGER user_responses_first_answer
  BEFORE INSERT OR UPDATE ON user_responses
  FOR EACH ROW EXECUTE FUNCTION user_responses_first_answer();

-- ---------------------------------------------------------------------------
-- 3. answer_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS answer_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL only for backfilled first answers whose outcome is unknown (see above)
  is_correct BOOLEAN,
  source TEXT NOT NULL CHECK (source IN ('fresh', 'review', 'practice')),
  served_reason TEXT NOT NULL CHECK (served_reason IN (
    'random',            -- plain random draw (pre-v2 behaviour)
    'onboarding',        -- random draw from the trimmed new-user pool
    'breaker',           -- easy question served after a miss streak
    'breaker_withheld',  -- breaker would have fired; held out (micro-randomised)
    'review_due',        -- spaced-repetition review
    'soft_reset',        -- review forced by a category soft reset
    'practice',          -- "Greške" practice mode
    'backfill'           -- reconstructed from user_responses by this migration
  )),
  session_pos INT
);

CREATE INDEX IF NOT EXISTS answer_events_user_time_idx ON answer_events (user_id, answered_at);
CREATE INDEX IF NOT EXISTS answer_events_question_idx ON answer_events (question_id);

-- Only SECURITY DEFINER functions and service_role touch this table.
ALTER TABLE answer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON answer_events FROM anon, authenticated;

INSERT INTO answer_events (user_id, question_id, answered_at, is_correct, source, served_reason)
SELECT ur.user_id, ur.question_id, ur.first_answered_at, ur.first_is_correct, 'fresh', 'backfill'
FROM user_responses ur
WHERE NOT EXISTS (
  SELECT 1 FROM answer_events e
  WHERE e.user_id = ur.user_id AND e.question_id = ur.question_id AND e.served_reason = 'backfill'
);

-- Log every fresh answer, including direct inserts from older cached clients.
-- record_answer() passes served_reason / session_pos through transaction-local
-- settings; plain inserts fall back to 'random'.
CREATE OR REPLACE FUNCTION log_fresh_answer()
RETURNS trigger AS $$
BEGIN
  INSERT INTO answer_events (user_id, question_id, answered_at, is_correct, source, served_reason, session_pos)
  VALUES (
    NEW.user_id,
    NEW.question_id,
    NEW.first_answered_at,
    NEW.first_is_correct,
    'fresh',
    COALESCE(NULLIF(current_setting('app.served_reason', true), ''), 'random'),
    NULLIF(current_setting('app.session_pos', true), '')::INT
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS user_responses_log_fresh ON user_responses;
CREATE TRIGGER user_responses_log_fresh
  AFTER INSERT ON user_responses
  FOR EACH ROW EXECUTE FUNCTION log_fresh_answer();

-- ---------------------------------------------------------------------------
-- 4. questions.content_updated_at
-- ---------------------------------------------------------------------------
ALTER TABLE questions ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN questions.content_updated_at IS
  'Set when text, image, options or the correct answer change. Answers before this time are excluded from difficulty.';

CREATE OR REPLACE FUNCTION questions_touch_content()
RETURNS trigger AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.option_1 IS DISTINCT FROM OLD.option_1
     OR NEW.option_2 IS DISTINCT FROM OLD.option_2
     OR NEW.option_3 IS DISTINCT FROM OLD.option_3
     OR NEW.correct_option IS DISTINCT FROM OLD.correct_option
  THEN
    NEW.content_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS questions_touch_content ON questions;
CREATE TRIGGER questions_touch_content
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION questions_touch_content();

-- ---------------------------------------------------------------------------
-- 5. question_stats (supersedes 015's question_difficulty view)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_question_difficulty(UUID);
DROP VIEW IF EXISTS question_difficulty;

CREATE OR REPLACE FUNCTION question_difficulty_shrinkage() RETURNS INT AS $$
  SELECT 5;
$$ LANGUAGE sql IMMUTABLE;

DROP MATERIALIZED VIEW IF EXISTS question_stats;
CREATE MATERIALIZED VIEW question_stats AS
WITH first_answers AS (
  -- A user's first fresh answer per question (a hard reset can produce a second one)
  SELECT DISTINCT ON (e.user_id, e.question_id)
    e.user_id, e.question_id, e.is_correct, e.served_reason, e.answered_at
  FROM answer_events e
  WHERE e.source = 'fresh'
  ORDER BY e.user_id, e.question_id, e.answered_at, e.id
),
counted AS (
  SELECT fa.question_id, fa.is_correct
  FROM first_answers fa
  JOIN questions q ON q.id = fa.question_id
  WHERE fa.is_correct IS NOT NULL
    AND fa.served_reason <> 'breaker'
    AND (q.content_updated_at IS NULL OR fa.answered_at >= q.content_updated_at)
),
global_stats AS (
  SELECT COALESCE(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END), 0.75) AS accuracy
  FROM counted
),
question_counts AS (
  SELECT
    q.id AS question_id,
    q.category_id,
    COUNT(c.question_id)::INT AS n,
    COUNT(c.question_id) FILTER (WHERE c.is_correct)::INT AS n_correct
  FROM questions q
  LEFT JOIN counted c ON c.question_id = q.id
  GROUP BY q.id, q.category_id
),
category_stats AS (
  SELECT
    category_id,
    CASE WHEN SUM(n) > 0 THEN SUM(n_correct)::NUMERIC / SUM(n) END AS accuracy
  FROM question_counts
  GROUP BY category_id
)
SELECT
  qc.question_id,
  qc.category_id,
  qc.n AS response_count,
  qc.n_correct AS correct_count,
  ROUND(COALESCE(cs.accuracy, gs.accuracy), 4) AS category_accuracy,
  ROUND(
    (qc.n_correct + question_difficulty_shrinkage() * COALESCE(cs.accuracy, gs.accuracy))
    / (qc.n + question_difficulty_shrinkage()),
    4
  ) AS difficulty_score,
  now() AS refreshed_at
FROM question_counts qc
LEFT JOIN category_stats cs ON cs.category_id = qc.category_id
CROSS JOIN global_stats gs;

COMMENT ON MATERIALIZED VIEW question_stats IS
  'Empirical difficulty per question: difficulty_score = P(correct), lower = harder, shrunk toward the category mean (k=5). First fresh answers only; excludes breaker-served, pre-edit and unknown-outcome answers. Refreshed daily by refresh_question_stats().';

CREATE UNIQUE INDEX question_stats_question_idx ON question_stats (question_id);
CREATE INDEX question_stats_category_score_idx ON question_stats (category_id, difficulty_score);

REVOKE ALL ON question_stats FROM anon, authenticated;

CREATE OR REPLACE FUNCTION refresh_question_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION refresh_question_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_question_stats() TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Write path
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

    PERFORM set_config('app.served_reason', '', true);
    PERFORM set_config('app.session_pos', '', true);

  ELSIF p_mode = 'practice' THEN
    -- Practice only covers questions the user previously got wrong.
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
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown mode %', p_mode;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT) TO authenticated;

-- Legacy practice path, kept for cached PWA clients still running old JS.
CREATE OR REPLACE FUNCTION update_practice_response(
  p_user_id UUID,
  p_question_id UUID,
  p_is_correct BOOLEAN
)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM record_answer(p_question_id, p_is_correct, 'practice', 'practice', NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Internal trigger functions are not meant to be called over the API.
REVOKE EXECUTE ON FUNCTION log_fresh_answer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION user_responses_first_answer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION questions_touch_content() FROM PUBLIC, anon, authenticated;
