import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { verifySubmission } from '@/lib/server/verifySubmission';
import { dailyAttemptsAllowed } from '@/lib/daily/challenge';
import {
  dailyRunConfigFromRow,
  dailyRunConfigFromParts,
  resolveDailySetup,
} from '@/lib/daily/run';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';
import type { ClientResults } from '@/lib/db/types';
import type { RecordedAction } from '@/store/gameStore';

type SubmitBody = {
  runId?: unknown;
  actions?: RecordedAction[];
  clientResults?: ClientResults;
  clientVersion?: string;
  rulesetVersion?: number;
};

// POST /api/daily/submit — server replays a finished daily run, stores only its
// own computed score, and (on success) updates the player's daily best.
export async function POST(req: Request) {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const runId = typeof body.runId === 'string' ? body.runId : '';
  if (!runId) {
    return Response.json({ error: 'invalid_run_id' }, { status: 400 });
  }

  const db = getDb();
  const run = await db.getRun(runId);
  if (!run) {
    return Response.json({ error: 'run_not_found' }, { status: 404 });
  }
  if (run.status !== 'pending') {
    return Response.json({ error: 'run_already_resolved' }, { status: 409 });
  }
  if (run.mode !== 'daily') {
    return Response.json({ error: 'not_a_daily_run' }, { status: 400 });
  }
  if (run.playerId !== player.id) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const actions = Array.isArray(body.actions) ? body.actions : [];
  const clientResults = body.clientResults ?? null;
  const now = new Date().toISOString();

  // Version gate: only current-version runs may register, keeping the daily
  // leaderboard comparable. A mismatch resolves the run as rejected.
  const versionOk =
    body.clientVersion === CLIENT_VERSION &&
    body.rulesetVersion === RULESET_VERSION &&
    run.clientVersion === CLIENT_VERSION &&
    run.rulesetVersion === RULESET_VERSION;

  if (!versionOk) {
    await db.finalizeRun(runId, {
      nickname: player.nickname,
      actions,
      clientResults: clientResults ?? { spins: [], finalScore: 0, bestSpinScore: 0 },
      score: null,
      bestSpinScore: null,
      status: 'rejected',
      verified: false,
      rejectReason: 'version_mismatch',
      submittedAt: now,
    });
    return Response.json({ status: 'rejected', reason: 'version_mismatch' });
  }

  // Reconstruct the day's run config from the STORED challenge row so the
  // server replay matches the client's run exactly.
  const challenge = await db.getDailyChallenge(run.seasonId!, run.dailyDateKey!);
  const config = challenge
    ? dailyRunConfigFromRow(challenge)
    : dailyRunConfigFromParts({ seed: run.seed, ...resolveDailySetup(run.dailyDateKey!) });
  const outcome = verifySubmission(run.seed, actions, clientResults, config);

  if (outcome.status === 'rejected') {
    await db.finalizeRun(runId, {
      nickname: player.nickname,
      actions,
      clientResults: clientResults ?? { spins: [], finalScore: 0, bestSpinScore: 0 },
      score: null,
      bestSpinScore: null,
      status: 'rejected',
      verified: false,
      rejectReason: outcome.reason,
      submittedAt: now,
    });
    const attemptsLeft = await dailyAttemptsLeft(db, player.id, run.seasonId!, run.dailyDateKey!);
    return Response.json({
      status: 'rejected',
      reason: outcome.reason,
      attemptsLeft,
    });
  }

  await db.finalizeRun(runId, {
    nickname: player.nickname,
    actions,
    clientResults: clientResults!,
    score: outcome.score,
    bestSpinScore: outcome.bestSpinScore,
    status: 'submitted',
    verified: true,
    rejectReason: null,
    submittedAt: now,
  });

  await db.upsertBestScore({
    playerId: player.id,
    seasonId: run.seasonId!,
    mode: 'daily',
    scopeKey: run.dailyDateKey!,
    score: outcome.score,
    seasonPoints: 0,
    runId: run.id,
  });

  const attemptsLeft = await dailyAttemptsLeft(db, player.id, run.seasonId!, run.dailyDateKey!);

  return Response.json({
    status: 'submitted',
    score: outcome.score,
    bestSpinScore: outcome.bestSpinScore,
    attemptsLeft,
  });
}

/** Attempts remaining today = (5, or 10 if the ad refill was used) − resolved runs. */
async function dailyAttemptsLeft(
  db: ReturnType<typeof getDb>,
  playerId: string,
  seasonId: string,
  dateKey: string,
): Promise<number> {
  const status = await db.getDailyUserStatus({ playerId, seasonId, dateKey });
  const allowed = dailyAttemptsAllowed(status?.adRefillUsed ?? false);
  const used = await db.countResolvedDailyRuns({ playerId, seasonId, dateKey });
  return Math.max(0, allowed - used);
}
