-- EMERGENCY RLS: the per-user tables had row level security OFF in the live DB,
-- so the public anon key (shipped in the app) could read/write every user's
-- data. This enables RLS everywhere and adds per-user policies. The server
-- (Drizzle over DATABASE_URL / service role) bypasses RLS, so server writes are
-- unaffected. Idempotent — safe to re-run. Run in the Supabase SQL editor.

-- ============================ public catalogue ============================
-- Readable by everyone; only the server writes these.
alter table public.levels        enable row level security;
alter table public.books         enable row level security;
alter table public.achievements  enable row level security;
alter table public.book_chapters enable row level security;
alter table public.word_lookups  enable row level security;

drop policy if exists "levels_read" on public.levels;
create policy "levels_read" on public.levels for select using (true);

drop policy if exists "books_read" on public.books;
create policy "books_read" on public.books for select using (true);

drop policy if exists "achievements_read" on public.achievements;
create policy "achievements_read" on public.achievements for select using (true);

drop policy if exists "book_chapters_read" on public.book_chapters;
create policy "book_chapters_read" on public.book_chapters for select using (true);

drop policy if exists "word_lookups_read" on public.word_lookups;
create policy "word_lookups_read" on public.word_lookups for select using (true);

-- ===================== per-user: full own-row CRUD =====================
-- profiles (keyed on id = auth.uid())
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- vocab_items (client saves / reviews / deletes its own words)
alter table public.vocab_items enable row level security;
drop policy if exists "vocab_select_own" on public.vocab_items;
create policy "vocab_select_own" on public.vocab_items for select using (user_id = auth.uid());
drop policy if exists "vocab_insert_own" on public.vocab_items;
create policy "vocab_insert_own" on public.vocab_items for insert with check (user_id = auth.uid());
drop policy if exists "vocab_update_own" on public.vocab_items;
create policy "vocab_update_own" on public.vocab_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "vocab_delete_own" on public.vocab_items;
create policy "vocab_delete_own" on public.vocab_items for delete using (user_id = auth.uid());

-- ===================== per-user: client reads own (writes are server-side) =====================
alter table public.user_books enable row level security;
drop policy if exists "user_books_select_own" on public.user_books;
create policy "user_books_select_own" on public.user_books for select using (user_id = auth.uid());

alter table public.user_chapter_progress enable row level security;
drop policy if exists "ucp_select_own" on public.user_chapter_progress;
create policy "ucp_select_own" on public.user_chapter_progress for select using (user_id = auth.uid());

alter table public.xp_events enable row level security;
drop policy if exists "xp_select_own" on public.xp_events;
create policy "xp_select_own" on public.xp_events for select using (user_id = auth.uid());

alter table public.user_achievements enable row level security;
drop policy if exists "ua_select_own" on public.user_achievements;
create policy "ua_select_own" on public.user_achievements for select using (user_id = auth.uid());

alter table public.streaks enable row level security;
drop policy if exists "streaks_select_own" on public.streaks;
create policy "streaks_select_own" on public.streaks for select using (user_id = auth.uid());

alter table public.reading_sessions enable row level security;
drop policy if exists "rs_select_own" on public.reading_sessions;
create policy "rs_select_own" on public.reading_sessions for select using (user_id = auth.uid());

alter table public.comprehension_attempts enable row level security;
drop policy if exists "ca_select_own" on public.comprehension_attempts;
create policy "ca_select_own" on public.comprehension_attempts for select using (user_id = auth.uid());

alter table public.conversation_sessions enable row level security;
drop policy if exists "cs_select_own" on public.conversation_sessions;
create policy "cs_select_own" on public.conversation_sessions for select using (user_id = auth.uid());

-- ===================== server-only: RLS on, NO client policy (deny anon/authenticated) =====================
-- The server uses the service role and bypasses RLS; the client must never touch these.
-- comprehension_tests + chapter_quizzes embed answer keys; subscriptions is payment data.
alter table public.comprehension_tests enable row level security;
alter table public.chapter_quizzes     enable row level security;
alter table public.ai_usage            enable row level security;
alter table public.usage_events        enable row level security;
alter table public.subscriptions       enable row level security;

-- Drop any pre-existing loose policies on server-only tables.
drop policy if exists "chapter_quizzes_public_read" on public.chapter_quizzes;
drop policy if exists "tests select own"  on public.comprehension_tests;
drop policy if exists "tests insert own"  on public.comprehension_tests;
drop policy if exists "xp_events insert own" on public.xp_events;

-- listening_exercises: content table (talk feature). Server-only for now.
alter table public.listening_exercises enable row level security;
