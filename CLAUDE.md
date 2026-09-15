# arabic-xp — agent notes

Read `README.md` first for the public overview. This file is for AI assistants picking up the project mid-build.

## Architecture decisions (already made — don't relitigate)

- Next.js 15 App Router + TS strict + React 19. No `src/` dir; `app/` and `lib/` live at the repo root.
- **Supabase** Auth + Postgres + RLS. All per-user tables key on `user_id uuid`, RLS policy `using (user_id = auth.uid())`. Catalogue tables (`levels`, `books`, `achievements`) are public-read.
- **Drizzle ORM** (not Prisma, not raw supabase-js). Schema lives in `lib/db/schema.ts`. Migrations in `db/migrations/`. `pnpm db:push` applies; `pnpm db:seed` populates catalogue tables.
- **Anthropic SDK** with `cache_control: { type: "ephemeral" }` on the system block. Default test model `claude-sonnet-4-6`. Fallback / short-answer grader `claude-haiku-4-5-20251001`. Never put model IDs in commit messages or files pushed to the repo (chat replies only).
- Comprehension tests are whole-book. The user doesn't upload anything — Claude generates 12 questions from its training-knowledge of the famous book. Low confidence ⇒ `is_fallback: true` + generic level-appropriate test using a Claude-composed Arabic passage.
- **OpenAI Realtime** powers `/talk` voice conversation practice only (everything else stays Anthropic). Server mints an ephemeral client secret at `app/api/realtime/session/route.ts` (auth + `conversation` quota kind), browser connects via WebRTC in `components/talk/TalkSession.tsx`. Tutor instructions live in `prompts/conversation-system.md`.
- 8 levels (Emerging Reader → Imam). Each book is a node on the Duolingo-style path. Locked future-stage books render as silhouettes with no title shown.
- Books span four genres: Islamic, Arabic literature, translated foreign works, graded readers, classical. The path is exposure-first, not genre-segregated.

## Mobile app (iOS, Expo)

- `mobile/` is an Expo (SDK 57, expo-router) app in the pnpm workspace; `packages/shared` (`@maqraa/shared`) holds pure logic both clients import (SM-2, XP rewards, Arabic utils, `tierFor`, reader sectionizer, API wire types). Web files under `lib/` re-export from the package — edit the package, not the shims.
- Mobile reads catalogue/per-user data straight from Supabase under RLS, and calls `app/api/v1/*` (Bearer `Authorization` header) for anything that grants XP, consumes AI quota, checks plan, or must hide answers. Those routes and the server actions share one implementation in `server/core/*` — change behavior there, keep both wrappers thin.
- `lib/api/require-user.ts getApiUser` resolves Bearer token first, then session cookie. New API routes for mobile follow this pattern.
- Payments: web = Stripe, iOS = Apple IAP via RevenueCat (`react-native-purchases`, entitlement `pro`, products `maqraa_pro_monthly`/`maqraa_pro_yearly`). Both webhooks upsert the single `subscriptions` row; each sync refuses to overwrite the other provider's still-live sub. `getPlan` is provider-agnostic — don't fork entitlement logic.
- Never mention or link web/Stripe pricing inside the iOS app (App Store guideline 3.1.1).
- Voice `/talk` is deferred to mobile v1.1; the realtime session route already accepts Bearer tokens.
- Mobile env: `mobile/.env.local` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`). Before any EAS production build, mirror every `EXPO_PUBLIC_*` into EAS env vars — missing ones crash the store binary at launch. `mobile/scripts/check-env.mjs` runs as the `eas-build-post-install` hook and now fails a production build outright when one is missing.
- OTA: `expo-updates` with `runtimeVersion.policy: "appVersion"` and a channel per EAS build profile. An update only reaches builds sharing its app version, so bumping `version` in `app.json` needs a new binary. Native changes (new packages, config-plugin edits) can never ship over the air.
- Releasing runs from GitHub Actions, not a laptop: `ios-release` (build, optional submit) and `ios-ota` (JS-only update). Both are `workflow_dispatch`. They need an `EXPO_TOKEN` repo secret and an App Store Connect API key on EAS — that key lives under **account** settings > Credentials, not the project credentials page, which only offers manual `.p12` upload. Signing credentials need one interactive bootstrap before CI can build: `--non-interactive` uses existing credentials but will not create them, and the website wizard only accepts a `.p12` exported from a Mac. Run `cd mobile && npx eas-cli credentials` once from any networked shell (a GitHub Codespace does), pick iOS, then **Build Credentials > All**. It reuses the account's existing Apple distribution certificate if there is one (Apple allows a single distribution cert across every app on the team) and creates the App Store provisioning profile against it. Every run after that is headless. Set `EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID` before running it: any one of those switches the CLI to authenticating with a JWT from the API key instead of the Apple ID web login, which Apple rejects from datacenter IPs with `iTunes service key is empty`. Keep the `.p8` outside the repo. The laptop-only `production` profile still reads local credentials and is untouched. `EXPO_PUBLIC_*` must be set as EAS environment variables — EAS builds inline them, GitHub secrets never reach that step.
- iOS layout: `supportsTablet: true`, so every screen is reviewed on iPad. Cap content with `centeredContent` / `centeredReading` from `lib/theme.ts` on any new scroll container rather than letting rows run the full 11-inch width.

## Build status

See README "Path / what's built". The plan file at `/root/.claude/plans/i-want-to-create-binary-swan.md` contains the full implementation plan.

## When extending

- **New tables**: edit `lib/db/schema.ts`, `pnpm db:generate`, then `pnpm db:push`. Add RLS policy SQL to the next migration manually for now.
- **New books**: two paths. For the baseline catalogue, append to `db/seed/books.ts` (+ `db/seed/chapters.ts`) and run `pnpm db:seed` — it upserts on `slug`. For ongoing additions, use the admin UI at `/admin/books` (gated by `ADMIN_EMAILS`): it writes `books` + `book_chapters` directly via `server/actions/admin.ts` and flips `has_full_text` on once a book has a chapter. Pro users can upload EPUBs at `/upload` (private shelves; admins' uploads join the catalogue). Admins can also import whole PDFs from Settings (web + iOS) — the upload dispatches the `import-pdf` GitHub Actions workflow, the same pipeline as `pnpm import-pdf`; see docs/CONTENT-SOURCING.md for setup.
- **New levels**: append to `db/seed/levels.ts`. Re-seed.
- **Prompt changes**: edit `prompts/test-system.md`, bump `PROMPT_VERSION` in `lib/ai/test-generator.ts`. The ephemeral-cache key changes automatically.
- **New server actions**: place in `server/actions/`. Always start by calling `createClient()` from `lib/supabase/server.ts` and asserting `user` before any DB write.

## Conventions

- Arabic text is rendered with the `font-arabic` utility class and `dir="rtl"`. The font is Noto Naskh Arabic with Amiri fallback (see `lib/fonts.ts`).
- Tailwind v4 — design tokens are CSS variables in `app/globals.css` under `@theme`. No `tailwind.config.ts`.
- No emojis in code, comments, or commit messages unless the user explicitly asks.
- No comments unless the WHY is non-obvious.
- Vitest for pure logic (SM-2, XP curve). Playwright (not set up yet) will cover the auth → log → test → SRS smoke path.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
