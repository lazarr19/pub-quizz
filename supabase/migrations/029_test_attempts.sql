-- One row per finished practice test (the /test-opste-informisanosti tests).
-- Lets us count how many people complete a test, how many distinct browsers
-- that is, and later build a real score distribution and per-question stats.
--
-- Anyone can record an attempt, logged in or not, but nobody can read the table
-- through the API: RLS is on with no policies and no grants, and the only way
-- in is record_test_attempt(). No personal data is stored: client_id is a
-- random id kept in the visitor's browser, user_id is only set when the
-- visitor happens to be logged in.
--
-- The score is derived from the counts on the server instead of being trusted
-- from the client, and the counts are cross-checked against the answers, so a
-- sloppy or buggy client cannot record an inconsistent row. This is a practice
-- test with no stakes, so there is deliberately no stronger anti-abuse layer.
--
-- Scoring formula (FON): +1 correct, -0.1 wrong, 0 "ne znam", -0.1 unanswered.
-- Kept in tenths of a point so there is no float error.
--
-- timed_out = true means the timer ran out (or the attempt was found already
-- expired when the visitor came back); false means they pressed "Predaj".
--
-- Example: how many people completed the FON test?
--   SELECT count(*)                          AS attempts,
--          count(*) FILTER (WHERE NOT timed_out) AS submitted,
--          count(DISTINCT client_id)         AS unique_browsers,
--          round(avg(score_tenths) / 10.0, 1) AS avg_score
--   FROM test_attempts WHERE test_id = 'fon-probni-test-1';

CREATE TABLE test_attempts (
  attempt_id   UUID PRIMARY KEY,
  test_id      TEXT NOT NULL,
  client_id    UUID NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  correct      INT  NOT NULL,
  wrong        INT  NOT NULL,
  dont_know    INT  NOT NULL,
  blank        INT  NOT NULL,
  score_tenths INT  NOT NULL,
  duration_ms  INT  NOT NULL,
  timed_out    BOOLEAN NOT NULL DEFAULT false,
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT test_attempts_test_id_format CHECK (test_id ~ '^[a-z0-9-]{1,60}$'),
  CONSTRAINT test_attempts_counts_range   CHECK (
    correct BETWEEN 0 AND 100 AND wrong BETWEEN 0 AND 100 AND
    dont_know BETWEEN 0 AND 100 AND blank BETWEEN 0 AND 100 AND
    correct + wrong + dont_know + blank BETWEEN 1 AND 100
  ),
  CONSTRAINT test_attempts_duration_range CHECK (duration_ms BETWEEN 0 AND 10800000),
  CONSTRAINT test_attempts_answers_object CHECK (jsonb_typeof(answers) = 'object')
);

CREATE INDEX test_attempts_test_created_idx ON test_attempts (test_id, created_at);
CREATE INDEX test_attempts_client_idx ON test_attempts (client_id);

ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON test_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION record_test_attempt(
  p_attempt_id  UUID,
  p_test_id     TEXT,
  p_client_id   UUID,
  p_correct     INT,
  p_wrong       INT,
  p_dont_know   INT,
  p_blank       INT,
  p_duration_ms INT,
  p_timed_out   BOOLEAN,
  p_answers     JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_answers   JSONB := COALESCE(p_answers, '{}'::jsonb);
  v_answered  INT;
  v_dont_know INT;
BEGIN
  IF p_attempt_id IS NULL OR p_client_id IS NULL
     OR p_test_id IS NULL OR p_test_id !~ '^[a-z0-9-]{1,60}$' THEN
    RAISE EXCEPTION 'invalid_attempt' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_answers) <> 'object' THEN
    RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE value = '"n"'::jsonb)
    INTO v_answered, v_dont_know
  FROM jsonb_each(v_answers);

  -- Every value must be a letter a-e or "n".
  IF EXISTS (
    SELECT 1 FROM jsonb_each(v_answers)
    WHERE value NOT IN ('"a"'::jsonb, '"b"'::jsonb, '"c"'::jsonb, '"d"'::jsonb, '"e"'::jsonb, '"n"'::jsonb)
  ) THEN
    RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
  END IF;

  -- Counts must agree with the answers actually given.
  IF v_answered <> COALESCE(p_correct, 0) + COALESCE(p_wrong, 0) + COALESCE(p_dont_know, 0)
     OR v_dont_know <> COALESCE(p_dont_know, 0) THEN
    RAISE EXCEPTION 'inconsistent_counts' USING ERRCODE = '22023';
  END IF;

  INSERT INTO test_attempts (
    attempt_id, test_id, client_id, user_id,
    correct, wrong, dont_know, blank, score_tenths,
    duration_ms, timed_out, answers
  )
  VALUES (
    p_attempt_id, p_test_id, p_client_id, auth.uid(),
    p_correct, p_wrong, p_dont_know, p_blank,
    p_correct * 10 - p_wrong - p_blank,
    LEAST(GREATEST(COALESCE(p_duration_ms, 0), 0), 10800000),
    COALESCE(p_timed_out, false),
    v_answers
  )
  ON CONFLICT (attempt_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION record_test_attempt(UUID, TEXT, UUID, INT, INT, INT, INT, INT, BOOLEAN, JSONB)
  TO anon, authenticated;
