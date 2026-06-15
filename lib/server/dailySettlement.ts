import 'server-only';
import type { Db } from '@/lib/db/types';
import { dailyRankReward } from '@/lib/season/scoring';

/**
 * Lazily settle every daily challenge whose noon window has ENDED but isn't yet
 * settled. Settling a day ranks its daily best_scores rows once and persists
 * each player's rank reward into that row's seasonPoints, then stamps the
 * challenge's settledAt. Idempotent: the settledAt gate skips already-settled
 * days, and future days (endsAt > now) are left alone until their window ends.
 *
 * Called before reading the season ranking/rows so settlement is owned here
 * (no cron) instead of being recomputed on every page view.
 */
export async function settleDueDailyChallenges(
  db: Db,
  seasonId: string,
  nowIso: string,
): Promise<void> {
  const challenges = await db.listSeasonDailyChallenges(seasonId);
  for (const c of challenges) {
    if (c.settledAt || c.endsAt > nowIso) continue; // already settled or not ended
    const rows = await db.listDailyBestScores(seasonId, c.dateKey);
    const sorted = [...rows].sort(
      (a, b) => b.score - a.score || a.updatedAt.localeCompare(b.updatedAt),
    );
    const rewards = sorted.map((row, i) => ({
      playerId: row.playerId,
      seasonPoints: dailyRankReward(i + 1, sorted.length),
    }));
    await db.settleDailyChallenge({ seasonId, dateKey: c.dateKey, settledAt: nowIso, rewards });
  }
}
