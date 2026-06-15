import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import {
  dailyDateKey,
  dailyWindow,
  dailySeed,
  dailyGroups,
  MAX_DAILY_ATTEMPTS,
} from '@/lib/daily/challenge';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

// POST /api/daily/start — open a pending daily run on today's shared seed.
// Requires a signed-in player and enforces the per-day attempt cap.
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
  const { startsAt, endsAt } = dailyWindow(dateKey);
  await db.upsertDailyChallenge({
    seasonId: season.id,
    dateKey,
    startsAt,
    endsAt,
    seed: dailySeed(dateKey),
    ...dailyGroups(dateKey),
  });

  const attemptsUsed = await db.countResolvedDailyRuns({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });
  if (attemptsUsed >= MAX_DAILY_ATTEMPTS) {
    return Response.json(
      { error: 'daily_attempts_exhausted' },
      { status: 403 },
    );
  }

  const seed = dailySeed(dateKey);
  const run = await db.createRun({
    playerId: player.id,
    seasonId: season.id,
    mode: 'daily',
    dailyDateKey: dateKey,
    seed,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  return Response.json({ runId: run.id, seed, dateKey });
}
