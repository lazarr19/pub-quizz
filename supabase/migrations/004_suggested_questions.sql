-- Migration: Suggested questions from players

-- 1. Suggested questions table
CREATE TABLE suggested_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_suggested_profile FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE suggested_questions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own suggestions
CREATE POLICY "Users can insert own suggestions" ON suggested_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own suggestions
CREATE POLICY "Users can read own suggestions" ON suggested_questions
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all suggestions
CREATE POLICY "Admins can read all suggestions" ON suggested_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can update suggestions (accept/reject)
CREATE POLICY "Admins can update suggestions" ON suggested_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can delete suggestions
CREATE POLICY "Admins can delete suggestions" ON suggested_questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
