-- Migration: Add practice mode support (re-answer incorrect questions)

-- RPC: Get next random incorrectly-answered question for practice
CREATE OR REPLACE FUNCTION get_next_mistake_question(
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
  INNER JOIN user_responses ur ON ur.question_id = q.id AND ur.user_id = p_user_id
  WHERE q.category_id = ANY(p_category_ids)
    AND ur.is_correct = false
  ORDER BY random()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Update a practice response (when user corrects a previous mistake)
CREATE OR REPLACE FUNCTION update_practice_response(
  p_user_id UUID,
  p_question_id UUID,
  p_is_correct BOOLEAN
)
RETURNS void AS $$
BEGIN
  UPDATE user_responses
  SET is_correct = p_is_correct, created_at = now()
  WHERE user_id = p_user_id AND question_id = p_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
