-- §9 lazy-settlement idempotency backstop.
--
-- The primary guard is the atomic settle-claim in settleDailyChallenge
-- (UPDATE daily_challenges SET settled_at = ... WHERE settled_at IS NULL), which
-- lets exactly one concurrent settlement pass proceed. This index is a
-- defense-in-depth backstop: it makes a duplicate DAILY_RANK_REWARD ledger row
-- impossible at the DB level, keyed by (player, season, date).
--
-- It is PARTIAL — scoped to source_type = 'DAILY_RANK_REWARD' only — because other
-- event types are legitimately repeatable for the same source_id (e.g. a player
-- can improve the same puzzle several times, each emitting PUZZLE_RECORD_IMPROVED
-- with source_id = puzzleKey). A blanket unique constraint would wrongly block
-- those.
create unique index if not exists score_events_daily_reward_uniq
  on public.score_events (player_id, season_id, source_id)
  where source_type = 'DAILY_RANK_REWARD';
