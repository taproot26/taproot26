-- Drill log for /japan. Written only by api/japan/[action].js using the service key.
-- RLS is on with no policies, so the public key can't read or write it.
create table if not exists public.drill_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  verb       text not null,
  target     text not null,
  section    text,
  typed      text not null,
  answer     text not null,
  ok         boolean not null
);

create index if not exists drill_log_created_idx on public.drill_log (created_at desc);

alter table public.drill_log enable row level security;
