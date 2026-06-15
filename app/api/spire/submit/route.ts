import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { verifySpireRun } from '@/lib/spire/verify';
import { spireSeasonPoints } from '@/lib/season/scoring';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';
import type { ClientResults } from '@/lib/db/types';
import type { SpireAction } from '@/lib/spire/replay';

type SubmitBody = {
  runId?: unknown;
  actions?: SpireAction[];
  stagesCleared?: unknown;
  totalScore?: unknown;
  clientVersion?: string;
  rulesetVersion?: number;
};

const EMPTY_RESULTS: ClientResults = { spins: [], finalScore: 0, bestSpinScore: 0 };

// POST /api/spire/submit — server re-derives the whole staged spire run from the
// seed + SpireAction[] via verifySpireRun (replay), NEVER trusting the client's
// economy/score numbers. The client's reported stagesCleared/totalScore are only
// a claim that must match the replay, or the run is rejected.
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
  if (run.mode !== 'spire') {
    return Response.json({ error: 'not_a_spire_run' }, { status: 400 });
  }
  if (run.playerId !== player.id) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const actions = Array.isArray(body.actions) ? body.actions : [];
  const stagesCleared = typeof body.stagesCleared === 'number' ? body.stagesCleared : 0;
  const totalScore = typeof body.totalScore === 'number' ? body.totalScore : 0;
  const now = new Date().toISOString();

  // Version gate: only current-version runs may register, keeping spire records
  // comparable. A mismatch resolves the run as rejected.
  const versionOk =
    body.clientVersion === CLIENT_VERSION &&
    body.rulesetVersion === RULESET_VERSION &&
    run.clientVersion === CLIENT_VERSION &&
    run.rulesetVersion === RULESET_VERSION;

  if (!versionOk) {
    await db.finalizeRun(runId, {
      nickname: player.nickname,
      actions,
      clientResults: EMPTY_RESULTS,
      score: null,
      bestSpinScore: null,
      status: 'rejected',
      verified: false,
      rejectReason: 'version_mismatch',
      submittedAt: now,
    });
    return Response.json({ status: 'rejected', reason: 'version_mismatch' });
  }

  const v = verifySpireRun(run.seed, actions, { stagesCleared, totalScore });

  if (v.status === 'rejected') {
    await db.finalizeRun(runId, {
      nickname: player.nickname,
      actions,
      clientResults: EMPTY_RESULTS,
      score: null,
      bestSpinScore: null,
      status: 'rejected',
      verified: false,
      rejectReason: v.reason,
      submittedAt: now,
    });
    return Response.json({ status: 'rejected', reason: v.reason });
  }

  const seasonPts = spireSeasonPoints(v.stagesCleared, v.totalScore);

  await db.finalizeRun(runId, {
    nickname: player.nickname,
    actions,
    clientResults: { spins: [], finalScore: v.totalScore, bestSpinScore: 0 },
    score: v.totalScore,
    bestSpinScore: 0,
    status: 'submitted',
    verified: true,
    rejectReason: null,
    submittedAt: now,
    cleared: v.stagesCleared > 0,
    clearedStageCount: v.stagesCleared,
    seasonPoints: seasonPts,
  });

  await db.upsertSpireRecord({
    playerId: player.id,
    seasonId: run.seasonId!,
    stageReached: v.stagesCleared,
    totalScore: v.totalScore,
    runId: run.id,
  });

  await db.upsertBestScore({
    playerId: player.id,
    seasonId: run.seasonId!,
    mode: 'spire',
    scopeKey: '',
    score: v.totalScore,
    seasonPoints: seasonPts,
    cleared: v.stagesCleared > 0,
    runId: run.id,
  });

  return Response.json({
    status: 'submitted',
    stagesCleared: v.stagesCleared,
    totalScore: v.totalScore,
    seasonPoints: seasonPts,
  });
}
