-- Server-side economy, real item ownership and farms that stay visible offline.
-- Run once in the SQL editor of the Supabase project the game API uses
-- (rxplfcuhsdvqposhpzyp). Safe to re-run.

alter table public.game_players
  -- gold, xp, kills, bag, looted sea chests, uncollected drops, reward rate limits
  add column if not exists econ      jsonb   not null default '{}'::jsonb,
  -- bumped on every economy write; writes are compare-and-swap on it
  add column if not exists econ_rev  integer not null default 0,
  -- the player's farm plot (crops, buildings, blocks, clubhouse members)
  add column if not exists farm      jsonb,
  -- which plot it is: unique, so two players can never hold the same plot
  add column if not exists farm_plot integer;

do $$ begin
  alter table public.game_players add constraint game_players_farm_plot_key unique (farm_plot);
exception when duplicate_object or duplicate_table then null; end $$;

-- Item ownership becomes real. Until now every account was handed the whole catalog in
-- `inventory`; from here on it holds only what the player owns. Existing players keep the
-- gear they have equipped (only rows whose inventory is still the full catalog, so re-running
-- this never takes away anything bought since).
update public.game_players p
set inventory = coalesce((
  select jsonb_agg(distinct e.value)
  from jsonb_each_text(coalesce(p.character -> 'equipment', '{}'::jsonb)) e
  where e.value is not null
), '[]'::jsonb)
where jsonb_typeof(p.inventory) = 'array' and jsonb_array_length(p.inventory) >= 40;

-- The API talks to this table only with the service key; keep it closed to the anon key
-- (which the browser now uses for Realtime multiplayer on this same project).
alter table public.game_players enable row level security;
