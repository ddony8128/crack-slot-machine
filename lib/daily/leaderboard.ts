import 'server-only';
import { getDb } from '@/lib/db';
import { dailyDateKey } from '@/lib/daily/challenge';
import { settleDueDailyChallenges } from '@/lib/server/dailySettlement';
import type { PlayerRow } from '@/lib/db/types';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DailyLeaderboardItem = {
  rank: number;
  nickname: string;
  score: number;
};

export type DailyLeaderboardResult = {
  dateKey: string;
  items: DailyLeaderboardItem[];
};

/** Validate a ?date param (YYYY-MM-DD); fall back to today's date key. */
export function resolveDailyDateKey(dateParam: string | null | undefined): string {
  return dateParam && DATE_KEY_RE.test(dateParam)
    ? dateParam
    : dailyDateKey(new Date());
}

/**
 * The single source of truth for a day's leaderboard read, shared by the API
 * route and the leaderboard page so they can't drift. Settles any ended daily
 * windows first (so a just-ended day's rank rewards are persisted and the board
 * reflects the final standings), then returns the best score per player for the
 * date, highest first, with nicknames resolved. When no season is active the
 * result is empty.
 */
export async function readDailyLeaderboard(
  dateParam?: string | null,
): Promise<DailyLeaderboardResult> {
  const db = getDb();
  const dateKey = resolveDailyDateKey(dateParam);

  const season = await db.getActiveSeason();
  if (!season) return { dateKey, items: [] };

  // Persist any due rank rewards before reading the board.
  await settleDueDailyChallenges(db, season.id, new Date().toISOString());

  const rows = await db.listDailyBestScores(season.id, dateKey);

  // Resolve nicknames once per distinct player.
  const players = new Map<string, PlayerRow | null>();
  for (const row of rows) {
    if (!players.has(row.playerId)) {
      players.set(row.playerId, await db.getPlayerById(row.playerId));
    }
  }

  const items = rows.map((row, i) => ({
    rank: i + 1,
    nickname: players.get(row.playerId)?.nickname ?? '알 수 없음',
    score: row.score,
  }));

  return { dateKey, items };
}
