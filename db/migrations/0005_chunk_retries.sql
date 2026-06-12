-- Migration 0005 — resilient chunk extraction.
--   Tracks per-chunk retry attempts and claim time so transient failures (rate
--   limits, timeouts) are auto-requeued instead of silently dropped, and a
--   chunk stranded by a killed invocation can be detected as stale and retried.
--
-- Idempotent: safe to re-run.

ALTER TABLE text_chunks
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
