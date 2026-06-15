import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import {
  dailyDateKey,
  dailyWindow,
  dailySeed,
  dailyGroups,
  MAX_DAILY_ATTEMPTS,
} from '@/lib/daily/challenge';

// GET /api/daily/current — lazily ensures today's challenge exists, then returns
// the day's metadata plus (if signed in) how many attempts the player has left.
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

  const attemptsUsed = await db.countResolvedDailyRuns({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });

  return Response.json({
    dateKey,
    endsAt,
    attemptsUsed,
    attemptsLeft: Math.max(0, MAX_DAILY_ATTEMPTS - attemptsUsed),
    loggedIn: true,
  });
}
