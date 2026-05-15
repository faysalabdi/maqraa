# arabic-xp — agent notes

Read `README.md` first for the public overview. This file is for AI assistants picking up the project mid-build.

## Architecture decisions (already made — don't relitigate)

- Next.js 15 App Router + TS strict + React 19. No `src/` dir; `app/` and `lib/` live at the repo root.
- **Supabase** Auth + Postgres + RLS. All per-user tables key on `user_id uuid`, RLS policy `using (user_id = auth.uid())`. Catalogue tables (`levels`, `books`, `achievements`) are public-read.
- **Drizzle ORM** (not Prisma, not raw supabase-js). Schema lives in `lib/db/schema.ts`. Migrations in `db/migrations/`. `pnpm db:push` applies; `pnpm db:seed` populates catalogue tables.
- **Anthropic SDK** with `cache_control: { type: "ephemeral" }` on the system block. Default test model `claude-sonnet-4-6`. Fallback / short-answer grader `claude-haiku-4-5-20251001`. Never put model IDs in commit messages or files pushed to the repo (chat replies only).
- Comprehension tests are whole-book. The user doesn't upload anything — Claude generates 12 questions from its training-knowledge of the famous book. Low confidence ⇒ `is_fallback: true` + generic level-appropriate test using a Claude-composed Arabic passage.
- 8 levels (Emerging Reader → Imam). Each book is a node on the Duolingo-style path. Locked future-stage books render as silhouettes with no title shown.
- Books span four genres: Islamic, Arabic literature, translated foreign works, graded readers, classical. The path is exposure-first, not genre-segregated.

## Build status

See README "Path / what's built". The plan file at `/root/.claude/plans/i-want-to-create-binary-swan.md` contains the full implementation plan.

## When extending

- **New tables**: edit `lib/db/schema.ts`, `pnpm db:generate`, then `pnpm db:push`. Add RLS policy SQL to the next migration manually for now.
- **New books**: append to `db/seed/books.ts`. Run `pnpm db:seed` — it upserts on `slug`.
- **New levels**: append to `db/seed/levels.ts`. Re-seed.
- **Prompt changes**: edit `prompts/test-system.md`, bump `PROMPT_VERSION` in `lib/ai/test-generator.ts`. The ephemeral-cache key changes automatically.
- **New server actions**: place in `server/actions/`. Always start by calling `createClient()` from `lib/supabase/server.ts` and asserting `user` before any DB write.

## Conventions

- Arabic text is rendered with the `font-arabic` utility class and `dir="rtl"`. The font is Noto Naskh Arabic with Amiri fallback (see `lib/fonts.ts`).
- Tailwind v4 — design tokens are CSS variables in `app/globals.css` under `@theme`. No `tailwind.config.ts`.
- No emojis in code, comments, or commit messages unless the user explicitly asks.
- No comments unless the WHY is non-obvious.
- Vitest for pure logic (SM-2, XP curve). Playwright (not set up yet) will cover the auth → log → test → SRS smoke path.
