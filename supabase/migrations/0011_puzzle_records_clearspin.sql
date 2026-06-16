-- Season 1 프리 시즌: puzzle records become CLEAR-based (spec §13).
-- Old shape stored best_goals_achieved / best_spin_count. The new model records
-- the player's best CLEAR: a cleared flag, the fewest spins used on a clear, the
-- leftover spins and puzzle score (100 + leftover×10) of that clear, and when it
-- cleared. Run AFTER 0004_puzzle_spire_records.sql.

alter table public.puzzle_user_records
  add column if not exists cleared              boolean not null default false,
  add column if not exists best_clear_spin      integer,
  add column if not exists best_remaining_spins integer,
  add column if not exists best_puzzle_score    integer,
  add column if not exists cleared_at           timestamptz;

-- Backfill from the legacy columns where present: a record counted as cleared if
-- its best_goals_achieved was > 0 (all goals achieved); carry the spin count over.
update public.puzzle_user_records
  set cleared = (coalesce(best_goals_achieved, 0) > 0),
      best_clear_spin = case when coalesce(best_goals_achieved, 0) > 0 then best_spin_count else null end
  where cleared = false;

-- New distribution index: clear-spin counts per (season, puzzle).
drop index if exists public.puzzle_records_dist_idx;
create index if not exists puzzle_records_clearspin_idx
  on public.puzzle_user_records (season_id, puzzle_key, cleared, best_clear_spin);

-- The legacy columns are left in place (nullable) for safety; a later cleanup
-- migration may drop best_goals_achieved / best_spin_count once nothing reads them.
