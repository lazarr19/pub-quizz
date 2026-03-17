-- Fix: Replace recursive "Admins can read all profiles" policy
-- The old policy queries `profiles` inside its own RLS check, causing infinite recursion (500 error).

-- Drop the broken policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Create a helper function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = check_user_id),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Recreate admin policy using the helper function
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Also fix any other policies that reference profiles for admin checks
-- (these work because they check a DIFFERENT table, but let's use the helper for consistency)
