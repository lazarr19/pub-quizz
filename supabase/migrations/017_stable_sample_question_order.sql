-- Stable ordering for the public sample-question RPC.
--
-- 016 ordered only by created_at ASC. The question bank was bulk-seeded, so
-- many rows share an identical created_at, which makes that ORDER BY a
-- partial order. Postgres is then free to break ties however the chosen plan
-- happens to - and it chooses differently depending on LIMIT (top-N heapsort
-- for a small LIMIT, a full sort for a larger one). Verified locally: for the
-- "film" category, p_limit => 20 and p_limit => 50 disagreed on which rows
-- land in the first 20.
--
-- Two consequences, both bad:
--   1. /kategorije/[slug] is ISR with revalidate = 3600, so the 20 sample
--      questions on an indexable page could silently churn between
--      revalidations. Search engines re-crawling the page see the main
--      content change for no reason, which undermines indexing stability on
--      exactly the pages added for SEO.
--   2. Any caller trying to take a disjoint window (e.g. /pub-kviz-pitanja
--      skipping the first 20 so it does not duplicate the category page)
--      cannot rely on index positions being consistent between calls.
--
-- Adding q.id as a tiebreaker makes the sort a total order, so the result is
-- a deterministic function of (category, limit) and prefixes are consistent
-- across different limits. Behaviour is otherwise unchanged: same rows, same
-- columns, same grants, correct_option still never exposed.

CREATE OR REPLACE FUNCTION get_public_sample_questions(
  p_category_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  option_1 TEXT,
  option_2 TEXT,
  option_3 TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT q.id, q.content, q.option_1, q.option_2, q.option_3
  FROM questions q
  WHERE q.category_id = p_category_id
    AND q.type = 'text'
  ORDER BY q.created_at ASC, q.id ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION get_public_sample_questions(UUID, INT) TO anon, authenticated;
