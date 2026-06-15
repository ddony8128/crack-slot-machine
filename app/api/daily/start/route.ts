import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import {
  dailyDateKey,
  dailyWindow,
  dailySeed,
  dailyAttemptsAllowed,
} from '@/lib/daily/challenge';
import { resolveDailySetup } from '@/lib/daily/run';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

// POST /api/daily/start — open a pending daily run on today's shared seed.
// Requires a signed-in player and enforces the per-day attempt cap (which
// expands from the base allowance to the max once the ad refill is used).
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
  const setup = resolveDailySetup(dateKey);
  const challenge = await db.upsertDailyChallenge({
    seasonId: season.id,
    dateKey,
    startsAt,
    endsAt,
    seed: dailySeed(dateKey),
    groupASetId: setup.groupASetId,
    groupBSetId: setup.groupBSetId,
    config: { basicRuleSetId: setup.basicRuleSetId },
  });

  const status = await db.getDailyUserStatus({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });
  const allowed = dailyAttemptsAllowed(status?.adRefillUsed ?? false);

  const attemptsUsed = await db.countResolvedDailyRuns({
    playerId: player.id,
    seasonId: season.id,
    dateKey,
  });
  if (attemptsUsed >= allowed) {
    return Response.json(
      { error: 'daily_attempts_exhausted' },
      { status: 403 },
    );
  }

  const seed = challenge.seed;
  const run = await db.createRun({
    playerId: player.id,
    seasonId: season.id,
    mode: 'daily',
    dailyDateKey: dateKey,
    seed,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  // Return the STORED challenge config so the client builds the run from the DB
  // row (not by re-deriving), matching the server replay.
  const basicRuleSetId =
    (challenge.config as { basicRuleSetId?: string } | null)?.basicRuleSetId ??
    setup.basicRuleSetId;
  return Response.json({
    runId: run.id,
    seed,
    dateKey,
    groupASetId: challenge.groupASetId,
    groupBSetId: challenge.groupBSetId,
    basicRuleSetId,
  });
}
