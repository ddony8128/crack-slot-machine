import { getDb } from '@/lib/db';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

// GET /api/quick/leaderboard — the fast-game ranking (guests + members) for the
// active season bucket, version-gated. Separate from season points.
export async function GET() {
  const db = getDb();
  const season = await db.getActiveSeason();
  const seasonId = season?.id ?? null;

  const rows = await db.listQuickBestScores({
    seasonId,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  return Response.json({
    items: rows.map((r, i) => ({
      rank: i + 1,
      nickname: r.nickname,
      score: r.score,
    })),
  });
}
