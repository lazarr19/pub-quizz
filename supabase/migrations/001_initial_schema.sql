-- Supabase SQL Migration: Schema for Pub Quiz Trainer
-- Run this in the Supabase SQL Editor (local: http://127.0.0.1:54323)

-- 1. Create custom types
CREATE TYPE question_type AS ENUM ('text', 'image');

-- 2. Profiles table (extends auth.users with admin flag)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

-- 4. Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  type question_type NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  image_url TEXT,
  option_1 TEXT NOT NULL,
  option_2 TEXT NOT NULL,
  option_3 TEXT NOT NULL,
  correct_option SMALLINT NOT NULL CHECK (correct_option BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. User responses table (composite PK allows one response per user per question)
CREATE TABLE user_responses (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- 6. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', new.email));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. RPC: Get next random unanswered question
CREATE OR REPLACE FUNCTION get_next_question(
  p_user_id UUID,
  p_category_ids UUID[]
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
  correct_option SMALLINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.category_id, q.type, q.content, q.image_url,
         q.option_1, q.option_2, q.option_3, q.correct_option
  FROM questions q
  WHERE q.category_id = ANY(p_category_ids)
    AND q.id NOT IN (
      SELECT ur.question_id FROM user_responses ur WHERE ur.user_id = p_user_id
    )
  ORDER BY random()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Get player stats per category
CREATE OR REPLACE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  total_questions BIGINT,
  answered BIGINT,
  correct BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS category_id,
    c.name AS category_name,
    COUNT(DISTINCT q.id) AS total_questions,
    COUNT(DISTINCT ur.question_id) AS answered,
    COUNT(DISTINCT CASE WHEN ur.is_correct THEN ur.question_id END) AS correct
  FROM categories c
  LEFT JOIN questions q ON q.category_id = c.id
  LEFT JOIN user_responses ur ON ur.question_id = q.id AND ur.user_id = p_user_id
  GROUP BY c.id, c.name
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Reset responses for given categories
CREATE OR REPLACE FUNCTION reset_category_responses(
  p_user_id UUID,
  p_category_ids UUID[]
)
RETURNS void AS $$
BEGIN
  DELETE FROM user_responses
  WHERE user_id = p_user_id
    AND question_id IN (
      SELECT q.id FROM questions q WHERE q.category_id = ANY(p_category_ids)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_responses ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own profile, admins can read all
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Categories: everyone can read, admins can modify
CREATE POLICY "Anyone can read categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categories" ON categories FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can update categories" ON categories FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can delete categories" ON categories FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Questions: everyone can read, admins can modify
CREATE POLICY "Anyone can read questions" ON questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert questions" ON questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can update questions" ON questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can delete questions" ON questions FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- User responses: users can manage own responses
CREATE POLICY "Users can read own responses" ON user_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own responses" ON user_responses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own responses" ON user_responses FOR DELETE USING (auth.uid() = user_id);

-- 11. Storage bucket for question images
INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read question images" ON storage.objects FOR SELECT USING (bucket_id = 'question-images');
CREATE POLICY "Admins can upload question images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'question-images'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can delete question images" ON storage.objects FOR DELETE USING (
  bucket_id = 'question-images'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 12. Seed some categories
INSERT INTO categories (name) VALUES
  ('Opšte znanje'),
  ('Nauka'),
  ('Istorija'),
  ('Geografija'),
  ('Pop Kultura'),
  ('Sport'),
  ('Muzika'),
  ('Hrana i Piće'),
  ('Film i TV'),
  ('Literatura')
ON CONFLICT (name) DO NOTHING;
