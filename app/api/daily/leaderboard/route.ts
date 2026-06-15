import { getDb } from '@/lib/db';
import { dailyDateKey } from '@/lib/daily/challenge';
import type { PlayerRow } from '@/lib/db/types';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/daily/leaderboard?date=YYYY-MM-DD (default = today)
// Best score per player for the date, highest first, with nicknames resolved.
export async function GET(req: Request) {
  const db = getDb();

  const season = await db.getActiveSeason();
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date');
  const dateKey =
    dateParam && DATE_KEY_RE.test(dateParam)
      ? dateParam
      : dailyDateKey(new Date());

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

  return Response.json({ dateKey, items });
}
