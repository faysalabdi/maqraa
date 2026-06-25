-- Stripe-backed Pro subscriptions. One row per user, kept in sync by the Stripe
-- webhook. Absence of a row (or a non-active status) = free plan.
do $$ begin
  create type subscription_status as enum (
    'active', 'trialing', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  );
exception when duplicate_object then null;
end $$;

create table if not exists subscriptions (
  user_id uuid primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status subscription_status,
  price_id text,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on subscriptions (stripe_customer_id);

-- The app reads/writes subscriptions via the server (db owner, bypassing RLS).
-- RLS here is defense-in-depth: a user may read only their own row; only the
-- service role (webhook) writes.
alter table subscriptions enable row level security;

drop policy if exists "subscriptions self read" on public.subscriptions;
create policy "subscriptions self read" on public.subscriptions
  for select using (user_id = auth.uid());
