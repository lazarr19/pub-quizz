-- Migration: fix Disk IO budget depletion from get_question_batch()
--
-- Root cause: get_question_batch() (020/021) runs on roughly every 10
-- questions answered. Two parts of it scale with CATEGORY SIZE rather than
-- batch size, and categories run up to ~700 questions, often with several
-- selected at once (up to the full 5,383-row bank):
--
--   1. v_total / v_unseen were computed via a NOT EXISTS anti-join evaluated
--      once per question row in the selected categories - a second,
--      redundant full scan on top of the one the `fresh` CTE already does.
--   2. The `fresh` CTE anti-joins the ENTIRE selected-category pool against
--      user_responses, then `ORDER BY random()` sorts the whole surviving
--      set just to pick a handful of rows. That sort can't use an index
--      (random() has no order to exploit) and spills to disk once it
--      outgrows work_mem - on every single batch call.
--
-- Two of prod's most active players are each answering 100+ batches/day, so
-- this was repeatedly re-sorting large portions of the question bank -
-- plausible direct cause of the Disk IO Budget warning.
--
-- Fix:
--   1. v_unseen = v_total - (count of this user's own answers in these
--      categories), which only scans the user's own history (bounded by
--      their lifetime answer count) instead of the whole category.
--   2. Pick unseen questions by sampling a small, indexed-bounded set of
--      candidate rows around a random point in questions(category_id,
--      sample_key), anti-join + sort only THAT small set, and fall back to
--      the old full-scan method only when the sample doesn't yield enough
--      unseen rows - which only happens when the user has nearly exhausted
--      the category, i.e. exactly when the full scan is already cheap.
--
-- No behavioural change: same columns, same selection rules, same grants.

-- ---------------------------------------------------------------------------
-- 1. Indexed random-sampling key
-- ---------------------------------------------------------------------------
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sample_key DOUBLE PRECISION;
UPDATE questions SET sample_key = random() WHERE sample_key IS NULL;
ALTER TABLE questions ALTER COLUMN sample_key SET NOT NULL;
ALTER TABLE questions ALTER COLUMN sample_key SET DEFAULT random();

CREATE INDEX IF NOT EXISTS questions_category_sample_idx
  ON questions (category_id, sample_key);

COMMENT ON COLUMN questions.sample_key IS
  'Fixed random tiebreaker, indexed with category_id, so get_question_batch() can pick a few random unseen questions via an index range scan instead of sorting the whole category.';

-- ---------------------------------------------------------------------------
-- 2. get_question_batch(): same signature as 021, cheaper body
-- ---------------------------------------------------------------------------
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
  is_reserve BOOLEAN,
  kind TEXT
) AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_reserve INT := LEAST(GREATEST(COALESCE(p_reserve, 0), 0), 5);
  v_exclude UUID[] := COALESCE(p_exclude_ids, '{}');
  v_lifetime INT;
  v_total INT;
  v_seen_in_categories INT;
  v_unseen INT;
  v_share NUMERIC;
  v_n_review INT;
  v_seed DOUBLE PRECISION := random();
  v_cap INT;
  v_window DOUBLE PRECISION;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_cap := GREATEST((v_limit + v_reserve) * 15, 150);

  SELECT COUNT(*) INTO v_lifetime FROM user_responses ur WHERE ur.user_id = v_uid;

  SELECT COUNT(*) INTO v_total
  FROM questions q
  WHERE q.category_id = ANY(p_category_ids);

  SELECT COUNT(*) INTO v_seen_in_categories
  FROM user_responses ur
  JOIN questions q ON q.id = ur.question_id
  WHERE ur.user_id = v_uid
    AND q.category_id = ANY(p_category_ids);

  v_unseen := v_total - v_seen_in_categories;

  -- Window width targets ~v_cap rows out of v_total regardless of category
  -- size, so the candidate scan below stays a narrow (cheap) index range
  -- scan instead of degenerating into a ~50%-selectivity half-table scan.
  v_window := LEAST(1.0, v_cap::NUMERIC / GREATEST(v_total, 1));

  v_share := CASE
    WHEN v_unseen = 0 THEN 1.0
    WHEN v_lifetime < 30 THEN 0
    WHEN v_unseen < 0.2 * v_total THEN 0.4
    WHEN v_lifetime >= 300 THEN 0.2
    ELSE 0
  END;
  v_n_review := ROUND(v_limit * v_share);

  RETURN QUERY
  WITH candidate_ids AS (
    (
      SELECT q.id AS qid
      FROM questions q
      WHERE q.category_id = ANY(p_category_ids)
        AND q.sample_key >= v_seed
        AND q.sample_key < LEAST(v_seed + v_window, 1.0)
    )
    UNION ALL
    (
      -- Wraps the window around 1.0 back to 0 so results near the top of
      -- the [0,1) range aren't under-sampled.
      SELECT q.id AS qid
      FROM questions q
      WHERE v_seed + v_window > 1.0
        AND q.category_id = ANY(p_category_ids)
        AND q.sample_key < (v_seed + v_window - 1.0)
    )
  ),
  fresh_sampled AS (
    SELECT
      q.id AS qid,
      qs.difficulty_score AS score,
      COALESCE(qs.response_count, 0) AS n
    FROM candidate_ids ci
    JOIN questions q ON q.id = ci.qid
    LEFT JOIN question_stats qs ON qs.question_id = q.id
    WHERE NOT EXISTS (
        SELECT 1 FROM user_responses ur
        WHERE ur.user_id = v_uid AND ur.question_id = q.id
      )
      AND q.id <> ALL(v_exclude)
  ),
  fresh AS (
    -- Common case: the random sample already has enough unseen rows.
    SELECT fs.qid, fs.score, fs.n FROM fresh_sampled fs
    WHERE (SELECT COUNT(*) FROM fresh_sampled) >= (v_limit + v_reserve)

    UNION ALL

    -- Rare fallback: sample came up short, meaning this user has nearly
    -- exhausted these categories - so the unseen pool is small and a full
    -- scan of it is cheap anyway.
    SELECT
      q.id AS qid,
      qs.difficulty_score AS score,
      COALESCE(qs.response_count, 0) AS n
    FROM questions q
    LEFT JOIN question_stats qs ON qs.question_id = q.id
    WHERE (SELECT COUNT(*) FROM fresh_sampled) < (v_limit + v_reserve)
      AND q.category_id = ANY(p_category_ids)
      AND NOT EXISTS (
        SELECT 1 FROM user_responses ur
        WHERE ur.user_id = v_uid AND ur.question_id = q.id
      )
      AND q.id <> ALL(v_exclude)
  ),
  due AS (
    SELECT
      ur.question_id AS qid,
      qs.difficulty_score AS score,
      ur.review_chain AS chain,
      ur.review_forced AS forced,
      COALESCE(ur.review_due_at, now()) AS due_at,
      (q.content_updated_at IS NOT NULL
        AND COALESCE(ur.last_reviewed_at, ur.first_answered_at) < q.content_updated_at) AS edited
    FROM user_responses ur
    JOIN questions q ON q.id = ur.question_id
    LEFT JOIN question_stats qs ON qs.question_id = ur.question_id
    WHERE ur.user_id = v_uid
      AND q.category_id = ANY(p_category_ids)
      AND q.id <> ALL(v_exclude)
      AND (
        ur.review_due_at <= now()
        OR (
          q.content_updated_at IS NOT NULL
          AND COALESCE(ur.last_reviewed_at, ur.first_answered_at) < q.content_updated_at
        )
      )
  ),
  reserve AS (
    SELECT c.qid, c.score, c.kind
    FROM (
      SELECT f.qid, f.score, 'fresh'::TEXT AS kind,
             CASE WHEN COALESCE(f.score >= 0.80, false) AND f.n >= 5 THEN 0 ELSE 2 END AS tier
      FROM fresh f
      UNION ALL
      SELECT d.qid, d.score, 'review'::TEXT, 1
      FROM due d
      WHERE d.chain > 0
    ) c
    ORDER BY c.tier, random() * (CASE WHEN c.tier < 2 THEN 1 ELSE 0 END), c.score DESC NULLS LAST, random()
    LIMIT v_reserve
  ),
  review_ranked AS (
    SELECT
      d.qid, d.score,
      CASE WHEN d.forced THEN 'soft_reset' ELSE 'review_due' END AS reason,
      ROW_NUMBER() OVER (
        ORDER BY d.edited DESC, (d.chain = 0) DESC, d.due_at + random() * INTERVAL '7 days'
      ) AS rn
    FROM due d
    WHERE d.qid NOT IN (SELECT r.qid FROM reserve r)
  ),
  fresh_ranked AS (
    SELECT
      f.qid, f.score,
      CASE
        WHEN v_lifetime < 30 AND COALESCE(f.score >= 0.45, false) AND f.n >= 5 THEN 'onboarding'
        ELSE 'random'
      END AS reason,
      ROW_NUMBER() OVER (
        ORDER BY
          (v_lifetime >= 30 OR (COALESCE(f.score >= 0.45, false) AND f.n >= 5)) DESC,
          random()
      ) AS rn
    FROM fresh f
    WHERE f.qid NOT IN (SELECT r.qid FROM reserve r)
  ),
  quota AS (
    SELECT LEAST(
      (SELECT COUNT(*) FROM review_ranked),
      GREATEST(
        v_n_review,
        v_limit - (SELECT COUNT(*) FROM fresh_ranked),
        LEAST((SELECT COUNT(*) FROM due d WHERE d.edited), 1)
      )
    )::INT AS n_review
  ),
  picked AS (
    SELECT rr.qid, rr.score, rr.reason, false AS reserve, 'review'::TEXT AS kind
    FROM review_ranked rr, quota
    WHERE rr.rn <= quota.n_review
    UNION ALL
    SELECT fr.qid, fr.score, fr.reason, false, 'fresh'
    FROM fresh_ranked fr, quota
    WHERE fr.rn <= v_limit - quota.n_review
    UNION ALL
    SELECT r.qid, r.score, 'breaker', true, r.kind
    FROM reserve r
  )
  SELECT
    q.id, q.category_id, q.type, q.content, q.image_url,
    q.option_1, q.option_2, q.option_3, q.correct_option,
    pk.score, pk.reason, pk.reserve, pk.kind
  FROM picked pk
  JOIN questions q ON q.id = pk.qid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_question_batch(UUID[], INT, UUID[], INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_question_batch(UUID[], INT, UUID[], INT) TO authenticated;
