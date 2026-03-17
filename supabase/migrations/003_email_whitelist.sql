-- Migration: Email whitelist for registration

-- 1. Allowed emails table
CREATE TABLE allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- Authenticated users can check if an email is allowed (needed for signup check)
CREATE POLICY "Authenticated can read allowed_emails" ON allowed_emails
  FOR SELECT TO authenticated USING (true);

-- Admins can manage
CREATE POLICY "Admins can insert allowed_emails" ON allowed_emails
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "Admins can delete allowed_emails" ON allowed_emails
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 3. Allow anon users to check if an email is whitelisted (for signup form)
CREATE OR REPLACE FUNCTION is_email_allowed(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM allowed_emails WHERE lower(email) = lower(p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Block signups from non-whitelisted emails at the DB level
CREATE OR REPLACE FUNCTION check_email_whitelist()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'Registration is not allowed for this email address.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER enforce_email_whitelist
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION check_email_whitelist();
