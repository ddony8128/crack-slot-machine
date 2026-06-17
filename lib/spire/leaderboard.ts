import { getDb } from '@/lib/db';

export type SpireLeaderboardItem = {
  rank: number;
  nickname: string;
  bestStageReached: number;
  bestTotalScore: number;
};

export type SpireLeaderboard = {
  items: SpireLeaderboardItem[];
};

/**
 * The active season's 첨탑 ranking: every player's BEST run, ranked by stage
 * reached then total score, nicknames resolved. Shared by the result screen's
 * "다른 사람들" panel and any future standalone page so they never drift.
 */
export async function readSpireLeaderboard(limit = 50): Promise<SpireLeaderboard> {
  const db = getDb();
  const season = await db.getActiveSeason();
  if (!season) return { items: [] };

  const records = await db.listSpireRecords(season.id);
  records.sort(
    (a, b) =>
      b.bestStageReached - a.bestStageReached ||
      b.bestTotalScore - a.bestTotalScore,
  );

  const top = records.slice(0, limit);
  const players = await Promise.all(top.map((r) => db.getPlayerById(r.playerId)));

  const items: SpireLeaderboardItem[] = top.map((r, i) => ({
    rank: i + 1,
    nickname: players[i]?.nickname ?? '알수없음',
    bestStageReached: r.bestStageReached,
    bestTotalScore: r.bestTotalScore,
  }));

  return { items };
}
