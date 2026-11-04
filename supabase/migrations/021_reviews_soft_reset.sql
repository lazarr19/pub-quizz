-- Migration: Question serving v2 - Phase 2 (spaced-repetition reviews + soft reset)
--
-- Review schedule per (user, question), stored on user_responses:
--   review_chain = consecutive correct answers (first answer + reviews).
--   wrong answer           -> chain 0, due in 7 days
--   correct, chain 1       -> due in 60 days
--   correct, chain 2       -> due in 180 days
--   correct, chain 3       -> retired (review_due_at NULL), never shown again
--   question edited after the user's last answer -> due immediately
-- Reviews never change is_correct / created_at, so leaderboards and stats are
-- unaffected; correct reviews DO count as streak activity (via answer_events).
--
-- Share of a batch that is reviews (get_question_batch):
--   no unseen questions left in the selected categories -> 100%
--   user has < 30 answers                               -> 0%
--   unseen pool < 20% of the selected categories        -> 40%
--   user has >= 300 answers                             -> 20%
--   otherwise                                           -> 0%
-- Only due reviews are ever served; reviews also top up a batch when unseen
-- questions run short, and every batch may carry one corrected (edited) question. The easy breaker reserve may use a due review the user
-- last answered correctly when no proven easy unseen question is left.
--
-- reset_category_responses becomes a soft reset: history is kept and every
-- question in the categories becomes due (served_reason = 'soft_reset').

-- ---------------------------------------------------------------------------
-- 1. Schedule columns + backfill
-- ---------------------------------------------------------------------------
ALTER TABLE user_responses
  ADD COLUMN IF NOT EXISTS review_chain SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_forced BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_responses.review_chain IS 'Consecutive correct answers (first answer + reviews). 3 = retired.';
COMMENT ON COLUMN user_responses.review_due_at IS 'When this question may be served again as a review. NULL = retired.';
COMMENT ON COLUMN user_responses.review_forced IS 'Set by a soft reset; cleared once the review is answered.';

-- Current state as the starting point: rows corrected in practice count as known
-- (due 60 days after the correction), wrong rows are due 7 days after the answer.
UPDATE user_responses
SET review_chain = CASE WHEN is_correct THEN 1 ELSE 0 END,
    review_due_at = CASE
      WHEN is_correct THEN created_at + INTERVAL '60 days'
      ELSE first_answered_at + INTERVAL '7 days'
    END
WHERE review_due_at IS NULL AND review_count = 0;

CREATE INDEX IF NOT EXISTS user_responses_user_due_idx
  ON user_responses (user_id, review_due_at);

-- The first answer sets the initial schedule (trigger function from 019, extended).
CREATE OR REPLACE FUNCTION user_responses_first_answer()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.first_is_correct := NEW.is_correct;
    NEW.first_answered_at := COALESCE(NEW.created_at, now());
    NEW.review_chain := CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;
    NEW.review_due_at := NEW.first_answered_at
      + CASE WHEN NEW.is_correct THEN INTERVAL '60 days' ELSE INTERVAL '7 days' END;
    NEW.last_reviewed_at := NULL;
    NEW.review_count := 0;
    NEW.review_forced := false;
  ELSE
    NEW.first_is_correct := OLD.first_is_correct;
    NEW.first_answered_at := OLD.first_answered_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ---------------------------------------------------------------------------
-- 2. Soft reset (same signature, so cached clients get it too)
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

  UPDATE user_responses ur
  SET review_due_at = now(),
      review_forced = true
  FROM questions q
  WHERE q.id = ur.question_id
    AND ur.user_id = p_user_id
    AND q.category_id = ANY(p_category_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 3. record_answer gains mode 'review'
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
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown mode %', p_mode;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 4. get_question_batch with reviews (adds the `kind` column)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_question_batch(UUID[], INT, UUID[], INT);

CREATE FUNCTION get_question_batch(
  p_category_ids UUID[],
  p_limit INT DEFAULT 10,
  p_exclude_ids UUID[] DEFAULT '{}',
  p_reserve INT DEFAULT 2
)
RETURNS TABLE (
  id UUID,
  category_id UUID,
  type question_type,
  content TEXT,
  image_url TEXT,
  option_1 TEXT,
  option_2 TEXT,
  option_3 TEXT,
  correct_option SMALLINT,
  difficulty_score NUMERIC,
  served_reason TEXT,
  is_reserve BOOLEAN,
  kind TEXT
) AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_reserve INT := LEAST(GREATEST(COALESCE(p_reserve, 0), 0), 5);
  v_exclude UUID[] := COALESCE(p_exclude_ids, '{}');
  v_lifetime INT;
  v_total INT;
  v_unseen INT;
  v_share NUMERIC;
  v_n_review INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_lifetime FROM user_responses ur WHERE ur.user_id = v_uid;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM user_responses ur WHERE ur.user_id = v_uid AND ur.question_id = q.id
    ))
  INTO v_total, v_unseen
  FROM questions q
  WHERE q.category_id = ANY(p_category_ids);

  v_share := CASE
    WHEN v_unseen = 0 THEN 1.0
    WHEN v_lifetime < 30 THEN 0
    WHEN v_unseen < 0.2 * v_total THEN 0.4
    WHEN v_lifetime >= 300 THEN 0.2
    ELSE 0
  END;
  v_n_review := ROUND(v_limit * v_share);

  RETURN QUERY
  WITH fresh AS (
    SELECT
      q.id AS qid,
      qs.difficulty_score AS score,
      COALESCE(qs.response_count, 0) AS n
    FROM questions q
    LEFT JOIN question_stats qs ON qs.question_id = q.id
    WHERE q.category_id = ANY(p_category_ids)
      AND NOT EXISTS (
        SELECT 1 FROM user_responses ur
        WHERE ur.user_id = v_uid AND ur.question_id = q.id
      )
      AND q.id <> ALL(v_exclude)
  ),
  due AS (
    SELECT
      ur.question_id AS qid,
      qs.difficulty_score AS score,
      ur.review_chain AS chain,
      ur.review_forced AS forced,
      COALESCE(ur.review_due_at, now()) AS due_at,
      (q.content_updated_at IS NOT NULL
        AND COALESCE(ur.last_reviewed_at, ur.first_answered_at) < q.content_updated_at) AS edited
    FROM user_responses ur
    JOIN questions q ON q.id = ur.question_id
    LEFT JOIN question_stats qs ON qs.question_id = ur.question_id
    WHERE ur.user_id = v_uid
      AND q.category_id = ANY(p_category_ids)
      AND q.id <> ALL(v_exclude)
      AND (
        ur.review_due_at <= now()
        -- edited since the user last saw it
        OR (
          q.content_updated_at IS NOT NULL
          AND COALESCE(ur.last_reviewed_at, ur.first_answered_at) < q.content_updated_at
        )
      )
  ),
  reserve AS (
    SELECT c.qid, c.score, c.kind
    FROM (
      -- tier 0: proven easy unseen; tier 1: due review last answered correctly;
      -- tier 2: easiest remaining unseen
      SELECT f.qid, f.score, 'fresh'::TEXT AS kind,
             CASE WHEN COALESCE(f.score >= 0.80, false) AND f.n >= 5 THEN 0 ELSE 2 END AS tier
      FROM fresh f
      UNION ALL
      SELECT d.qid, d.score, 'review'::TEXT, 1
      FROM due d
      WHERE d.chain > 0
    ) c
    ORDER BY c.tier, random() * (CASE WHEN c.tier < 2 THEN 1 ELSE 0 END), c.score DESC NULLS LAST, random()
    LIMIT v_reserve
  ),
  review_ranked AS (
    SELECT
      d.qid, d.score,
      CASE WHEN d.forced THEN 'soft_reset' ELSE 'review_due' END AS reason,
      -- corrected questions first, then previously-missed, then most overdue
      -- (with a week of jitter)
      ROW_NUMBER() OVER (
        ORDER BY d.edited DESC, (d.chain = 0) DESC, d.due_at + random() * INTERVAL '7 days'
      ) AS rn
    FROM due d
    WHERE d.qid NOT IN (SELECT r.qid FROM reserve r)
  ),
  fresh_ranked AS (
    SELECT
      f.qid, f.score,
      CASE
        WHEN v_lifetime < 30 AND COALESCE(f.score >= 0.45, false) AND f.n >= 5 THEN 'onboarding'
        ELSE 'random'
      END AS reason,
      ROW_NUMBER() OVER (
        ORDER BY
          (v_lifetime >= 30 OR (COALESCE(f.score >= 0.45, false) AND f.n >= 5)) DESC,
          random()
      ) AS rn
    FROM fresh f
    WHERE f.qid NOT IN (SELECT r.qid FROM reserve r)
  ),
  quota AS (
    -- Reviews take their share, top up when unseen questions run short, and one
    -- slot per batch is always open for a corrected (edited) question, which
    -- ranks first among reviews.
    SELECT LEAST(
      (SELECT COUNT(*) FROM review_ranked),
      GREATEST(
        v_n_review,
        v_limit - (SELECT COUNT(*) FROM fresh_ranked),
        LEAST((SELECT COUNT(*) FROM due d WHERE d.edited), 1)
      )
    )::INT AS n_review
  ),
  picked AS (
    SELECT rr.qid, rr.score, rr.reason, false AS reserve, 'review'::TEXT AS kind
    FROM review_ranked rr, quota
    WHERE rr.rn <= quota.n_review
    UNION ALL
    SELECT fr.qid, fr.score, fr.reason, false, 'fresh'
    FROM fresh_ranked fr, quota
    WHERE fr.rn <= v_limit - quota.n_review
    UNION ALL
    SELECT r.qid, r.score, 'breaker', true, r.kind
    FROM reserve r
  )
  SELECT
    q.id, q.category_id, q.type, q.content, q.image_url,
    q.option_1, q.option_2, q.option_3, q.correct_option,
    pk.score, pk.reason, pk.reserve, pk.kind
  FROM picked pk
  JOIN questions q ON q.id = pk.qid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_question_batch(UUID[], INT, UUID[], INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_question_batch(UUID[], INT, UUID[], INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Streaks: a correct review counts as an active day. Both functions are
--    copied verbatim from 013 / 014 with one extra UNION branch on answer_events.
-- ---------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION get_streak_reminder_targets()
RETURNS TABLE (user_id UUID, endpoint TEXT, p256dh TEXT, auth TEXT, streak INT) AS $$
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
