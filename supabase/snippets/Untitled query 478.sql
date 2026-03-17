ALTER TABLE suggested_questions
  ADD CONSTRAINT fk_suggested_profile
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;