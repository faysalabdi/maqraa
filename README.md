# arabic-xp

A gamified Arabic-reading tracker. Move from children's stories (قصص النبيين للأطفال, Diary of a Wimpy Kid in Arabic, Animal Farm) all the way up to classical scholars (Ibn al-Qayyim, Ibn Taymiyyah). Real comprehension verification via Claude-generated whole-book Arabic tests. XP, streaks, SRS vocabulary. Duolingo-style learning path.

> The motivation: reading Arabic books is hard because one unknown word breaks the flow and you never finish. This app turns the journey into a game where consistency, not perfection, is rewarded — and where every book completed actually proves you understand it.

## Stack

- **Next.js 15** App Router (TypeScript strict, React 19)
- **Tailwind v4** + shadcn-friendly primitives, Framer Motion, lucide-react
- **Supabase** Auth (magic link) + Postgres + RLS
- **Drizzle ORM** for typed queries
- **Anthropic SDK** (Claude Sonnet 4.6) for whole-book comprehension test generation, with prompt caching on the system block
- **Vercel** deployment

## Local development

```bash
pnpm install
cp .env.example .env.local           # fill in Supabase + Anthropic keys
pnpm db:push                         # apply Drizzle schema to your DB
pnpm db:seed                         # seed levels, books, achievements
pnpm dev                             # open http://localhost:3000
```

## Path / what's built

- M1 ✅ Project boot (Next 15 + TS + Tailwind v4 + Vitest)
- M2 ✅ Supabase auth (magic link) + middleware + Drizzle schema with RLS-ready tables
- M3 ✅ Seed data: 8 levels, ~50 books across Islamic, Arabic literature, translated novels, and classical works
- M4 ✅ Duolingo-style winding path with stage banners + book nodes (locked / unlocked / in-progress / completed states)
- M5 🚧 Reading log dialog + session XP grants
- M6 🚧 Claude comprehension test generation (scaffold present in `lib/ai/test-generator.ts`)
- M7 🚧 SM-2 SRS review queue (algorithm complete + tested in `lib/srs/sm2.ts`)
- M8 🚧 XP / streaks / achievements engine
- M9 🚧 Polish: stats, settings, onboarding/placement, Framer animations

See `docs/` and the in-app `/path` for the visual progression.

## Key files

- `lib/db/schema.ts` — full data model
- `db/seed/{levels,books,achievements}.ts` — curated reading ladder
- `lib/ai/test-generator.ts` + `prompts/test-system.md` — Claude prompt with caching
- `lib/srs/sm2.ts` — pure SM-2 algorithm with unit tests
- `lib/xp/{curve,rewards}.ts` — XP math
- `app/(app)/path/page.tsx` — the path
