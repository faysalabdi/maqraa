-- Per-user, per-day AI-call counters for rate limiting (lookups, quiz/test
-- generation, upload analysis).
create table if not exists ai_usage (
  user_id uuid not null,
  day date not null,
  kind text not null,
  count integer not null default 0,
  primary key (user_id, day, kind)
);
