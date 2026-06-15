-- Daily rank-reward settlement: once a day's noon window ends, its ranking is
-- settled ONCE and each player's daily rank reward is persisted into their daily
-- best_scores row's season_points. settled_at marks the day as done so the lazy
-- settlement pass skips it (idempotent).
alter table public.daily_challenges
  add column if not exists settled_at timestamptz;
