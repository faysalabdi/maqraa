-- arabic-xp · production safety migration
-- Idempotent: safe to re-run.
-- Apply via Supabase SQL editor or `psql $DATABASE_URL -f db/migrations/0001_rls_and_triggers.sql`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Auto-create profile + streak rows on signup
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;

  insert into public.streaks (user_id, freezes_remaining)
    values (new.id, 2)
    on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Enable RLS on every table
--    Drizzle uses a direct Postgres connection (service-role-like) so server
--    actions bypass RLS. These policies are defense-in-depth + a documented
--    contract for any future Supabase-client-side access.
-- ─────────────────────────────────────────────────────────────────────────────

-- Catalogue (public read)
alter table public.levels       enable row level security;
alter table public.books        enable row level security;
alter table public.achievements enable row level security;

drop policy if exists "levels public read" on public.levels;
create policy "levels public read" on public.levels
  for select using (true);

drop policy if exists "books public read" on public.books;
create policy "books public read" on public.books
  for select using (true);

drop policy if exists "achievements public read" on public.achievements;
create policy "achievements public read" on public.achievements
  for select using (true);

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- user_books
alter table public.user_books enable row level security;

drop policy if exists "user_books select own" on public.user_books;
create policy "user_books select own" on public.user_books
  for select using (user_id = auth.uid());

drop policy if exists "user_books insert own" on public.user_books;
create policy "user_books insert own" on public.user_books
  for insert with check (user_id = auth.uid());

drop policy if exists "user_books update own" on public.user_books;
create policy "user_books update own" on public.user_books
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_books delete own" on public.user_books;
create policy "user_books delete own" on public.user_books
  for delete using (user_id = auth.uid());

-- reading_sessions
alter table public.reading_sessions enable row level security;

drop policy if exists "reading_sessions select own" on public.reading_sessions;
create policy "reading_sessions select own" on public.reading_sessions
  for select using (user_id = auth.uid());

drop policy if exists "reading_sessions insert own" on public.reading_sessions;
create policy "reading_sessions insert own" on public.reading_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "reading_sessions delete own" on public.reading_sessions;
create policy "reading_sessions delete own" on public.reading_sessions
  for delete using (user_id = auth.uid());

-- comprehension_tests (user_id = whoever generated the test for this book)
alter table public.comprehension_tests enable row level security;

drop policy if exists "tests select own" on public.comprehension_tests;
create policy "tests select own" on public.comprehension_tests
  for select using (user_id = auth.uid());

drop policy if exists "tests insert own" on public.comprehension_tests;
create policy "tests insert own" on public.comprehension_tests
  for insert with check (user_id = auth.uid());

-- comprehension_attempts
alter table public.comprehension_attempts enable row level security;

drop policy if exists "attempts select own" on public.comprehension_attempts;
create policy "attempts select own" on public.comprehension_attempts
  for select using (user_id = auth.uid());

drop policy if exists "attempts insert own" on public.comprehension_attempts;
create policy "attempts insert own" on public.comprehension_attempts
  for insert with check (user_id = auth.uid());

-- vocab_items
alter table public.vocab_items enable row level security;

drop policy if exists "vocab select own" on public.vocab_items;
create policy "vocab select own" on public.vocab_items
  for select using (user_id = auth.uid());

drop policy if exists "vocab insert own" on public.vocab_items;
create policy "vocab insert own" on public.vocab_items
  for insert with check (user_id = auth.uid());

drop policy if exists "vocab update own" on public.vocab_items;
create policy "vocab update own" on public.vocab_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "vocab delete own" on public.vocab_items;
create policy "vocab delete own" on public.vocab_items
  for delete using (user_id = auth.uid());

-- xp_events
alter table public.xp_events enable row level security;

drop policy if exists "xp_events select own" on public.xp_events;
create policy "xp_events select own" on public.xp_events
  for select using (user_id = auth.uid());

drop policy if exists "xp_events insert own" on public.xp_events;
create policy "xp_events insert own" on public.xp_events
  for insert with check (user_id = auth.uid());

-- user_achievements
alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements select own" on public.user_achievements;
create policy "user_achievements select own" on public.user_achievements
  for select using (user_id = auth.uid());

drop policy if exists "user_achievements insert own" on public.user_achievements;
create policy "user_achievements insert own" on public.user_achievements
  for insert with check (user_id = auth.uid());

-- streaks
alter table public.streaks enable row level security;

drop policy if exists "streaks select own" on public.streaks;
create policy "streaks select own" on public.streaks
  for select using (user_id = auth.uid());

drop policy if exists "streaks insert own" on public.streaks;
create policy "streaks insert own" on public.streaks
  for insert with check (user_id = auth.uid());

drop policy if exists "streaks update own" on public.streaks;
create policy "streaks update own" on public.streaks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill profile + streak rows for existing users
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.profiles (id)
  select id from auth.users
  on conflict (id) do nothing;

insert into public.streaks (user_id, freezes_remaining)
  select id, 2 from auth.users
  on conflict (user_id) do nothing;
