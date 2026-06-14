-- BLACKHAVEN event build — players whitelist + soft delete + per-run linkage.
-- Run AFTER 0001_init.sql on the (new) event Supabase project.
--
-- Design notes:
--   * players is a GLOBAL whitelist (shared identity across event games), not
--     scoped to an event. Only admin-registered nicknames may play.
--   * Soft delete via deleted_at. A partial unique index keeps the ACTIVE
--     nickname unique (case-insensitive) while allowing the same nickname to be
--     re-registered after a prior row was soft-deleted (events repeat).
--   * game_runs gains player_id (which whitelist row played) and achievements
--     (keys unlocked in that run; server-detected from the authoritative replay).

-- ── players ────────────────────────────────────────────────────────────────
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  nickname    text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Active (not soft-deleted) nicknames are unique, case-insensitive.
create unique index if not exists players_active_nickname_uidx
  on public.players (lower(nickname))
  where deleted_at is null;

-- ── game_runs additions ──────────────────────────────────────────────────────
alter table public.game_runs
  add column if not exists player_id uuid references public.players(id) on delete set null;

alter table public.game_runs
  add column if not exists achievements jsonb not null default '[]'::jsonb;

create index if not exists game_runs_player_idx
  on public.game_runs (
    player_id, event_id, status, verified, client_version, ruleset_version,
    score desc
  );
