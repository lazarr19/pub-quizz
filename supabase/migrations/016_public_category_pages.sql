-- Migration: per-category public pages (SEO)
--
-- Adds stable, URL-safe slugs to categories so each one can have its own
-- indexable page at /kategorije/[slug], and exposes two SECURITY DEFINER
-- RPCs so those pages can show a real sample of questions (and question
-- counts) to anonymous visitors without granting anon a blanket SELECT on
-- the `questions` table (which would let anyone scrape the full question
-- bank, undermining the product's own value).
--
-- The sample RPC intentionally omits `correct_option` - visitors see the
-- question and its three options, but must sign up/demo to check the
-- answer. This keeps the page genuinely indexable content for "kviz
-- pitanja"-type queries while preserving the reason people create an
-- account.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Transliterating slugify for Serbian Latin script, used as a fallback for
-- any category name not covered by the explicit mapping below (e.g. one
-- added later through the admin UI rather than a migration).
CREATE OR REPLACE FUNCTION slugify_sr(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      lower(
        translate(
          replace(replace(input, 'đ', 'dj'), 'Đ', 'Dj'),
          'šŠčČćĆžŽ',
          'sScCcCzZ'
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

-- Explicit, hand-picked slugs for known category names (current and
-- planned) - preferred over the generic slugify output because a couple of
-- names transliterate to something less clean on their own.
UPDATE categories
SET slug = v.slug
FROM (VALUES
  ('Vojska i ratovanje', 'vojska-i-ratovanje'),
  ('Etnologija',         'etnologija'),
  ('Privreda',           'privreda'),
  ('Pravo',              'pravo'),
  ('Hrana i Piće',       'hrana-i-pice'),
  ('Nauka',              'nauka'),
  ('Psihologija',        'psihologija'),
  ('Film',               'film'),
  ('Film i TV',          'film-i-tv'),
  ('Mitologija',         'mitologija'),
  ('Opšte znanje',       'opste-znanje'),
  ('Muzika',             'muzika'),
  ('Umetnost',           'umetnost'),
  ('Geografija',         'geografija'),
  ('Jezik i pismo',      'jezik-i-pismo'),
  ('Sport',              'sport'),
  ('Književnost',        'knjizevnost'),
  ('Literatura',         'literatura'),
  ('Pop Kultura',        'pop-kultura'),
  ('Tehnologija',        'tehnologija'),
  ('Istorija',           'istorija'),
  ('Priroda',            'priroda'),
  ('Zabava',             'zabava'),
  ('Religija',           'religija'),
  ('Medicina',           'medicina')
) AS v(name, slug)
WHERE categories.name = v.name;

-- Anything left over (a category name not in the list above) still gets a
-- deterministic, unique slug so this migration never fails on a NOT NULL
-- backfill regardless of what's actually seeded in a given environment.
UPDATE categories
SET slug = slugify_sr(name)
WHERE slug IS NULL;

ALTER TABLE categories ALTER COLUMN slug SET NOT NULL;

-- Backfill emoji/description for categories that predate migration 011's
-- curated set and were never matched by its name-based UPDATE (their name
-- differs slightly: "Film i TV" vs "Film", "Literatura" vs "Književnost").
-- Only fills gaps - never overwrites existing curated content.
UPDATE categories
SET
  emoji       = COALESCE(categories.emoji, v.emoji),
  description = COALESCE(categories.description, v.description)
FROM (VALUES
  ('Film i TV',  '📺', 'Pitanja o filmovima, serijama, glumcima i TV produkciji.'),
  ('Literatura', '📖', 'Pitanja o knjigama, piscima, književnim delima i stilovima pisanja.')
) AS v(name, emoji, description)
WHERE categories.name = v.name;

-- Bulk question counts per category, for the /kategorije listing and each
-- category page (e.g. "247 pitanja"). Bypasses the questions RLS policy
-- (authenticated-only) since a count reveals nothing sensitive.
CREATE OR REPLACE FUNCTION get_public_category_counts()
RETURNS TABLE (category_id UUID, question_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT category_id, COUNT(*) AS question_count
  FROM questions
  GROUP BY category_id;
$$;

GRANT EXECUTE ON FUNCTION get_public_category_counts() TO anon, authenticated;

-- A small, deterministic sample of a category's questions for public
-- (unauthenticated) display. Deterministic ordering (by created_at) so the
-- page shows stable content across crawls/revalidations rather than a
-- different random set every time, which search engines can read as
-- low-quality/duplicate-shuffling content.
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
  ORDER BY q.created_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION get_public_sample_questions(UUID, INT) TO anon, authenticated;
