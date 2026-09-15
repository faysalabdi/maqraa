-- Global cache of paragraph translations, keyed on a hash of the source text.
-- Shared across every reader of a book, so a paragraph is paid for once.

create table if not exists public.paragraph_translations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  ar text not null,
  en text not null,
  created_at timestamptz not null default now()
);

-- Public-read, same as word_lookups: the cache holds no per-user data, and
-- writes only ever happen server-side through the service role.
alter table public.paragraph_translations enable row level security;
drop policy if exists "paragraph_translations_read" on public.paragraph_translations;
create policy "paragraph_translations_read"
  on public.paragraph_translations for select using (true);
