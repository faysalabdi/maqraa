-- Private uploads (owner_id set) must only be readable by their owner; curated
-- books (owner_id null) stay public. The app reads books via the server (db
-- owner, bypassing RLS), so this is defense-in-depth for any future anon/auth
-- supabase-js read of `books`.
drop policy if exists "books public read" on public.books;
create policy "books owner or public read" on public.books
  for select using (owner_id is null or owner_id = auth.uid());
