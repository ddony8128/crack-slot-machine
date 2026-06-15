-- RULE SLOT Season 1 — accounts, seasons, modes, season ranking.
-- Run AFTER 0001_init.sql. Additive: existing events/game_runs keep working.
--
-- Scope: players (auth) + seasons + best_scores + daily_challenges + puzzle_stages,
-- and new columns on game_runs so a single run table serves every mode
-- (event / daily / puzzle / spire). Puzzle & Spire content is driven by code
-- config for now; their tables/columns are created so the DB is forward-ready.

-- ── players (accounts) ───────────────────────────────────────────────────────
create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null,
  contact_type  text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
-- Active nickname is unique, case-insensitive (re-registerable after soft delete).
create unique index if not exists players_active_nickname_uidx
  on public.players (lower(nickname)) where deleted_at is null;
create index if not exists players_contact_idx
  on public.players (contact_type, contact_value) where deleted_at is null;

-- ── seasons ──────────────────────────────────────────────────────────────────
create table if not exists public.seasons (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  client_version  text not null,
  ruleset_version integer not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── game_runs: generalize from event-only to all modes ───────────────────────
alter table public.game_runs alter column event_id drop not null;
alter table public.game_runs
  add column if not exists player_id           uuid references public.players(id) on delete set null,
  add column if not exists season_id           uuid references public.seasons(id) on delete set null,
  add column if not exists mode                text not null default 'event',
  add column if not exists daily_date_key      text,
  add column if not exists puzzle_key          text,
  add column if not exists stage_index         integer,
  add column if not exists cleared             boolean,
  add column if not exists cleared_stage_count integer,
  add column if not exists season_points       integer;

create index if not exists game_runs_mode_idx
  on public.game_runs (season_id, mode, player_id, status, verified);
create index if not exists game_runs_daily_idx
  on public.game_runs (season_id, daily_date_key, status, verified, score desc);

-- ── best_scores: one row per (player, season, mode, scope) — ranking source ──
-- scope_key disambiguates within a mode: daily=date_key, puzzle=puzzle_key,
-- spire=''(single best run), event=event slug (unused here).
create table if not exists public.best_scores (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  season_id     uuid not null references public.seasons(id) on delete cascade,
  mode          text not null,
  scope_key     text not null default '',
  score         integer not null,
  season_points integer not null default 0,
  cleared       boolean,
  run_id        uuid references public.game_runs(id) on delete set null,
  updated_at    timestamptz not null default now(),
  unique (player_id, season_id, mode, scope_key)
);
create index if not exists best_scores_daily_idx
  on public.best_scores (season_id, mode, scope_key, score desc);
create index if not exists best_scores_player_idx
  on public.best_scores (season_id, player_id);

-- ── daily_challenges ─────────────────────────────────────────────────────────
create table if not exists public.daily_challenges (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid not null references public.seasons(id) on delete cascade,
  date_key        text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  seed            text not null,
  group_a_set_id  text not null,
  group_b_set_id  text not null,
  config          jsonb,
  created_at      timestamptz not null default now(),
  unique (season_id, date_key)
);

-- ── puzzle_stages (forward-ready; content currently in code config) ──────────
create table if not exists public.puzzle_stages (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons(id) on delete cascade,
  puzzle_key  text not null,
  index       integer not null,
  title       text not null,
  config      jsonb,
  created_at  timestamptz not null default now(),
  unique (season_id, puzzle_key)
);

-- ── seed Season 1 ────────────────────────────────────────────────────────────
insert into public.seasons (slug, title, starts_at, ends_at, client_version, ruleset_version, is_active)
values (
  '2026-06-season-1', 'RULE SLOT Season 1',
  '2026-06-15T03:00:00Z',  -- 2026-06-15 12:00 KST
  '2026-06-28T03:00:00Z',  -- 2026-06-28 12:00 KST
  '2.0.0', 2, true
)
on conflict (slug) do nothing;
