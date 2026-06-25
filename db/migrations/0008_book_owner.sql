-- Private user uploads: owner_id null = curated public catalogue book; otherwise
-- the user who uploaded it (visible only to them).
ALTER TABLE books ADD COLUMN IF NOT EXISTS owner_id uuid;

CREATE INDEX IF NOT EXISTS books_owner_idx ON books (owner_id);

-- Apply with `pnpm db:push` (this repo applies schema via drizzle-kit push;
-- this file documents the change).
