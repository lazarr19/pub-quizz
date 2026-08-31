-- Migration: Remove mandatory email whitelist for registration
-- Anyone can now sign up; the allowed_emails table/admin UI is left in place
-- but no longer enforced.

DROP TRIGGER IF EXISTS enforce_email_whitelist ON auth.users;
DROP FUNCTION IF EXISTS check_email_whitelist();
