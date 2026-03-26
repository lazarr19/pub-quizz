-- Migration: Question reports from players

-- 1. Question reports table
CREATE TABLE question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_profile FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'factual_error',
    'multiple_correct',
    'wrong_options',
    'ambiguous',
    'outdated',
    'grammar'
  )),
  comment TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE question_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can insert own reports" ON question_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own reports
CREATE POLICY "Users can read own reports" ON question_reports
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all reports
CREATE POLICY "Admins can read all reports" ON question_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can update reports (mark resolved)
CREATE POLICY "Admins can update reports" ON question_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can delete reports
CREATE POLICY "Admins can delete reports" ON question_reports
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
