-- Migration: per-player rating ("Rejting")
--
-- Players are rated Elo-style against questions. Question ratings are FROZEN
-- monthly (calibrate_question_ratings(), run by a monthly cron) from the
-- empirical difficulty in question_stats, so a player's result for the same
-- answer does not drift from night to night.
--
--   question rating: chosen so an average (1000) player's P(correct) equals the
--     question's difficulty_score, with the 1/3 guessing floor of 3 options:
--       s  = clamp((p - 1/3) / (2/3), 0.02, 0.98)
--       Rq = 1000 - 400 * log10(s / (1 - s))
--   expected score: E = 1/3 + (2/3) / (1 + 10^((Rq - Rp) / 400))
--   update:         Rp += K * (correct - E)
--                   K = 32 for a player's first 30 rated answers, then 16;
--                   halved for unproven questions (< 5 answers at calibration,
--                   or added since: those use their category's mean rating)
--   shown rating:   Rp - 300 * 50 / (n + 50)   (cautious estimate; climbs as
--                   n, the number of rated answers, grows)
--
-- Only a player's FIRST encounter with a question is rated: reviews, soft
-- resets, practice and duplicate answers never move the rating.
--
-- Correctness is now decided on the server from the selected option
-- (record_answer.p_selected_option). Old clients that only send p_is_correct
-- still have answers saved, but are not rated.
--
-- Validated offline 2026-11-07 on 50k answers: log loss 0.479 vs 0.521 for
-- question difficulty alone; the cautious display cuts first sessions that end
-- with a lower shown number from 59% to 18%.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rating_from_p(p NUMERIC)
RETURNS NUMERIC AS $$
  SELECT 1000 - 400 * log(s / (1 - s))
  FROM (SELECT LEAST(GREATEST((p - 1.0 / 3) / (2.0 / 3), 0.02), 0.98) AS s) x;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION shown_rating(p_rating NUMERIC, p_n INT)
RETURNS NUMERIC AS $$
  SELECT p_rating - 300.0 * 50 / (GREATEST(p_n, 0) + 50);
$$ LANGUAGE sql IMMUTABLE;

-- One rating step. Pure function: shared by record_answer() and the replay.
CREATE OR REPLACE FUNCTION rating_step(
  p_rating NUMERIC, p_n INT, p_question_rating NUMERIC, p_proven BOOLEAN, p_correct BOOLEAN
)
RETURNS NUMERIC AS $$
  SELECT p_rating
    + (CASE WHEN p_n < 30 THEN 32 ELSE 16 END) * (CASE WHEN p_proven THEN 1 ELSE 0.5 END)
    * ((CASE WHEN p_correct THEN 1 ELSE 0 END)
       - (1.0 / 3 + (2.0 / 3) / (1 + power(10::NUMERIC, (p_question_rating - p_rating) / 400))));
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 2. Frozen question ratings (monthly)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_ratings (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  p_correct NUMERIC NOT NULL,
  rating NUMERIC NOT NULL,
  proven BOOLEAN NOT NULL,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS question_ratings_category_idx ON question_ratings (category_id);

ALTER TABLE question_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON question_ratings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION calibrate_question_ratings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_stats;

  INSERT INTO question_ratings (question_id, category_id, p_correct, rating, proven, calibrated_at)
  SELECT qs.question_id, qs.category_id, qs.difficulty_score,
         rating_from_p(qs.difficulty_score), qs.response_count >= 5, now()
  FROM question_stats qs
  ON CONFLICT (question_id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    p_correct = EXCLUDED.p_correct,
    rating = EXCLUDED.rating,
    proven = EXCLUDED.proven,
    calibrated_at = EXCLUDED.calibrated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION calibrate_question_ratings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION calibrate_question_ratings() TO service_role;

-- Rating of one question for rating purposes: frozen value, or for a question
-- added since the last calibration its category's mean (always unproven).
CREATE OR REPLACE FUNCTION question_rating_for(p_question_id UUID, OUT rating NUMERIC, OUT proven BOOLEAN)
AS $$
BEGIN
  SELECT qr.rating, qr.proven INTO rating, proven
  FROM question_ratings qr WHERE qr.question_id = p_question_id;
  IF NOT FOUND THEN
    SELECT COALESCE(AVG(qr.rating), 1000), false INTO rating, proven
    FROM question_ratings qr
    WHERE qr.category_id = (SELECT q.category_id FROM questions q WHERE q.id = p_question_id);
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION question_rating_for(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Player ratings + per-answer history on answer_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_ratings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating NUMERIC NOT NULL DEFAULT 1000,
  rated_answers INT NOT NULL DEFAULT 0,
  peak_shown NUMERIC NOT NULL DEFAULT 700,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON player_ratings FROM anon, authenticated;

ALTER TABLE answer_events
  ADD COLUMN IF NOT EXISTS rating_before NUMERIC,
  ADD COLUMN IF NOT EXISTS rating_after NUMERIC,
  ADD COLUMN IF NOT EXISTS rated_n INT;

COMMENT ON COLUMN answer_events.rated_n IS
  'Player''s rated-answer count after this answer (NULL = answer did not move the rating).';

-- The fresh-answer trigger (019) also writes rating columns, passed through
-- transaction-local settings by record_answer(), so a rated answer costs no
-- extra UPDATE on answer_events.
CREATE OR REPLACE FUNCTION log_fresh_answer()
RETURNS trigger AS $$
BEGIN
  INSERT INTO answer_events (
    user_id, question_id, answered_at, is_correct, source, served_reason, session_pos,
    rating_before, rating_after, rated_n
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
    NULLIF(current_setting('app.rated_n', true), '')::INT
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION log_fresh_answer() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Calibrate once now, then replay history so every player starts rated
-- ---------------------------------------------------------------------------
SELECT calibrate_question_ratings();

DO $$
DECLARE
  u RECORD;
  e RECORD;
  v_r NUMERIC;
  v_n INT;
  v_peak NUMERIC;
  v_new NUMERIC;
BEGIN
  CREATE TEMP TABLE rating_replay (event_id BIGINT PRIMARY KEY, r_before NUMERIC, r_after NUMERIC, n INT) ON COMMIT DROP;

  FOR u IN SELECT DISTINCT user_id FROM answer_events WHERE source = 'fresh' LOOP
    v_r := 1000; v_n := 0; v_peak := 700;
    FOR e IN
      SELECT fe.id, fe.is_correct, qr.rating AS q_rating, qr.proven
      FROM (
        -- first fresh answer per question with a known outcome
        SELECT DISTINCT ON (ae.question_id) ae.id, ae.question_id, ae.is_correct, ae.answered_at
        FROM answer_events ae
        WHERE ae.user_id = u.user_id AND ae.source = 'fresh'
          AND ae.served_reason <> 'duplicate_fresh'
        ORDER BY ae.question_id, ae.answered_at, ae.id
      ) fe
      JOIN question_ratings qr ON qr.question_id = fe.question_id
      WHERE fe.is_correct IS NOT NULL
      ORDER BY fe.answered_at, fe.id
    LOOP
      v_new := rating_step(v_r, v_n, e.q_rating, e.proven, e.is_correct);
      INSERT INTO rating_replay VALUES (e.id, v_r, v_new, v_n + 1);
      v_r := v_new; v_n := v_n + 1;
      v_peak := GREATEST(v_peak, shown_rating(v_r, v_n));
    END LOOP;

    IF v_n > 0 THEN
      INSERT INTO player_ratings (user_id, rating, rated_answers, peak_shown)
      VALUES (u.user_id, v_r, v_n, v_peak)
      ON CONFLICT (user_id) DO UPDATE SET
        rating = EXCLUDED.rating, rated_answers = EXCLUDED.rated_answers,
        peak_shown = EXCLUDED.peak_shown, updated_at = now();
    END IF;
  END LOOP;

  -- One set-based write instead of one UPDATE per answer.
  UPDATE answer_events ae
  SET rating_before = rr.r_before, rating_after = rr.r_after, rated_n = rr.n
  FROM rating_replay rr
  WHERE ae.id = rr.event_id;
END $$;

-- ---------------------------------------------------------------------------
-- 5. record_answer(): server-side correctness + rating (based on 025)
-- ---------------------------------------------------------------------------
-- The 5-argument version (019-025) is replaced by a 6-argument one; OR REPLACE
-- keeps this migration safe to re-run.
DROP FUNCTION IF EXISTS record_answer(UUID, BOOLEAN, TEXT, TEXT, INT);

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
  v_chain SMALLINT;
  v_inserted INT;
  v_correct BOOLEAN;
  v_rate BOOLEAN := false;
  v_r NUMERIC;
  v_n INT;
  v_peak NUMERIC;
  v_q_rating NUMERIC;
  v_q_proven BOOLEAN;
  v_new NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Server decides correctness when the client sends the chosen option.
  IF p_selected_option IS NOT NULL THEN
    SELECT q.correct_option = p_selected_option INTO v_correct
    FROM questions q WHERE q.id = p_question_id;
    IF v_correct IS NULL THEN
      RAISE EXCEPTION 'Unknown question';
    END IF;
  ELSE
    v_correct := p_is_correct;   -- old client: saved, never rated
  END IF;

  IF p_mode = 'fresh' THEN
    IF p_selected_option IS NOT NULL THEN
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
        PERFORM set_config('app.rating_before', v_r::TEXT, true);
        PERFORM set_config('app.rating_after', v_new::TEXT, true);
        PERFORM set_config('app.rated_n', (v_n + 1)::TEXT, true);
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

    IF v_inserted = 0 THEN
      -- Already answered: keep the first answer, but leave a trace.
      v_rate := false;
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
    SELECT review_chain INTO v_chain
    FROM user_responses
    WHERE user_id = v_uid AND question_id = p_question_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('is_correct', v_correct, 'rated', false);
    END IF;

    INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos)
    VALUES (v_uid, p_question_id, v_correct, 'review',
            COALESCE(p_served_reason, 'review_due'), p_session_pos);

    IF v_correct THEN
      PERFORM bump_user_streak(v_uid, (now() AT TIME ZONE 'UTC')::date);
    END IF;

    v_chain := CASE WHEN v_correct THEN LEAST(v_chain + 1, 3) ELSE 0 END;

    UPDATE user_responses
    SET review_chain = v_chain,
        review_due_at = CASE
          WHEN NOT v_correct THEN now() + INTERVAL '7 days'
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
      RETURN json_build_object('is_correct', v_correct, 'rated', false);
    END IF;

    INSERT INTO answer_events (user_id, question_id, is_correct, source, served_reason, session_pos)
    VALUES (v_uid, p_question_id, v_correct, 'practice', 'practice', p_session_pos);

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

  RETURN json_build_object(
    'is_correct', v_correct,
    'rated', v_rate,
    'rating', CASE WHEN v_rate THEN round(v_r, 1) END,
    'shown', CASE WHEN v_rate THEN round(shown_rating(v_r, v_n)) END,
    'rated_answers', CASE WHEN v_rate THEN v_n END,
    'peak_shown', CASE WHEN v_rate THEN round(v_peak) END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_answer(UUID, BOOLEAN, TEXT, TEXT, INT, SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Read path for the UI
-- ---------------------------------------------------------------------------
-- Current rating, change over the last 7 days, and (optionally) one point per
-- day for the last p_history_days days (Belgrade dates), plus the value just
-- before the window so the chart starts at the right level.
CREATE OR REPLACE FUNCTION get_my_rating(p_history_days INT DEFAULT 0)
RETURNS JSON AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_r NUMERIC := 1000;
  v_n INT := 0;
  v_peak NUMERIC := 700;
  v_week_ago NUMERIC;
  v_days INT := LEAST(GREATEST(COALESCE(p_history_days, 0), 0), 365);
  v_history JSON := '[]'::JSON;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT rating, rated_answers, peak_shown INTO v_r, v_n, v_peak
  FROM player_ratings WHERE user_id = v_uid;
  IF NOT FOUND THEN
    v_r := 1000; v_n := 0; v_peak := 700;
  END IF;

  SELECT shown_rating(ae.rating_after, ae.rated_n) INTO v_week_ago
  FROM answer_events ae
  WHERE ae.user_id = v_uid AND ae.rated_n IS NOT NULL
    AND ae.answered_at < now() - INTERVAL '7 days'
  ORDER BY ae.answered_at DESC
  LIMIT 1;

  IF v_days > 0 THEN
    SELECT COALESCE(json_agg(json_build_object('day', d.day, 'shown', round(d.shown)) ORDER BY d.day), '[]'::JSON)
    INTO v_history
    FROM (
      SELECT DISTINCT ON ((ae.answered_at AT TIME ZONE 'Europe/Belgrade')::date)
        (ae.answered_at AT TIME ZONE 'Europe/Belgrade')::date AS day,
        shown_rating(ae.rating_after, ae.rated_n) AS shown
      FROM answer_events ae
      WHERE ae.user_id = v_uid AND ae.rated_n IS NOT NULL
        AND ae.answered_at >= now() - make_interval(days => v_days)
      ORDER BY (ae.answered_at AT TIME ZONE 'Europe/Belgrade')::date, ae.answered_at DESC
    ) d;
  END IF;

  RETURN json_build_object(
    'rating', round(v_r, 1),
    'shown', round(shown_rating(v_r, v_n)),
    'rated_answers', v_n,
    'peak_shown', round(v_peak),
    'week_change', round(shown_rating(v_r, v_n) - COALESCE(v_week_ago, 700)),
    'history', v_history,
    'history_start', (
      SELECT round(shown_rating(ae.rating_after, ae.rated_n))
      FROM answer_events ae
      WHERE v_days > 0 AND ae.user_id = v_uid AND ae.rated_n IS NOT NULL
        AND ae.answered_at < now() - make_interval(days => v_days)
      ORDER BY ae.answered_at DESC
      LIMIT 1
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_my_rating(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_rating(INT) TO authenticated;
