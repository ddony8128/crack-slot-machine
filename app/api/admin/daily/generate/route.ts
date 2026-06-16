import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';
import {
  dailyDateKeysInRange,
  dailySeed,
  dailyWindow,
} from '@/lib/daily/challenge';
import { resolveDailySetup } from '@/lib/daily/run';
import { SEASON_STARTS_AT, SEASON_ENDS_AT } from '@/lib/season/config';

// POST /api/admin/daily/generate — upsert every daily_challenges row for the
// active season's date range (admin only). Upsert preserves settled_at, so it's
// safe to re-run. Returns the generated dateKeys.
export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }

  const dateKeys = dailyDateKeysInRange(SEASON_STARTS_AT, SEASON_ENDS_AT);
  for (const dateKey of dateKeys) {
    const { groupASetId, groupBSetId, basicRuleSetId } =
      resolveDailySetup(dateKey);
    const { startsAt, endsAt } = dailyWindow(dateKey);
    await db.upsertDailyChallenge({
      seasonId: season.id,
      dateKey,
      startsAt,
      endsAt,
      seed: dailySeed(dateKey),
      groupASetId,
      groupBSetId,
      config: { basicRuleSetId },
    });
  }

  return Response.json({ ok: true, count: dateKeys.length, dateKeys });
}
