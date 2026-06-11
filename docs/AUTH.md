# Auth — how the sign-in flow actually works

Plain-English walkthrough so you can debug it without guessing.

## Stack

- **Provider:** Supabase Auth.
- **Method:** Email OTP (an 8-digit code) **or** magic link — same provider, two ways to use it. The current sign-in page uses the OTP code (more reliable on mobile). The callback route for the magic link variant also exists.
- **Sessions:** stored in HttpOnly cookies set by `@supabase/ssr`. The Next.js middleware refreshes the cookie on every request and redirects unauthenticated users to `/sign-in`.
- **RLS:** every per-user table has `user_id` and a policy `using (user_id = auth.uid())`. The DB is the source of truth for who can see what.

## End-to-end flow

```
User                Browser                     /sign-in                  Supabase                /auth/callback                 DB
 │                    │                           │                          │                          │                          │
 │ enter email        │                           │                          │                          │                          │
 ├───────────────────►│                           │                          │                          │                          │
 │                    │  supabase.auth            │                          │                          │                          │
 │                    │  .signInWithOtp(email)    │                          │                          │                          │
 │                    ├──────────────────────────►│  email an 8-digit code   │                          │                          │
 │                    │                           │ ─────────────────────────►                          │                          │
 │ receive code       │                           │                          │                          │                          │
 ◄─────────────────────────────────────────────── 8-digit code ───────────────                          │                          │
 │ enter code         │                           │                          │                          │                          │
 ├───────────────────►│ verifyOtp(email, code)    │                          │                          │                          │
 │                    ├──────────────────────────►│                          │                          │                          │
 │                    │   set session cookie ◄────│                          │                          │                          │
 │                    │   navigate to /path       │                          │                          │                          │
 │                    │                           │  middleware reads cookie │                          │                          │
 │                    │                           │  -> getUser() ok         │                          │                          │
 │                    │                           │  /path renders           │                          │                          │
 │                    │                           │                          │                          │  upsert profile row ────►│
```

For first-time users, the `/auth/callback` route (used by the magic-link variant only) creates the `profiles` and `streaks` rows. The OTP path needs the same upsert — add it to a server action if you switch sign-in styles. The middleware does *not* create rows; it only checks for a session.

## What you need to set up in Supabase (once)

1. **Project URL & anon key** → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. **Service role key** → `SUPABASE_SERVICE_ROLE_KEY`. Server-side only, never expose to the browser.
3. **Database connection string** → `DATABASE_URL` (pooled, port 6543) and optionally `DIRECT_URL` (direct, port 5432) for migrations. Find both under **Project Settings → Database → Connection string** in the Supabase dashboard.
4. **Auth → Email Templates → Magic Link**: switch the template to use the 6/8-digit OTP variable `{{ .Token }}` *and* a link with `{{ .ConfirmationURL }}`. The default already includes both.
5. **Auth → URL Configuration**:
   - Site URL: your production URL, e.g. `https://arabic-xp.vercel.app`
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://arabic-xp.vercel.app/auth/callback`.
6. **Auth → Providers → Email**: leave **Confirm email** ON for stricter signup; you can disable it for friction-free testing.
7. (Optional) **OAuth providers** (Google/Apple): add them on the Providers tab, set the redirect to `/auth/callback`. The current UI doesn't expose buttons for these yet — add them when you want.

## Local development

```bash
cp .env.example .env.local
# fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, ANTHROPIC_API_KEY
pnpm db:push
pnpm db:seed
pnpm dev
```

Sign in with your real inbox — Supabase will send a real email. Check spam if it doesn't arrive within ~30s.

## OTP code length

Supabase's default code is **6 digits**. The sign-in form accepts 6–8 digits. If you change the length under **Auth → Email → OTP length**, anything between 6 and 8 will work without code changes.

## Email not arriving — the SMTP problem

Supabase ships a built-in SMTP that exists only for testing. It is heavily rate-limited (a few sends per hour, sometimes per project per day), randomly drops emails when the destination is Gmail/Outlook/iCloud, and the rate limit is **per project**, not per user. Symptoms:

- The first 1–2 sign-ins work, then nothing arrives.
- It works on `localhost` but not on the Vercel URL.
- You see `Email rate limit exceeded` in **Supabase → Logs → Auth**.

**Fix: configure custom SMTP.** Resend is the easiest path.

1. Sign up at <https://resend.com>. Free tier = 3k emails/month, 100/day.
2. Add and verify your domain (or use their `onboarding@resend.dev` sandbox for testing).
3. Create an API key.
4. In Supabase → **Project Settings → Auth → SMTP Settings**:
   - **Enable Custom SMTP**: on
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **User**: `resend`
   - **Pass**: your Resend API key
   - **Sender email**: `auth@yourdomain.com` (must be a verified domain in Resend)
   - **Sender name**: `Arabic XP`
5. Save and click **Send test email**.

After that, OTPs deliver in <5s and the per-hour cap disappears.

## Common pitfalls

- **"Invalid OTP" right after sending one.** The default expiry is 60s. Bump it under Auth → Email if you need more.
- **No email at all on Vercel, fine on localhost.** Almost always the built-in SMTP being rate-limited. Configure custom SMTP (above).
- **Redirect loops at `/sign-in?redirect=/path`.** Your `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` is wrong; `getUser()` is failing silently. Check the server logs.
- **"failed to fetch" from the client.** `NEXT_PUBLIC_SUPABASE_URL` is missing in the environment Vercel uses for the running deployment. Re-deploy after adding the variable.
- **`getaddrinfo ENOTFOUND db.<project>.supabase.co` in Vercel logs.** You put the direct connection string in `DATABASE_URL`. Vercel can't reach IPv6. Switch to the Transaction-mode pooler URL (`...pooler.supabase.com:6543`). See `docs/DEPLOY.md`.
- **`column "<name>" does not exist` errors.** You merged a PR that touched `lib/db/schema.ts` and haven't run `pnpm db:push` against the hosted DB. Run it locally with `.env.local` pointing at production.
- **RLS errors when a server action writes.** You imported `db` (Drizzle) instead of the auth-aware Supabase client. `db` uses the service role and bypasses RLS — that's fine for *trusted* server actions, but only after you've called `supabase.auth.getUser()` and checked the result. Every server action in this repo follows that pattern.

## How to add a sign-out button

```tsx
"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

Wire it to a `<form action={signOut}>` (already done in `/settings`).

## How to add Google sign-in

1. In Supabase: Auth → Providers → Google → enable, paste your Google Cloud OAuth client ID/secret.
2. In Google Cloud → APIs & Services → Credentials, add `https://YOUR-PROJECT.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. On the sign-in page, add a button:
   ```tsx
   await supabase.auth.signInWithOAuth({
     provider: "google",
     options: { redirectTo: `${origin}/auth/callback` },
   });
   ```

That's it. The existing `/auth/callback` route handles the rest.
