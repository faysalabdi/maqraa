-- Migration 0007 — remove the personal-texts / PDF-upload subsystem.
--   The app moved to a curated, preloaded-books model: reading material now
--   lives only in the public `books` + `book_chapters` catalogue, added through
--   the admin UI. The per-user import/extraction tables, their enums, and the
--   PDF upload bucket are all dropped.
--
-- Idempotent: safe to re-run.

DROP TABLE IF EXISTS text_chunks;
DROP TABLE IF EXISTS text_quizzes;
DROP TABLE IF EXISTS user_texts;

DROP TYPE IF EXISTS text_extraction_status;
DROP TYPE IF EXISTS text_kind;

-- Tear down the PDF upload bucket and its RLS policies.
DROP POLICY IF EXISTS "pdf_imports_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "pdf_imports_read_own" ON storage.objects;
DROP POLICY IF EXISTS "pdf_imports_delete_own" ON storage.objects;
DELETE FROM storage.objects WHERE bucket_id = 'pdf_imports';
DELETE FROM storage.buckets WHERE id = 'pdf_imports';
