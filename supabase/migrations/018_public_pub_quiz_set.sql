-- A fixed, bounded pub-quiz set for /pub-kviz-pitanja - WITH the correct answer.
--
-- Why this exists instead of just adding correct_option to
-- get_public_sample_questions: that function is parameterised by category and
-- limit, so exposing answers through it would make up to 50 x 23 = ~1,150
-- questions (roughly a quarter of the bank) publicly answerable, and lets a
-- caller enumerate category by category. This function takes NO parameters
-- and returns one fixed set, so no matter how it is called it can only ever
-- reveal the same <= 42 questions. The other ~4,350 stay hidden behind
-- sign-up, which is still the product rule everywhere else on the site.
--
-- Answers are shown here on purpose: the page advertises a ready-to-run set
-- for a quiz night, and a quiz host cannot run one without an answer key.
-- /kategorije/[slug] deliberately keeps withholding answers - that is a
-- browse surface, not a usable quiz.
--
-- The window (rows 21-26 of each category) is chosen so this set never
-- overlaps the first 20 questions that /kategorije/[slug] already renders,
-- which keeps the two pages from duplicating each other's content. That
-- window is only meaningful because 017 made the ordering a total order;
-- do not remove the q.id tiebreaker below.
--
-- The round list lives here rather than in the page so there is one source
-- of truth. A slug missing from categories is simply skipped by the JOIN.

CREATE OR REPLACE FUNCTION get_public_pub_quiz_set()
RETURNS TABLE (
  round_order INT,
  category_id UUID,
  category_name TEXT,
  category_slug TEXT,
  category_emoji TEXT,
  id UUID,
  content TEXT,
  option_1 TEXT,
  option_2 TEXT,
  option_3 TEXT,
  correct_option SMALLINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH rounds(slug, round_order) AS (
    VALUES
      ('opste-znanje', 1),
      ('istorija',     2),
      ('geografija',   3),
      ('sport',        4),
      ('muzika',       5),
      ('film',         6),
      ('pop-kultura',  7)
  ),
  ranked AS (
    SELECT
      r.round_order,
      c.id    AS category_id,
      c.name  AS category_name,
      c.slug  AS category_slug,
      c.emoji AS category_emoji,
      q.id,
      q.content,
      q.option_1,
      q.option_2,
      q.option_3,
      q.correct_option,
      ROW_NUMBER() OVER (
        PARTITION BY c.id
        ORDER BY q.created_at ASC, q.id ASC
      ) AS rn
    FROM rounds r
    JOIN categories c ON c.slug = r.slug
    JOIN questions  q ON q.category_id = c.id AND q.type = 'text'
  )
  SELECT
    round_order,
    category_id,
    category_name,
    category_slug,
    category_emoji,
    id,
    content,
    option_1,
    option_2,
    option_3,
    correct_option
  FROM ranked
  WHERE rn > 20 AND rn <= 26
  ORDER BY round_order, rn;
$$;

GRANT EXECUTE ON FUNCTION get_public_pub_quiz_set() TO anon, authenticated;
