-- Migration: Empirical question difficulty scoring
--
-- Difficulty is derived from real answer data (user_responses), not editorial
-- guesswork: each question's own accuracy is blended with its category's
-- accuracy, weighted by how many responses the question has (Bayesian
-- shrinkage). A brand-new question with zero responses simply gets its
-- category's average accuracy; as it accumulates responses, its own record
-- increasingly dominates the estimate.
--
-- difficulty_score is an accuracy fraction (0-1): LOWER = HARDER.

-- Shrinkage strength: how many "virtual" category-average responses a new
-- question starts with. Higher = trusts the category prior longer.
CREATE OR REPLACE FUNCTION question_difficulty_shrinkage() RETURNS INT AS $$
  SELECT 5;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE VIEW question_difficulty AS
WITH global_stats AS (
  SELECT
    COUNT(*)::NUMERIC AS n,
    COALESCE(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END), 0.75) AS accuracy
  FROM user_responses
),
category_stats AS (
  SELECT
    q.category_id,
    COUNT(ur.*)::NUMERIC AS n,
    AVG(CASE WHEN ur.is_correct THEN 1 ELSE 0 END) AS accuracy
  FROM questions q
  LEFT JOIN user_responses ur ON ur.question_id = q.id
  GROUP BY q.category_id
),
question_stats AS (
  SELECT
    q.id AS question_id,
    q.category_id,
    COUNT(ur.*)::NUMERIC AS n,
    AVG(CASE WHEN ur.is_correct THEN 1 ELSE 0 END) AS accuracy
  FROM questions q
  LEFT JOIN user_responses ur ON ur.question_id = q.id
  GROUP BY q.id, q.category_id
)
SELECT
  qs.question_id,
  qs.category_id,
  qs.n AS response_count,
  -- category accuracy, falling back to the global mean if the category
  -- itself has no responses yet (new category, no plays)
  COALESCE(cs.accuracy, (SELECT accuracy FROM global_stats)) AS category_accuracy,
  ROUND(
    (
      (qs.n * COALESCE(qs.accuracy, 0)) +
      (question_difficulty_shrinkage() * COALESCE(cs.accuracy, (SELECT accuracy FROM global_stats)))
    ) / (qs.n + question_difficulty_shrinkage()),
    4
  ) AS difficulty_score
FROM question_stats qs
LEFT JOIN category_stats cs ON cs.category_id = qs.category_id;

COMMENT ON VIEW question_difficulty IS
  'Empirical per-question difficulty (accuracy fraction, lower = harder), Bayesian-shrunk toward the category average. Cold-start (0 responses) resolves to the category average.';

-- Convenience lookup for a single question, e.g. from application code or
-- other functions that need one score without querying the whole view.
CREATE OR REPLACE FUNCTION get_question_difficulty(p_question_id UUID)
RETURNS NUMERIC AS $$
  SELECT difficulty_score FROM question_difficulty WHERE question_id = p_question_id;
$$ LANGUAGE sql STABLE;

GRANT SELECT ON question_difficulty TO authenticated, anon;
