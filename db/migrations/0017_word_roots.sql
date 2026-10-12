-- Global cache of Arabic root/pattern analysis, keyed on the normalised lemma.
-- Public-read like word_lookups and paragraph_translations: a root is a fact
-- about the language, not about a reader, so every user shares one row and a
-- given lemma is only ever analysed once.
create table if not exists word_roots (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  lemma_ar text not null,
  root text,
  pattern text,
  created_at timestamptz not null default now()
);

alter table word_roots enable row level security;

drop policy if exists "word_roots are public read" on word_roots;
create policy "word_roots are public read" on word_roots for select using (true);
