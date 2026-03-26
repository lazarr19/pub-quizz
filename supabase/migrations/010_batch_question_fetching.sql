-- Migration: Batch question fetching with prefetch dedup support

-- Update get_next_question to support batch fetching + exclude already-fetched IDs
CREATE OR REPLACE FUNCTION get_next_question(
  p_user_id UUID,
  p_category_ids UUID[],
  p_limit INT DEFAULT 1,
  p_exclude_ids UUID[] DEFAULT '{}'
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
DECLARE
  v_limit INT := LEAST(GREATEST(p_limit, 1), 50);
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT q.id, q.category_id, q.type, q.content, q.image_url,
         q.option_1, q.option_2, q.option_3, q.correct_option
  FROM questions q
  WHERE q.category_id = ANY(p_category_ids)
    AND q.id NOT IN (
      SELECT ur.question_id FROM user_responses ur WHERE ur.user_id = p_user_id
    )
    AND q.id != ALL(p_exclude_ids)
  ORDER BY random()
  LIMIT v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_next_mistake_question to support batch fetching + exclude already-fetched IDs
CREATE OR REPLACE FUNCTION get_next_mistake_question(
  p_user_id UUID,
  p_category_ids UUID[],
  p_limit INT DEFAULT 1,
  p_exclude_ids UUID[] DEFAULT '{}'
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
DECLARE
  v_limit INT := LEAST(GREATEST(p_limit, 1), 50);
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT q.id, q.category_id, q.type, q.content, q.image_url,
         q.option_1, q.option_2, q.option_3, q.correct_option
  FROM questions q
  INNER JOIN user_responses ur ON ur.question_id = q.id AND ur.user_id = p_user_id
  WHERE q.category_id = ANY(p_category_ids)
    AND ur.is_correct = false
    AND q.id != ALL(p_exclude_ids)
  ORDER BY random()
  LIMIT v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
