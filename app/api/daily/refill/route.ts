import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { dailyDateKey, DAILY_MAX_ATTEMPTS } from '@/lib/daily/challenge';

// POST /api/daily/refill — claim the one-time (dummy) ad refill for today,
// expanding the day's allowance from the base attempts up to the max. The flag
// is per player+season+day and idempotent at the DB layer; we 409 if already
// used so the client can surface a clear message.
export async function POST() {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }

  const dateKey = dailyDateKey(new Date());

  const status = await db.getDailyUserStatus({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });
  if (status?.adRefillUsed) {
    return Response.json({ error: 'ad_refill_already_used' }, { status: 409 });
  }

  await db.setDailyAdRefillUsed({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });

  const used = await db.countResolvedDailyRuns({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });

  return Response.json({
    adRefillUsed: true,
    allowed: DAILY_MAX_ATTEMPTS,
    attemptsLeft: Math.max(0, DAILY_MAX_ATTEMPTS - used),
  });
}
