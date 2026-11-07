-- Migration: XP + levels ("Nivo"), a dedicated repeat mode ("Ponavljanje"),
-- and a shorter spaced-repetition ladder.
--
-- 1. Review ladder (review_chain = consecutive correct answers):
--      wrong                 -> chain 0, due in 1 day
--      correct, chain 1      -> due in 3 days
--      correct, chain 2      -> due in 7 days
--      correct, chain 3      -> due in 21 days
--      correct, chain 4      -> retired (review_due_at NULL)
--    A question answered correctly at first sight starts at chain 2 (7 days).
--    Existing rows are rescheduled once, from their last answer.
-- 2. XP (only for answers verified on the server, i.e. sent with the selected
--    option; old cached clients still save answers but earn nothing):
--      new question correct     question_xp(p): 10 for an average question,
--                               3 (easy) .. 25 (hard), p frozen monthly
--      new question wrong       2
--      LEARNED                  15, once per question ever: correct on a DUE
--                               repeat whose previous outcome was a miss
--      due repeat, correct      3
--      due repeat, wrong        1
--      soft-reset repeat        1 if correct, max 50 XP per day
--      practice correction      2
--      daily challenge done     20
--    Level: cumulative XP for level L = 100 * (L-1)^1.6 (simulated on full
--    history 2026-11-07: median first session -> level 3, top player -> ~33).
--    History is replayed once so every player starts with XP and a level.
-- 3. Ponavljanje mode: get_review_batch() serves only due questions, missed
--    ones first; get_next_review_due() tells the client when more arrive.
-- 4. get_my_progress(): everything the UI shows (XP, level, learned, history).
--
-- The rating from 026 keeps being computed inside record_answer(), silently:
-- it is no longer shown in the app.

-- First run? The one-time reschedule and replay below must not run twice.
CREATE TEMP TABLE IF NOT EXISTS _m027 AS
SELECT to_regprocedure('xp_level(bigint)') IS NULL AS first_run;

-- ---------------------------------------------------------------------------
-- 1. Review ladder
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION review_interval(p_chain INT)
RETURNS INTERVAL AS $$
  SELECT CASE p_chain
    WHEN 0 THEN INTERVAL '1 day'
    WHEN 1 THEN INTERVAL '3 days'
    WHEN 2 THEN INTERVAL '7 days'
    WHEN 3 THEN INTERVAL '21 days'
    ELSE NULL
  END;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON COLUMN user_responses.review_chain IS
  'Consecutive correct answers on the review ladder (first answer correct starts at 2). 4 = retired.';

-- First answer sets the initial schedule (021's trigger function, new ladder).
CREATE OR REPLACE FUNCTION user_responses_first_answer()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.first_is_correct := NEW.is_correct;
    NEW.first_answered_at := COALESCE(NEW.created_at, now());
    NEW.review_chain := CASE WHEN NEW.is_correct THEN 2 ELSE 0 END;
    NEW.review_due_at := NEW.first_answered_at + review_interval(NEW.review_chain);
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

DO $$
BEGIN
  IF NOT (SELECT first_run FROM _m027) THEN
    RETURN;
  END IF;

  -- Map 021's chain (first correct = 1, retired at 3) onto the new ladder,
  -- then reschedule from the last answer. Soft-reset rows stay due now.
  -- Overdue questions the player already KNEW are spread over the next 30 days
  -- instead of all landing at once (tens of thousands would otherwise be due
  -- today); overdue MISSED questions stay due now - those are the learning.
  UPDATE user_responses ur
  SET review_chain = x.new_chain,
      review_due_at = CASE
        WHEN ur.review_forced THEN ur.review_due_at
        WHEN x.new_chain > 0 AND x.base + review_interval(x.new_chain) < now()
          THEN now() + random() * INTERVAL '30 days'
        ELSE x.base + review_interval(x.new_chain)
      END
  FROM (
    SELECT user_id, question_id,
      CASE
        WHEN review_count = 0 THEN CASE WHEN is_correct THEN 2 ELSE 0 END
        WHEN review_chain = 0 THEN 0
        -- never missed: the run includes the first answer, shift by one step
        WHEN first_is_correct IS TRUE AND review_chain = review_count + 1 THEN LEAST(review_chain + 1, 4)
        ELSE LEAST(review_chain, 4)
      END AS new_chain,
      COALESCE(last_reviewed_at, created_at) AS base
    FROM user_responses
  ) x
  WHERE ur.user_id = x.user_id AND ur.question_id = x.question_id;
END $$;

-- ---------------------------------------------------------------------------
-- 2. XP storage and helpers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp BIGINT NOT NULL DEFAULT 0,
  learned_count INT NOT NULL DEFAULT 0,
  soft_reset_day DATE,
  soft_reset_xp INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE player_xp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON player_xp FROM anon, authenticated;

ALTER TABLE answer_events
  ADD COLUMN IF NOT EXISTS xp SMALLINT,
  ADD COLUMN IF NOT EXISTS learned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_responses ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;

COMMENT ON COLUMN user_responses.learned_at IS
  'When this question was first LEARNED (missed, then correct on a due repeat). Learned XP is paid once.';

CREATE OR REPLACE FUNCTION question_xp(p NUMERIC)
RETURNS INT AS $$
  SELECT LEAST(GREATEST(round(10 * (1 - p) / (1 - 0.67)), 3), 25)::INT;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION xp_level(p_xp BIGINT)
RETURNS INT AS $$
  SELECT floor(power(GREATEST(p_xp, 0) / 100.0, 1 / 1.6))::INT + 1;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION xp_for_level(p_level INT)
RETURNS BIGINT AS $$
  SELECT ceil(100 * power(GREATEST(p_level - 1, 0), 1.6))::BIGINT;
$$ LANGUAGE sql IMMUTABLE;

-- P(correct) used for XP: frozen monthly value, else the category mean.
CREATE OR REPLACE FUNCTION question_p_for(p_question_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_p NUMERIC;
BEGIN
  SELECT qr.p_correct INTO v_p FROM question_ratings qr WHERE qr.question_id = p_question_id;
  IF v_p IS NULL THEN
    SELECT AVG(qr.p_correct) INTO v_p
    FROM question_ratings qr
    WHERE qr.category_id = (SELECT q.category_id FROM questions q WHERE q.id = p_question_id);
  END IF;
  RETURN COALESCE(v_p, 0.67);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Adds XP and returns the new total.
CREATE OR REPLACE FUNCTION award_xp(p_user_id UUID, p_xp INT, p_learned BOOLEAN)
RETURNS BIGINT AS $$
DECLARE
  v_total BIGINT;
BEGIN
  INSERT INTO player_xp (user_id, xp, learned_count)
  VALUES (p_user_id, GREATEST(p_xp, 0), CASE WHEN p_learned THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    xp = player_xp.xp + GREATEST(p_xp, 0),
    learned_count = player_xp.learned_count + CASE WHEN p_learned THEN 1 ELSE 0 END,
    updated_at = now()
  RETURNING xp INTO v_total;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Soft-reset XP allowance: grants up to p_xp while today's total stays <= 50.
CREATE OR REPLACE FUNCTION soft_reset_xp_allowance(p_user_id UUID, p_xp INT)
RETURNS INT AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Europe/Belgrade')::date;
  v_used INT;
  v_grant INT;
BEGIN
  INSERT INTO player_xp (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT CASE WHEN soft_reset_day = v_today THEN soft_reset_xp ELSE 0 END INTO v_used
  FROM player_xp WHERE user_id = p_user_id FOR UPDATE;
  v_grant := LEAST(GREATEST(p_xp, 0), GREATEST(50 - v_used, 0));
  UPDATE player_xp SET soft_reset_day = v_today, soft_reset_xp = v_used + v_grant
  WHERE user_id = p_user_id;
  RETURN v_grant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION question_p_for(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION award_xp(UUID, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION soft_reset_xp_allowance(UUID, INT) FROM PUBLIC, anon, authenticated;

-- Fresh-answer trigger (026) also writes the event's XP, passed by
-- record_answer() through a transaction-local setting.
CREATE OR REPLACE FUNCTION log_fresh_answer()
RETURNS trigger AS $$
BEGIN
  INSERT INTO answer_events (
    user_id, question_id, answered_at, is_correct, source, served_reason, session_pos,
    rating_before, rating_after, rated_n, xp
  )
  VALUES (
    NEW.user_id,
    NEW.question_id,
    NEW.first_answered_at,
    NEW.first_is_correct,
    'fresh',
    COALESCE(NULLIF(current_setting('app.served_reason', true), ''), 'random'),
    NULLIF(current_setting('app.session_pos', true), '')::INT,
    NULLIF(current_setting('app.rating_before', true), '')::NUMERIC,
    NULLIF(current_setting('app.rating_after', true), '')::NUMERIC,
    NULLIF(current_setting('app.rated_n', true), '')::INT,
    NULLIF(current_setting('app.xp', true), '')::SMALLINT
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION log_fresh_answer() FROM PUBLIC, anon, authenticated;

-- Daily challenge completion (025's trigger) also awards 20 XP.
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
    -- AFTER ROW triggers of a multi-row INSERT all see count = 10, so award
    -- from exactly one row of the set (bump_user_streak is idempotent, XP isn't).
    IF NEW.question_id = (
      SELECT MAX(question_id::TEXT)::UUID FROM daily_challenge_responses
      WHERE user_id = NEW.user_id AND challenge_date = NEW.challenge_date
    ) THEN
      PERFORM award_xp(NEW.user_id, 20, false);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION daily_challenge_bump_streak() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. One-time XP replay of history (set-based)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT (SELECT first_run FROM _m027) THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE xp_replay ON COMMIT DROP AS
  WITH ev AS (
    SELECT ae.id, ae.user_id, ae.question_id, ae.answered_at, ae.is_correct, ae.source, ae.served_reason,
      LAG(ae.is_correct) OVER w AS prev_ok,
      LAG(ae.answered_at) OVER w AS prev_t,
      ROW_NUMBER() OVER (PARTITION BY ae.user_id, ae.question_id, ae.source ORDER BY ae.answered_at, ae.id) AS nth
    FROM answer_events ae
    WHERE ae.served_reason <> 'duplicate_fresh'
    WINDOW w AS (PARTITION BY ae.user_id, ae.question_id ORDER BY ae.answered_at, ae.id)
  ),
  scored AS (
    SELECT ev.*,
      CASE
        WHEN source = 'fresh' AND nth = 1 THEN
          CASE WHEN is_correct IS NULL THEN 4          -- missed, later fixed in practice (rewritten history)
               WHEN is_correct THEN question_xp(question_p_for(question_id))
               ELSE 2 END
        WHEN source = 'fresh' THEN 0
        WHEN source = 'review' AND served_reason = 'soft_reset' THEN CASE WHEN is_correct THEN 1 ELSE 0 END
        WHEN source = 'review' AND is_correct AND prev_ok IS FALSE
             AND answered_at - prev_t >= INTERVAL '1 day' THEN -1   -- learned candidate
        WHEN source = 'review' AND is_correct THEN 3
        WHEN source = 'review' THEN 1
        WHEN source = 'practice' AND is_correct THEN 2
        ELSE 0
      END AS raw
    FROM ev
  ),
  learned_pick AS (
    SELECT s.*,
      ROW_NUMBER() OVER (PARTITION BY user_id, question_id, (raw = -1) ORDER BY answered_at, id) AS lnth
    FROM scored s
  ),
  resolved AS (
    SELECT id, user_id, question_id, answered_at, served_reason,
      (raw = -1 AND lnth = 1) AS learned,
      CASE WHEN raw = -1 THEN CASE WHEN lnth = 1 THEN 15 ELSE 3 END ELSE raw END AS xp0
    FROM learned_pick
  )
  SELECT r.id, r.user_id, r.question_id, r.answered_at, r.learned,
    CASE WHEN r.served_reason = 'soft_reset' THEN
      GREATEST(0, LEAST(r.xp0, 50 - (
        SUM(r.xp0) OVER (
          PARTITION BY r.user_id, r.served_reason = 'soft_reset', (r.answered_at AT TIME ZONE 'Europe/Belgrade')::date
          ORDER BY r.answered_at, r.id
        ) - r.xp0)))
    ELSE r.xp0 END AS xp
  FROM resolved r;

  UPDATE answer_events ae SET xp = x.xp, learned = x.learned
  FROM xp_replay x WHERE ae.id = x.id;

  UPDATE user_responses ur SET learned_at = x.answered_at
  FROM xp_replay x
  WHERE x.learned AND ur.user_id = x.user_id AND ur.question_id = x.question_id;

  INSERT INTO player_xp (user_id, xp, learned_count)
  SELECT u.user_id, COALESCE(a.xp, 0) + 20 * COALESCE(d.days, 0), COALESCE(a.learned, 0)
  FROM (
    SELECT user_id FROM xp_replay
    UNION
    SELECT user_id FROM daily_challenge_responses
  ) u
  LEFT JOIN (
    SELECT user_id, SUM(xp) AS xp, COUNT(*) FILTER (WHERE learned) AS learned
    FROM xp_replay GROUP BY user_id
  ) a ON a.user_id = u.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS days FROM (
      SELECT user_id, challenge_date FROM daily_challenge_responses
      GROUP BY user_id, challenge_date HAVING COUNT(*) = 10
    ) c GROUP BY user_id
  ) d ON d.user_id = u.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    xp = EXCLUDED.xp, learned_count = EXCLUDED.learned_count, updated_at = now();
END $$;

-- ---------------------------------------------------------------------------
-- 4. record_answer(): 026 + XP + new ladder
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_answer(
  p_question_id UUID,
  p_is_correct BOOLEAN,
  p_mode TEXT DEFAULT 'fresh',
  p_served_reason TEXT DEFAULT 'random',
  p_session_pos INT DEFAULT NULL,
  p_selected_option SMALLINT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_verified BOOLEAN := p_selected_option IS NOT NULL;
  v_chain SMALLINT;
  v_due TIMESTAMPTZ;
  v_forced BOOLEAN;
  v_learned_at TIMESTAMPTZ;
  v_edited BOOLEAN;
  v_is_due BOOLEAN;
  v_inserted INT;
  v_correct BOOLEAN;
  v_rate BOOLEAN := false;
  v_r NUMERIC;
  v_n INT;
  v_peak NUMERIC;
  v_q_rating NUMERIC;
  v_q_proven BOOLEAN;
  v_new NUMERIC;
  v_xp INT := 0;
  v_learned BOOLEAN := false;
  v_total BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Server decides correctness when the client sends the chosen option.
  IF v_verified THEN
    SELECT q.correct_option = p_selected_option INTO v_correct
    FROM questions q WHERE q.id = p_question_id;
    IF v_correct IS NULL THEN
      RAISE EXCEPTION 'Unknown question';
    END IF;
  ELSE
    v_correct := p_is_correct;   -- old client: saved, never rated, no XP
  END IF;

  IF p_mode = 'fresh' THEN
    IF v_verified THEN
      -- Lock this player's rating row: serialises their concurrent answers
      -- (e.g. two tabs), so the first-encounter check below is race-free.
      INSERT INTO player_ratings (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
      SELECT rating, rated_answers, peak_shown INTO v_r, v_n, v_peak
      FROM player_ratings WHERE user_id = v_uid FOR UPDATE;

      IF NOT EXISTS (
        SELECT 1 FROM user_responses WHERE user_id = v_uid AND question_id = p_question_id
      ) THEN
        SELECT qr.rating, qr.proven INTO v_q_rating, v_q_proven FROM question_rating_for(p_question_id) qr;
        v_new := rating_step(v_r, v_n, v_q_rating, v_q_proven, v_correct);
        v_rate := true;
        v_xp := CASE WHEN v_correct THEN question_xp(question_p_for(p_question_id)) ELSE 2 END;
        PERFORM set_config('app.rating_before', v_r::TEXT, true);
        PERFORM set_config('app.rating_after', v_new::TEXT, true);
        PERFORM set_config('app.rated_n', (v_n + 1)::TEXT, true);
        PERFORM set_config('app.xp', v_xp::TEXT, true);
      END IF;
    END IF;

    PERFORM set_config('app.served_reason', COALESCE(p_served_reason, 'random'), true);
    PERFORM set_config('app.session_pos', COALESCE(p_session_pos::TEXT, ''), true);

    INSERT INTO user_responses (user_id, question_id, is_correct)
    VALUES (v_uid, p_question_id, v_correct)
    ON CONFLICT (user_id, question_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    PERFORM set_config('app.served_reason', '', true);
    PERFORM set_config('app.session_pos', '', true);
    PERFORM set_config('app.rating_before', '', true);
    PERFORM set_config('app.rating_after', '', true);
    PERFORM set_config('app.rated_n', '', true);
    PERFORM set_config('app.xp', '', true);

    IF v_inserted = 0 THEN
      -- Already answered: keep the first answer, but leave a trace.
      v_rate := false;
      v_xp := 0;
      INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos)
      VALUES (v_uid, p_question_id, v_correct, 'fresh', 'duplicate_fresh', p_session_pos);
    ELSE
      IF v_correct THEN
        PERFORM bump_user_streak(v_uid, (now() AT TIME ZONE 'UTC')::date);
      END IF;
      IF v_rate THEN
        v_n := v_n + 1;
        v_r := v_new;
        v_peak := GREATEST(v_peak, shown_rating(v_r, v_n));
        UPDATE player_ratings
        SET rating = v_r, rated_answers = v_n, peak_shown = v_peak, updated_at = now()
        WHERE user_id = v_uid;
      END IF;
    END IF;

  ELSIF p_mode = 'review' THEN
    SELECT ur.review_chain, ur.review_due_at, ur.review_forced, ur.learned_at,
           (q.content_updated_at IS NOT NULL
             AND COALESCE(ur.last_reviewed_at, ur.first_answered_at) < q.content_updated_at)
    INTO v_chain, v_due, v_forced, v_learned_at, v_edited
    FROM user_responses ur
    JOIN questions q ON q.id = ur.question_id
    WHERE ur.user_id = v_uid AND ur.question_id = p_question_id
    FOR UPDATE OF ur;

    IF NOT FOUND THEN
      RETURN json_build_object('is_correct', v_correct, 'rated', false, 'xp', 0, 'learned', false);
    END IF;

    v_is_due := v_forced OR v_edited OR (v_due IS NOT NULL AND v_due <= now());

    IF v_verified THEN
      IF v_forced THEN
        v_xp := soft_reset_xp_allowance(v_uid, CASE WHEN v_correct THEN 1 ELSE 0 END);
      ELSIF v_due IS NOT NULL AND v_due <= now() THEN
        IF v_correct AND v_chain = 0 AND v_learned_at IS NULL THEN
          v_xp := 15; v_learned := true;
        ELSIF v_correct THEN
          v_xp := 3;
        ELSE
          v_xp := 1;
        END IF;
      END IF;   -- not due (e.g. an edited question served early): no XP
    END IF;

    INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos, xp, learned)
    VALUES (v_uid, p_question_id, v_correct, 'review',
            COALESCE(p_served_reason, 'review_due'), p_session_pos, v_xp, v_learned);

    IF v_correct THEN
      PERFORM bump_user_streak(v_uid, (now() AT TIME ZONE 'UTC')::date);
    END IF;

    -- Only a due (or edited / soft-reset) repeat moves the schedule; an early
    -- answer is logged but changes nothing.
    IF v_is_due THEN
      v_chain := CASE WHEN v_correct THEN LEAST(v_chain + 1, 4) ELSE 0 END;

      UPDATE user_responses
      SET review_chain = v_chain,
          review_due_at = now() + review_interval(v_chain),
          last_reviewed_at = now(),
          review_count = review_count + 1,
          review_forced = false,
          learned_at = CASE WHEN v_learned THEN now() ELSE learned_at END
      WHERE user_id = v_uid AND question_id = p_question_id;
    END IF;

  ELSIF p_mode = 'practice' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_responses
      WHERE user_id = v_uid AND question_id = p_question_id AND NOT is_correct
    ) THEN
      RETURN json_build_object('is_correct', v_correct, 'rated', false, 'xp', 0, 'learned', false);
    END IF;

    v_xp := CASE WHEN v_verified AND v_correct THEN 2 ELSE 0 END;

    INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos, xp)
    VALUES (v_uid, p_question_id, v_correct, 'practice', 'practice', p_session_pos, v_xp);

    IF v_correct THEN
      -- created_at is still bumped: streaks read activity dates from it.
      UPDATE user_responses
      SET is_correct = true, created_at = now(), mistake_resolved_at = now()
      WHERE user_id = v_uid AND question_id = p_question_id AND NOT is_correct;

      PERFORM bump_user_streak(v_uid, (now() AT TIME ZONE 'UTC')::date);
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown mode %', p_mode;
  END IF;

  IF v_xp > 0 THEN
    v_total := award_xp(v_uid, v_xp, v_learned);
  ELSE
    SELECT xp INTO v_total FROM player_xp WHERE user_id = v_uid;
  END IF;

  RETURN json_build_object(
    'is_correct', v_correct,
    'xp', v_xp,
    'learned', v_learned,
    'total_xp', COALESCE(v_total, 0),
    'level', xp_level(COALESCE(v_total, 0)),
    -- rating keeps being computed but is not shown in the app any more
    'rated', v_rate
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT, SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ponavljanje mode
-- ---------------------------------------------------------------------------
-- Due repeats only: corrected (edited) questions first, then previously
-- missed, then most overdue.
CREATE OR REPLACE FUNCTION get_review_batch(
  p_category_ids UUID[],
  p_limit INT DEFAULT 25,
  p_exclude_ids UUID[] DEFAULT '{}'
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
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT q.id, q.category_id, q.type, q.content, q.image_url,
         q.option_1, q.option_2, q.option_3, q.correct_option,
         qs.difficulty_score,
         CASE WHEN ur.review_forced THEN 'soft_reset' ELSE 'review_due' END,
         false,
         'review'::TEXT
  FROM user_responses ur
  JOIN questions q ON q.id = ur.question_id
  LEFT JOIN question_stats qs ON qs.question_id = ur.question_id
  WHERE ur.user_id = v_uid
    AND q.category_id = ANY(p_category_ids)
    AND q.id <> ALL(COALESCE(p_exclude_ids, '{}'))
    AND (
      ur.review_due_at <= now()
      OR (q.content_updated_at IS NOT NULL
          AND COALESCE(ur.last_reviewed_at, ur.first_answered_at) < q.content_updated_at)
    )
  ORDER BY
    (q.content_updated_at IS NOT NULL
      AND COALESCE(ur.last_reviewed_at, ur.first_answered_at) < q.content_updated_at) DESC,
    (ur.review_chain = 0) DESC,
    ur.review_due_at
  LIMIT v_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_review_batch(UUID[], INT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_review_batch(UUID[], INT, UUID[]) TO authenticated;

-- When the next repeat in these categories becomes due (NULL = none scheduled).
CREATE OR REPLACE FUNCTION get_next_review_due(p_category_ids UUID[])
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN (
    SELECT MIN(ur.review_due_at)
    FROM user_responses ur
    JOIN questions q ON q.id = ur.question_id
    WHERE ur.user_id = v_uid
      AND q.category_id = ANY(p_category_ids)
      AND ur.review_due_at > now()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_next_review_due(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_next_review_due(UUID[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Read path for the UI
-- ---------------------------------------------------------------------------
-- XP, level and its bounds, learned counts, XP this week, repeats due now, and
-- optionally XP per day (Belgrade dates) for the last p_history_days days.
CREATE OR REPLACE FUNCTION get_my_progress(p_history_days INT DEFAULT 0)
RETURNS JSON AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_xp BIGINT := 0;
  v_learned INT := 0;
  v_level INT;
  v_days INT := LEAST(GREATEST(COALESCE(p_history_days, 0), 0), 365);
  v_week_xp BIGINT;
  v_week_learned INT;
  v_due INT;
  v_history JSON := '[]'::JSON;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT xp, learned_count INTO v_xp, v_learned FROM player_xp WHERE user_id = v_uid;
  v_xp := COALESCE(v_xp, 0);
  v_learned := COALESCE(v_learned, 0);
  v_level := xp_level(v_xp);

  SELECT COALESCE(SUM(ae.xp), 0), COUNT(*) FILTER (WHERE ae.learned)
  INTO v_week_xp, v_week_learned
  FROM answer_events ae
  WHERE ae.user_id = v_uid AND ae.answered_at >= now() - INTERVAL '7 days';

  v_week_xp := v_week_xp + 20 * (
    SELECT COUNT(*) FROM (
      SELECT challenge_date FROM daily_challenge_responses
      WHERE user_id = v_uid AND challenge_date > CURRENT_DATE - 7
      GROUP BY challenge_date HAVING COUNT(*) = 10
    ) d
  );

  SELECT COUNT(*) INTO v_due
  FROM user_responses ur
  WHERE ur.user_id = v_uid AND ur.review_due_at <= now();

  IF v_days > 0 THEN
    SELECT COALESCE(json_agg(json_build_object('day', d.day, 'xp', d.xp) ORDER BY d.day), '[]'::JSON)
    INTO v_history
    FROM (
      SELECT day, SUM(xp)::INT AS xp FROM (
        SELECT (ae.answered_at AT TIME ZONE 'Europe/Belgrade')::date AS day, ae.xp
        FROM answer_events ae
        WHERE ae.user_id = v_uid AND ae.xp > 0
          AND ae.answered_at >= now() - make_interval(days => v_days)
        UNION ALL
        SELECT challenge_date, 20
        FROM daily_challenge_responses
        WHERE user_id = v_uid AND challenge_date > CURRENT_DATE - v_days
        GROUP BY challenge_date HAVING COUNT(*) = 10
      ) x
      GROUP BY day
    ) d;
  END IF;

  RETURN json_build_object(
    'xp', v_xp,
    'level', v_level,
    'level_xp', xp_for_level(v_level),
    'next_level_xp', xp_for_level(v_level + 1),
    'learned', v_learned,
    'week_xp', v_week_xp,
    'week_learned', v_week_learned,
    'due_reviews', v_due,
    'history', v_history
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_my_progress(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_progress(INT) TO authenticated;

DROP TABLE IF EXISTS _m027;
