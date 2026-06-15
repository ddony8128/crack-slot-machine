-- Season 1 WU7: per-(player, season, day) daily status — tracks the one-time
-- ad refill. Attempt counts + best score are derived from game_runs / best_scores.
create table if not exists public.daily_user_status (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players(id) on delete cascade,
  season_id      uuid not null references public.seasons(id) on delete cascade,
  date_key       text not null,
  ad_refill_used boolean not null default false,
  updated_at     timestamptz not null default now(),
  unique (player_id, season_id, date_key)
);
create index if not exists daily_user_status_idx
  on public.daily_user_status (player_id, season_id, date_key);
