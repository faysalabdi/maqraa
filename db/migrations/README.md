# Migrations

These SQL files are versioned production migrations. Apply in order.

## Applying a migration

**Option A · Supabase dashboard**
1. Open your project at supabase.com → SQL editor → New query
2. Paste the file contents
3. Run

**Option B · psql**
```sh
psql "$DATABASE_URL" -f db/migrations/0001_rls_and_triggers.sql
```

All migrations are written idempotent — re-running is safe.

## Current migrations

| # | File | What it does |
|---|---|---|
| 0001 | `0001_rls_and_triggers.sql` | Adds `handle_new_user` trigger to auto-create profile + streak rows on signup. Enables RLS on every table with proper select/insert/update/delete policies. Backfills profile + streak rows for users that signed up before the trigger existed. |
| 0002 | `0002_achievement_cleanup.sql` | Removes orphan achievements (`page-turner`, `night-owl`) whose criteria types (`pages_logged`, `session_time_window`) are no longer tracked. Run before `pnpm db:seed` to re-seed the replacement achievements (`test-champion`, `vocab-collector`). |
| 0003 | `0003_restage_wipe.sql` | Wipe-and-reseed for the 9-stage restage. Truncates every user-progress + catalogue table (`user_achievements`, `xp_events`, `vocab_items`, `comprehension_attempts`/`tests`, `reading_sessions`, `user_books`, `streaks`, `profiles`, `achievements`, `books`, `levels`) and reinserts profile + streak rows for existing auth users. Run before `pnpm db:seed`. Supersedes 0002 (achievements get re-seeded fresh). |
| 0003 | `0003_background_pdf_extraction.sql` | Background PDF extraction. Adds `extraction_status`/`extraction_error`/`pages_total`/`pages_done` to `user_texts` and the transient `text_chunks` table (per-chunk PDF bytes + extracted text, RLS-locked, emptied when a job finishes). Single-pass — safe to run as one query. |
| 0004 | `0004_pdf_imports_bucket.sql` | Direct-to-storage PDF uploads. Creates the private `pdf_imports` storage bucket (20 MB cap, PDF-only) with per-user folder policies. Needed because Vercel rejects request bodies over ~4.5 MB, so the browser uploads straight to Supabase Storage and the server action receives only the path. |

## Verification after applying 0001

In the Supabase dashboard:

1. **Database → Tables**: every user-scoped table shows the RLS shield as **enabled**.
2. **Database → Functions**: `handle_new_user` is listed.
3. **Database → Triggers**: `on_auth_user_created` on `auth.users` is listed.
4. Create a new test user via **Authentication → Users → Invite user**.
5. Open SQL editor and run `select * from profiles where id = '<new-id>'` — should return one row immediately.
