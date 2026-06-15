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
