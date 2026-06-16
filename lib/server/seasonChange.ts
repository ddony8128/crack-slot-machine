import 'server-only';
import type { Db } from '@/lib/db/types';
import { buildSeasonRanking, type SeasonScoreChange } from '@/lib/season/scoring';

/** A player's current season total + rank (rank null when they have no rows yet). */
export type SeasonSnapshot = { score: number; rank: number | null };

/**
 * Read the player's current season total + rank from the live ranking. Called
 * once BEFORE a submit's upserts and once AFTER, so the difference reflects
 * exactly the points that submit granted. Nicknames are irrelevant here, so the
 * id is passed through as its own nickname.
 */
export async function seasonSnapshot(
  db: Db,
  seasonId: string,
  playerId: string,
): Promise<SeasonSnapshot> {
  const rows = await db.listSeasonBestScores(seasonId);
  const ranking = buildSeasonRanking(rows, (id) => id);
  const me = ranking.find((r) => r.playerId === playerId);
  return me ? { score: me.seasonPoints, rank: me.rank } : { score: 0, rank: null };
}

/** Build the SeasonScoreChange payload from a before/after snapshot pair. */
export function makeSeasonScoreChange(
  before: SeasonSnapshot,
  after: SeasonSnapshot,
  reason: string,
): SeasonScoreChange {
  return {
    previousSeasonScore: before.score,
    newSeasonScore: after.score,
    delta: after.score - before.score,
    previousRank: before.rank,
    newRank: after.rank,
    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 season-score ledger. seasonBreakdown reads the live ranking with the
// per-mode split; recordSeasonChange writes the audit trail + score cache and
// returns the SeasonScoreChange so routes can still drive the count-up animation.
// ─────────────────────────────────────────────────────────────────────────────

/** A player's live season total + rank + per-mode split (rank null when absent). */
export type SeasonBreakdown = {
  total: number;
  rank: number | null;
  puzzle: number;
  daily: number;
  spire: number;
};

/**
 * Read the player's current season total, rank, and per-mode split from the live
 * ranking. Called once BEFORE a grant's upserts and once AFTER, so the pair both
 * surfaces the change (delta) and supplies the per-mode cache values.
 */
export async function seasonBreakdown(
  db: Db,
  seasonId: string,
  playerId: string,
): Promise<SeasonBreakdown> {
  const rows = await db.listSeasonBestScores(seasonId);
  const ranking = buildSeasonRanking(rows, (id) => id);
  const me = ranking.find((r) => r.playerId === playerId);
  return me
    ? {
        total: me.seasonPoints,
        rank: me.rank,
        puzzle: me.puzzlePoints,
        daily: me.dailyPoints,
        spire: me.spirePoints,
      }
    : { total: 0, rank: null, puzzle: 0, daily: 0, spire: 0 };
}

/**
 * Record one season-points change: append a score_events audit row (ONLY when the
 * total moved or the rank changed) and refresh the season_scores cache from the
 * `after` breakdown. Returns the SeasonScoreChange payload the result screens use
 * for the count-up, so callers replace makeSeasonScoreChange with this in one step.
 */
export async function recordSeasonChange(
  db: Db,
  args: {
    seasonId: string;
    playerId: string;
    sourceType: string;
    sourceId?: string | null;
    before: SeasonBreakdown;
    after: SeasonBreakdown;
  },
): Promise<SeasonScoreChange> {
  const { seasonId, playerId, sourceType, sourceId, before, after } = args;
  const delta = after.total - before.total;

  // Only log a ledger row when something actually changed (total or rank). The
  // cache is always refreshed so it stays consistent with the live ranking.
  if (delta !== 0 || before.rank !== after.rank) {
    await db.insertScoreEvent({
      playerId,
      seasonId,
      sourceType,
      sourceId: sourceId ?? null,
      previousTotalScore: before.total,
      newTotalScore: after.total,
      delta,
      previousRank: before.rank,
      newRank: after.rank,
    });
  }

  await db.upsertSeasonScore({
    playerId,
    seasonId,
    puzzleScore: after.puzzle,
    dailyScore: after.daily,
    spireScore: after.spire,
    totalScore: after.total,
  });

  return {
    previousSeasonScore: before.total,
    newSeasonScore: after.total,
    delta,
    previousRank: before.rank,
    newRank: after.rank,
    reason: sourceType,
  };
}
