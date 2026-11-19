-- Email list for "notify me when new practice tests are published"
-- (the /test-opste-informisanosti pages).
--
-- Anyone, logged in or not, can join, but nobody can read the list through the
-- API: the table has RLS on with no policies and no grants, and the only way in
-- is the function below. The function also never reveals whether an address is
-- already subscribed (a repeat signup is a silent no-op), so the public
-- endpoint cannot be used to check who is on the list.
--
-- Read the list from the Supabase dashboard / service role.

CREATE TABLE test_notify_signups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT test_notify_signups_email_lower  CHECK (email = lower(email)),
  CONSTRAINT test_notify_signups_email_length CHECK (length(email) <= 254),
  CONSTRAINT test_notify_signups_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT test_notify_signups_source_length CHECK (length(source) <= 40)
);

ALTER TABLE test_notify_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON test_notify_signups FROM anon, authenticated;

CREATE OR REPLACE FUNCTION subscribe_test_notifications(
  p_email  TEXT,
  p_source TEXT DEFAULT 'unknown'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  TEXT := lower(btrim(coalesce(p_email, '')));
  v_source TEXT := left(coalesce(nullif(btrim(p_source), ''), 'unknown'), 40);
BEGIN
  IF length(v_email) > 254
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  INSERT INTO test_notify_signups (email, source)
  VALUES (v_email, v_source)
  ON CONFLICT (email) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION subscribe_test_notifications(TEXT, TEXT) TO anon, authenticated;
