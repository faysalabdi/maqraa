-- Migration 0002 — everything added since 0001:
--   in-app book chapters (PR #2), usage analytics (PR #2),
--   personal texts + URL/PDF/story imports (PR #5),
--   sectioned reader + per-section quizzes (PR #5),
--   conversation + listening practice (PR #5).
--
-- Idempotent: safe to run on a partially-migrated database.
--
-- IMPORTANT: Run pass 1 ALONE first, then pass 2. `ALTER TYPE ... ADD VALUE`
-- cannot share a transaction with table DDL in Postgres.

-- ────────────────────────────── PASS 1 ──────────────────────────────
-- ALTER TYPE ADD VALUE is non-transactional.

ALTER TYPE xp_reason ADD VALUE IF NOT EXISTS 'conversation_turn';
ALTER TYPE xp_reason ADD VALUE IF NOT EXISTS 'listening_passed';

DO $$ BEGIN
  CREATE TYPE text_kind AS ENUM ('imported', 'pasted', 'pdf', 'generated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE chapter_status AS ENUM ('unread', 'reading', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────── PASS 2 ──────────────────────────────

-- catalogue: books.has_full_text
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS has_full_text boolean NOT NULL DEFAULT false;

-- ─── in-app book reader: chapters, per-user progress, cached quizzes ───
CREATE TABLE IF NOT EXISTS book_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id),
  chapter_number integer NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  content_ar text NOT NULL,
  source text NOT NULL DEFAULT 'public_domain'
);
CREATE UNIQUE INDEX IF NOT EXISTS chapters_book_number_idx
  ON book_chapters (book_id, chapter_number);

CREATE TABLE IF NOT EXISTS user_chapter_progress (
  user_id uuid NOT NULL,
  chapter_id uuid NOT NULL REFERENCES book_chapters(id),
  status chapter_status NOT NULL DEFAULT 'unread',
  quiz_score numeric(5, 2),
  completed_at timestamptz,
  PRIMARY KEY (user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS chapter_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL UNIQUE REFERENCES book_chapters(id),
  model text NOT NULL,
  questions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── global cache of Claude word lookups ───
CREATE TABLE IF NOT EXISTS word_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  surface text NOT NULL,
  lemma_ar text NOT NULL,
  gloss_en text NOT NULL,
  pos text,
  example_ar text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── usage analytics ───
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  event text NOT NULL,
  path text,
  props jsonb,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_user_occurred_idx
  ON usage_events (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS usage_event_occurred_idx
  ON usage_events (event, occurred_at);

-- ─── personal texts (URL / paste / PDF / generated) ───
CREATE TABLE IF NOT EXISTS user_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  kind text_kind NOT NULL DEFAULT 'imported',
  level integer,
  source_url text,
  content_ar text NOT NULL,
  word_count integer NOT NULL DEFAULT 0,
  current_section integer NOT NULL DEFAULT 0,
  total_sections integer NOT NULL DEFAULT 1,
  completed_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_texts_user_created_idx
  ON user_texts (user_id, created_at);

-- backfill columns if user_texts already existed without them
ALTER TABLE user_texts
  ADD COLUMN IF NOT EXISTS kind text_kind NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS current_section integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sections integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS text_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id uuid NOT NULL REFERENCES user_texts(id) ON DELETE CASCADE,
  section_number integer NOT NULL,
  questions jsonb NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS text_quizzes_text_section_idx
  ON text_quizzes (text_id, section_number);

-- ─── practice: conversation + listening ───
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scenario text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  turns integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
  ON conversation_sessions (user_id, updated_at);

CREATE TABLE IF NOT EXISTS listening_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level integer NOT NULL,
  topic text NOT NULL,
  passage_ar text NOT NULL,
  questions jsonb NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listening_level_idx
  ON listening_exercises (level);

-- ─── RLS ───
ALTER TABLE book_chapters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_quizzes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_lookups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_texts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_quizzes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_exercises   ENABLE ROW LEVEL SECURITY;

-- public-read catalogue / cache tables
DROP POLICY IF EXISTS "chapters_public_read" ON book_chapters;
CREATE POLICY "chapters_public_read" ON book_chapters FOR SELECT USING (true);

DROP POLICY IF EXISTS "chapter_quizzes_public_read" ON chapter_quizzes;
CREATE POLICY "chapter_quizzes_public_read" ON chapter_quizzes FOR SELECT USING (true);

DROP POLICY IF EXISTS "word_lookups_public_read" ON word_lookups;
CREATE POLICY "word_lookups_public_read" ON word_lookups FOR SELECT USING (true);

DROP POLICY IF EXISTS "listening_public_read" ON listening_exercises;
CREATE POLICY "listening_public_read" ON listening_exercises FOR SELECT USING (true);

-- per-user tables
DROP POLICY IF EXISTS "user_chapter_progress_self" ON user_chapter_progress;
CREATE POLICY "user_chapter_progress_self" ON user_chapter_progress
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_texts_self" ON user_texts;
CREATE POLICY "user_texts_self" ON user_texts
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "text_quizzes_self" ON text_quizzes;
CREATE POLICY "text_quizzes_self" ON text_quizzes
  USING (text_id IN (SELECT id FROM user_texts WHERE user_id = auth.uid()))
  WITH CHECK (text_id IN (SELECT id FROM user_texts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "conversations_self" ON conversation_sessions;
CREATE POLICY "conversations_self" ON conversation_sessions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- usage_events: app writes via service role; anon should not read
DROP POLICY IF EXISTS "usage_no_read" ON usage_events;
CREATE POLICY "usage_no_read" ON usage_events FOR SELECT USING (false);
