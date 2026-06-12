-- Migration 0003 — background PDF extraction.
--   user_texts gains extraction lifecycle columns; new text_chunks table holds
--   per-chunk PDF bytes + extracted text while a big book is read in the
--   background, then is emptied once the job finishes.
--
-- Idempotent: safe to run on a partially-migrated database.

-- New enum for the extraction lifecycle. Creating a brand-new type inside a
-- transaction is fine (unlike ALTER TYPE ADD VALUE), so this can run as one pass.
DO $$ BEGIN
  CREATE TYPE text_extraction_status AS ENUM ('ready', 'processing', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE user_texts
  ADD COLUMN IF NOT EXISTS extraction_status text_extraction_status NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS extraction_error text,
  ADD COLUMN IF NOT EXISTS pages_total integer,
  ADD COLUMN IF NOT EXISTS pages_done integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS text_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id uuid NOT NULL REFERENCES user_texts(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_start integer NOT NULL,
  page_end integer NOT NULL,
  pdf_base64 text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  content_ar text,
  title_ar text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS text_chunks_text_chunk_idx
  ON text_chunks (text_id, chunk_index);
CREATE INDEX IF NOT EXISTS text_chunks_text_status_idx
  ON text_chunks (text_id, status);

-- text_chunks is only ever touched by the server (direct DB connection, which
-- bypasses RLS). Enable RLS with no policies so the Supabase API denies access.
ALTER TABLE text_chunks ENABLE ROW LEVEL SECURITY;
