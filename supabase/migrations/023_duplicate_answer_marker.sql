-- Migration: log duplicate fresh answers instead of dropping them silently
--
-- Context: a player reported a question repeating within one /quiz session
-- (2026-09-27), after the prefetch race fix of 2026-09-14. It could not be
-- confirmed or ruled out: user_responses allows one row per (user, question), so
-- a second answer to an already-answered question leaves no trace, and since 019
-- record_answer's ON CONFLICT DO NOTHING also skips the answer_events trigger.
--
-- Now a conflicting fresh answer writes a marker event:
--   source = 'fresh', served_reason = 'duplicate_fresh'
-- user_responses is untouched (the first answer stands). question_stats is
-- unaffected: it uses each user's first fresh event, and a marker is always
-- later than the answer it duplicates.
--
-- Reading the markers: same session_pos sequence / minutes apart = UI bug;
-- hours apart or overlapping sessions = most likely two open tabs.

-- Drop whatever check currently guards served_reason (looked up, not assumed by name).
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.answer_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%served_reason%'
  LOOP
    EXECUTE format('ALTER TABLE public.answer_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE answer_events ADD CONSTRAINT answer_events_served_reason_check
  CHECK (served_reason IN (
    'random',            -- plain random draw (pre-v2 behaviour)
    'onboarding',        -- random draw from the trimmed new-user pool
    'breaker',           -- easy question served after a miss streak
    'breaker_withheld',  -- breaker would have fired; held out (micro-randomised)
    'review_due',        -- spaced-repetition review
    'soft_reset',        -- review forced by a category soft reset
    'practice',          -- "Greške" practice mode
    'backfill',          -- reconstructed from user_responses by 019
    'duplicate_fresh'    -- fresh answer to an already-answered question (diagnostic)
  ));

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
