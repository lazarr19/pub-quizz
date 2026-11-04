-- Migration: Question serving v2 - Phase 1 (new-user pool trimming + breaker reserve)
--
-- get_question_batch() replaces get_next_question() for the quiz page:
--   * Fresh (unseen) questions stay a uniform random draw. Weighting toward a
--     difficulty band was considered and rejected: random sampling without
--     replacement does not skew what is left (validated 2026-11-04).
--   * Users with < 30 lifetime answers draw from a trimmed pool first: no hard tail
--     (difficulty_score < 0.45, ~10% of questions) and no unproven questions
--     (< 5 counted answers). Falls back to the full pool when that runs out.
--   * Each batch also returns up to p_reserve "reserve" questions: proven and easy
--     (difficulty_score >= 0.80, i.e. ~83% realised accuracy), falling back to the
--     easiest available. The client serves them only after a miss streak
--     (circuit breaker); unused reserves are never recorded as answered.
--
-- get_next_question() is kept unchanged for cached clients running old JS.

CREATE OR REPLACE FUNCTION get_question_batch(
  p_category_ids UUID[],
  p_limit INT DEFAULT 10,
  p_exclude_ids UUID[] DEFAULT '{}',
  p_reserve INT DEFAULT 2
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
  correct_option SMALLINT,
  difficulty_score NUMERIC,
  served_reason TEXT,
  is_reserve BOOLEAN
) AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_reserve INT := LEAST(GREATEST(COALESCE(p_reserve, 0), 0), 5);
  v_is_new BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) < 30 INTO v_is_new
  FROM user_responses ur
  WHERE ur.user_id = v_uid;

  RETURN QUERY
  WITH pool AS (
    SELECT
      q.id AS qid,
      qs.difficulty_score AS score,
      COALESCE(qs.response_count, 0) AS n
    FROM questions q
    LEFT JOIN question_stats qs ON qs.question_id = q.id
    WHERE q.category_id = ANY(p_category_ids)
      AND NOT EXISTS (
        SELECT 1 FROM user_responses ur
        WHERE ur.user_id = v_uid AND ur.question_id = q.id
      )
      AND q.id <> ALL(COALESCE(p_exclude_ids, '{}'))
  ),
  reserve AS (
    SELECT p.qid, p.score
    FROM pool p
    ORDER BY
      (COALESCE(p.score >= 0.80, false) AND p.n >= 5) DESC,
      random() * (CASE WHEN COALESCE(p.score >= 0.80, false) AND p.n >= 5 THEN 1 ELSE 0 END),
      p.score DESC NULLS LAST,
      random()
    LIMIT v_reserve
  ),
  main AS (
    SELECT
      p.qid,
      p.score,
      CASE
        WHEN v_is_new AND COALESCE(p.score >= 0.45, false) AND p.n >= 5 THEN 'onboarding'
        ELSE 'random'
      END AS reason
    FROM pool p
    WHERE p.qid NOT IN (SELECT r.qid FROM reserve r)
    ORDER BY
      -- New users: trimmed pool first, then the rest. Everyone else: pure random.
      (NOT v_is_new OR (COALESCE(p.score >= 0.45, false) AND p.n >= 5)) DESC,
      random()
    LIMIT v_limit
  ),
  picked AS (
    SELECT m.qid, m.score, m.reason, false AS reserve FROM main m
    UNION ALL
    SELECT r.qid, r.score, 'breaker', true FROM reserve r
  )
  SELECT
    q.id, q.category_id, q.type, q.content, q.image_url,
    q.option_1, q.option_2, q.option_3, q.correct_option,
    pk.score, pk.reason, pk.reserve
  FROM picked pk
  JOIN questions q ON q.id = pk.qid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_question_batch(UUID[], INT, UUID[], INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_question_batch(UUID[], INT, UUID[], INT) TO authenticated;
