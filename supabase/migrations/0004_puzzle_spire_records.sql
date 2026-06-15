-- Season 1 WU8/WU9: per-player mode records.
-- Puzzle: best goals achieved per puzzle (tiebreak: fewer spins).
create table if not exists public.puzzle_user_records (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.players(id) on delete cascade,
  season_id           uuid not null references public.seasons(id) on delete cascade,
  puzzle_key          text not null,
  best_goals_achieved integer not null default 0,
  best_spin_count     integer,
  best_run_id         uuid references public.game_runs(id) on delete set null,
  updated_at          timestamptz not null default now(),
  unique (player_id, season_id, puzzle_key)
);
create index if not exists puzzle_records_dist_idx
  on public.puzzle_user_records (season_id, puzzle_key, best_goals_achieved);

-- Spire: best stage reached + best total score per player.
create table if not exists public.spire_user_records (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.players(id) on delete cascade,
  season_id           uuid not null references public.seasons(id) on delete cascade,
  best_stage_reached  integer not null default 0,
  best_total_score    integer not null default 0,
  best_run_id         uuid references public.game_runs(id) on delete set null,
  updated_at          timestamptz not null default now(),
  unique (player_id, season_id)
);
