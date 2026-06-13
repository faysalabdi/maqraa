-- Migration 0006 — preserve source PDF for OCR-by-range fallback.
--   pdf-lib's copyPages can silently produce empty bytes for some page ranges
--   of encrypted source PDFs, losing real content. Keep the original upload's
--   storage path on the text row so those chunks can be OCR'd straight from
--   the source via Mistral's page-range parameter. Cleared on finalize.
--
-- Idempotent: safe to re-run.

ALTER TABLE user_texts
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;
