import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import {
  dailyDateKey,
  dailyWindow,
  dailySeed,
  dailyGroups,
  dailyAttemptsAllowed,
} from '@/lib/daily/challenge';

// GET /api/daily/current — lazily ensures today's challenge exists, then returns
// the day's metadata plus (if signed in) how many attempts the player has left,
// the per-day allowance, and whether the one-time ad refill is still available.
export async function GET() {
  const db = getDb();

  const season = await db.getActiveSeason();
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }

  const dateKey = dailyDateKey(new Date());
  const { startsAt, endsAt } = dailyWindow(dateKey);
  await db.upsertDailyChallenge({
    seasonId: season.id,
    dateKey,
    startsAt,
    endsAt,
    seed: dailySeed(dateKey),
    ...dailyGroups(dateKey),
  });

  const player = await currentPlayer();
  if (!player) {
    return Response.json({ dateKey, endsAt, loggedIn: false });
  }

  const status = await db.getDailyUserStatus({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });
  const adRefillUsed = status?.adRefillUsed ?? false;
  const allowed = dailyAttemptsAllowed(adRefillUsed);

  const used = await db.countResolvedDailyRuns({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });

  return Response.json({
    dateKey,
    endsAt,
    loggedIn: true,
    attemptsUsed: used,
    attemptsLeft: Math.max(0, allowed - used),
    allowed,
    adRefillUsed,
    canRefill: !adRefillUsed,
  });
}
