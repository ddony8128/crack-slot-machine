import { getDb } from '@/lib/db';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

// Top-N rows returned to the client. The db layer already caps its result, but
// we slice here too so the API shape never grows past the displayed TOP slice.
const QUICK_LEADERBOARD_TOP_N = 100;

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
    items: rows.slice(0, QUICK_LEADERBOARD_TOP_N).map((r, i) => ({
      rank: i + 1,
      nickname: r.nickname,
      score: r.score,
    })),
  });
}
