-- RULE SLOT v1.0.0 — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- Only two tables: events (slug registry) and game_runs (one record per play).

-- ── events ────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  disabled_at timestamptz
);

-- ── game_runs ─────────────────────────────────────────────────────────────
create table if not exists public.game_runs (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  nickname         text,
  seed             text not null,
  actions          jsonb,
  client_results   jsonb,
  score            integer,
  best_spin_score  integer,
  client_version   text not null,
  ruleset_version  integer not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'submitted', 'rejected')),
  verified         boolean not null default false,
  reject_reason    text,
  created_at       timestamptz not null default now(),
  submitted_at     timestamptz
);

-- Leaderboard query: filter by status/verified/version, sort by score desc,
-- best_spin_score desc, submitted_at asc. Covers both per-event and total.
create index if not exists game_runs_leaderboard_idx
  on public.game_runs (
    status, verified, client_version, ruleset_version,
    score desc, best_spin_score desc, submitted_at asc
  );

create index if not exists game_runs_event_leaderboard_idx
  on public.game_runs (
    event_id, status, verified, client_version, ruleset_version,
    score desc, best_spin_score desc, submitted_at asc
  );

-- ── seed events ───────────────────────────────────────────────────────────
-- 'total' is the fixed all-events ranking slug; never delete it.
insert into public.events (slug, title, is_active) values
  ('total',      'Total Ranking',      true),
  ('blackhaven', 'Blackhaven Ranking', true),
  ('test',       'Test Ranking',       false)
on conflict (slug) do nothing;
