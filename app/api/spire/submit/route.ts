import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { verifySubmission } from '@/lib/server/verifySubmission';
import {
  pickSpireSetChoices,
  spireRunConfig,
  spireProgress,
} from '@/lib/spire/run';
import { spireSeasonPoints } from '@/lib/season/scoring';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';
import type { ClientResults } from '@/lib/db/types';
import type { RecordedAction } from '@/store/gameStore';

type SubmitBody = {
  runId?: unknown;
  chosenSetId?: unknown;
  actions?: RecordedAction[];
  clientResults?: ClientResults;
  clientVersion?: string;
  rulesetVersion?: number;
};

const EMPTY_RESULTS: ClientResults = { spins: [], finalScore: 0, bestSpinScore: 0 };

// POST /api/spire/submit — server replays a finished spire run with the chosen
// set's config, scores it from its OWN replayed spins, interprets stage gating
// over the per-spin scores, and (on success) updates the player's spire record /
// best score.
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
  const chosenSetId = typeof body.chosenSetId === 'string' ? body.chosenSetId : '';

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

  // The chosen set must be one of the two the seed offered before stage 1;
  // anything else means the client tampered with the choice.
  const choices = pickSpireSetChoices(run.seed);
  if (!choices.includes(chosenSetId)) {
    return Response.json({ error: 'invalid_set_choice' }, { status: 400 });
  }

  const actions = Array.isArray(body.actions) ? body.actions : [];
  const clientResults = body.clientResults ?? null;
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
      clientResults: clientResults ?? EMPTY_RESULTS,
      score: null,
      bestSpinScore: null,
      status: 'rejected',
      verified: false,
      rejectReason: 'version_mismatch',
      submittedAt: now,
    });
    return Response.json({ status: 'rejected', reason: 'version_mismatch' });
  }

  // The chosen set's fixed board / rule pool / symbol bag / spin limit. The same
  // config is applied on the client, so the server replay produces identical
  // boards and scores.
  const config = spireRunConfig(run.seed, chosenSetId);
  const outcome = verifySubmission(run.seed, actions, clientResults, config);

  if (outcome.status === 'rejected') {
    await db.finalizeRun(runId, {
      nickname: player.nickname,
      actions,
      clientResults: clientResults ?? EMPTY_RESULTS,
      score: null,
      bestSpinScore: null,
      status: 'rejected',
      verified: false,
      rejectReason: outcome.reason,
      submittedAt: now,
    });
    return Response.json({ status: 'rejected', reason: outcome.reason });
  }

  // verifySubmission has confirmed clientResults.spins matches the replay, so we
  // can trust these per-spin scores to interpret the stage gating.
  const roundScores = clientResults!.spins.map((s) => s.spinScore);
  const prog = spireProgress(roundScores);
  const seasonPts = spireSeasonPoints(prog.stagesCleared, outcome.score);

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
    clearedStageCount: prog.stagesCleared,
    seasonPoints: seasonPts,
  });

  await db.upsertSpireRecord({
    playerId: player.id,
    seasonId: run.seasonId!,
    stageReached: prog.stagesCleared,
    totalScore: outcome.score,
    runId: run.id,
  });

  await db.upsertBestScore({
    playerId: player.id,
    seasonId: run.seasonId!,
    mode: 'spire',
    scopeKey: '',
    score: outcome.score,
    seasonPoints: seasonPts,
    cleared: prog.stagesCleared > 0,
    runId: run.id,
  });

  return Response.json({
    status: 'submitted',
    stagesCleared: prog.stagesCleared,
    totalScore: outcome.score,
    seasonPoints: seasonPts,
    stageScores: prog.stageScores,
  });
}
