-- 1. Add unique constraint on display_name (case-insensitive) to enforce unique nicknames
CREATE UNIQUE INDEX idx_profiles_display_name_lower ON profiles (LOWER(display_name));

-- 2. RPC to resolve a nickname to an email for login
--    Returns the email associated with a display_name, or NULL if not found.
--    SECURITY DEFINER so it can read auth.users without exposing the table.
CREATE OR REPLACE FUNCTION get_email_by_display_name(p_display_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE LOWER(p.display_name) = LOWER(p_display_name)
  LIMIT 1;

  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
