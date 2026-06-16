import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';
import { settleDueDailyChallenges } from '@/lib/server/dailySettlement';

// POST /api/admin/settle-daily — settle every daily ranking whose window has
// ended but isn't yet settled (admin only). Idempotent; safe to re-run.
export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }

  const settled = await settleDueDailyChallenges(
    db,
    season.id,
    new Date().toISOString(),
  );
  return Response.json({ ok: true, settled: settled.length, dateKeys: settled });
}
