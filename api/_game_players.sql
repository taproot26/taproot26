create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  password_hash text not null,
  session_hash text unique,
  session_expires timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  character jsonb,
  inventory jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.game_players add column if not exists inventory jsonb not null default '[]'::jsonb;

-- No policies on purpose: the browser's anon key can't touch this table.
-- Only the server functions, using the service-role key, can read or write it.
alter table public.game_players enable row level security;
