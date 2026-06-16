-- §6 season-score ledger: a `score_events` audit trail of every point grant plus
-- a `season_scores` cache of each player's per-mode + total season points. Written
-- at each grant point (spire/puzzle/daily submit + daily rank-reward settlement)
-- so the ledger captures one row per grant that actually changed the total/rank.
create table if not exists public.season_scores (
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  puzzle_score integer not null default 0,
  daily_score  integer not null default 0,
  spire_score  integer not null default 0,
  total_score  integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (player_id, season_id)
);
create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  source_type text not null,
  source_id text,
  previous_total_score integer not null,
  new_total_score integer not null,
  delta integer not null,
  previous_rank integer,
  new_rank integer,
  created_at timestamptz not null default now()
);
create index if not exists score_events_player_idx on public.score_events (player_id, season_id, created_at desc);
