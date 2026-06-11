# Deploying arabic-xp to Vercel

Step by step. If you do these in order you should be live in ~20 minutes.

## 1. Prerequisites

- A GitHub repo (this one) connected to your Vercel account.
- A Supabase project (free tier is fine).
- An Anthropic API key with credit.

## 2. Provision Supabase

1. Create a project at <https://supabase.com>.
2. In **Project Settings → Database → Connection string**, copy:
   - the **Connection pooling** URL → that's `DATABASE_URL` (uses port `6543`).
   - the **Connection string** (direct) → that's `DIRECT_URL` (port `5432`).
3. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never expose)
4. Apply the schema from your laptop:
   ```bash
   cp .env.example .env.local
   # fill in the four Supabase values + ANTHROPIC_API_KEY
   pnpm install
   pnpm db:push
   pnpm db:seed
   ```
5. Apply the RLS policies. Open Supabase **SQL editor** and paste the contents of `db/migrations/0001_rls_and_triggers.sql`. Run it.

## 3. Configure Vercel

1. **Import** the GitHub repo into Vercel. Framework preset = Next.js.
2. Under **Project Settings → Environment Variables**, add (for *Production*, *Preview*, and *Development*):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase API tab |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase API tab |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase API tab (server only) |
   | `DATABASE_URL` | pooled connection string |
   | `DIRECT_URL` | direct connection string |
   | `ANTHROPIC_API_KEY` | from Anthropic console |
   | `ANTHROPIC_TEST_MODEL` | `claude-sonnet-4-6` |
   | `ANTHROPIC_FALLBACK_MODEL` | `claude-haiku-4-5-20251001` |
   | `NEXT_PUBLIC_APP_URL` | `https://YOUR-DEPLOYMENT.vercel.app` |
   | `ADMIN_EMAILS` | your email — gives access to `/admin/analytics` |
3. Hit **Deploy**.

## 4. Post-deploy in Supabase

After Vercel gives you a URL, go back to Supabase and update:

- **Auth → URL Configuration → Site URL**: `https://YOUR-DEPLOYMENT.vercel.app`
- **Redirect URLs**: add both `http://localhost:3000/auth/callback` and `https://YOUR-DEPLOYMENT.vercel.app/auth/callback`.

Custom domain? After you add it in Vercel, update Site URL and Redirect URLs again.

## 5. Verify

1. Visit your Vercel URL. Landing page loads.
2. Sign in with your email; OTP arrives within ~30 seconds.
3. After login you land on `/path`. The 8 stages render, Level 1 books unlocked.
4. Open رحلة سامر → Start reading. Tap a few Arabic words; the lookup sheet should appear (this triggers Claude — confirms your API key works).
5. Finish chapter 1, take the quiz, see XP awarded.
6. Visit `/admin/analytics` while signed in with your `ADMIN_EMAILS` address — usage data starts populating immediately.

## Production checklist

- [ ] Vercel build is green
- [ ] All env vars set in *all three* environments
- [ ] RLS policies applied (verify by running `select * from user_books` as a non-owner — should return 0 rows)
- [ ] Supabase **Auth → Rate Limits** set sensibly (default 4 OTPs/hr is fine for personal use)
- [ ] Anthropic key has spending limit set
- [ ] Custom domain attached and `NEXT_PUBLIC_APP_URL` matches

## Cost expectations (rough, per active reader per month)

- **Supabase**: free tier covers a single user comfortably; expect ~$25/mo when you grow past 50k MAU.
- **Vercel**: free hobby tier is enough for personal use; Pro at ~$20/mo when you start sharing.
- **Anthropic**:
  - Each word lookup is cached globally (Haiku call ~$0.0002). After everyone has tapped the same words, this trends to zero.
  - Each chapter quiz is cached per chapter (Haiku call ~$0.001). Same caching benefit.
  - Each whole-book test generation is one Sonnet call (~$0.05) with prompt caching reducing repeat calls to ~$0.005.
  - A daily reader doing ~30 lookups + 1 chapter quiz costs <$0.01/day until cache hits dominate.

## Local production smoke test

```bash
SKIP_ENV_VALIDATION=true pnpm build
pnpm start
# open http://localhost:3000
```
