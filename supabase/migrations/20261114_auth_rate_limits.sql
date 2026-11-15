-- Rate limits for the game API's sign-up and log-in (per IP, and per IP + username), so a
-- script can't mass-create accounts or guess passwords, and a stranger can't lock someone
-- else's account by failing on purpose (the old per-account lockout allowed that).
-- Run once in the SQL editor of the Supabase project the game API uses. Safe to re-run.

create table if not exists public.game_rate_limits (
  key          text        primary key,
  hits         integer     not null default 0,
  window_start timestamptz not null default now()
);
alter table public.game_rate_limits enable row level security; -- service key only

-- Counts `cost` hits against `k` in a fixed window and says whether the caller is still within
-- `max_hits` (cost 0 only checks: true while one more hit would still be allowed).
-- Atomic, so parallel requests can't slip past the limit.
drop function if exists public.game_hit(text, integer, integer);
create or replace function public.game_hit(k text, max_hits integer, window_s integer, cost integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into game_rate_limits as r (key, hits, window_start)
  values (k, greatest(cost, 0), now())
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => window_s) then greatest(cost, 0) else r.hits + greatest(cost, 0) end,
        window_start = case when r.window_start < now() - make_interval(secs => window_s) then now() else r.window_start end
  returning hits into n;
  return case when cost > 0 then n <= max_hits else n < max_hits end;
end $$;

-- Only the API (service key) may call it.
revoke all on function public.game_hit(text, integer, integer, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.game_hit(text, integer, integer, integer) to service_role;
  end if;
end $$;

-- Old windows pile up one row per IP; clear anything a day old now and then.
delete from public.game_rate_limits where window_start < now() - interval '1 day';
