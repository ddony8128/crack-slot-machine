import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { sanitizeNickname } from '@/lib/server/validation';
import { verifySubmission } from '@/lib/server/verifySubmission';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';
import type { ClientResults } from '@/lib/db/types';
import type { RecordedAction } from '@/store/gameStore';

type SubmitBody = {
  runId?: unknown;
  nickname?: unknown;
  actions?: RecordedAction[];
  clientResults?: ClientResults;
  clientVersion?: string;
  rulesetVersion?: number;
};

const EMPTY_RESULTS: ClientResults = { spins: [], finalScore: 0, bestSpinScore: 0 };

// POST /api/quick/submit — server replays a finished quick run and stores only
// its own computed score on the run row. Quick has its own leaderboard and does
// NOT touch best_scores / season points.
export async function POST(req: Request) {
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
  if (run.mode !== 'quick') {
    return Response.json({ error: 'not_a_quick_run' }, { status: 400 });
  }

  // Stored nickname: members keep their account name (when the run is theirs);
  // everyone else uses the submitted display name.
  const player = await currentPlayer();
  const nickname =
    player && run.playerId === player.id
      ? player.nickname
      : sanitizeNickname(body.nickname);

  const actions = Array.isArray(body.actions) ? body.actions : [];
  const clientResults = body.clientResults ?? null;
  const now = new Date().toISOString();

  // Version gate (same shape as daily): only current-version runs may register.
  const versionOk =
    body.clientVersion === CLIENT_VERSION &&
    body.rulesetVersion === RULESET_VERSION &&
    run.clientVersion === CLIENT_VERSION &&
    run.rulesetVersion === RULESET_VERSION;

  if (!versionOk) {
    await db.finalizeRun(runId, {
      nickname,
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

  // Quick uses the default engine — no per-run config.
  const outcome = verifySubmission(run.seed, actions, clientResults);

  if (outcome.status === 'rejected') {
    await db.finalizeRun(runId, {
      nickname,
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

  await db.finalizeRun(runId, {
    nickname,
    actions,
    clientResults: clientResults!,
    score: outcome.score,
    bestSpinScore: outcome.bestSpinScore,
    status: 'submitted',
    verified: true,
    rejectReason: null,
    submittedAt: now,
  });

  return Response.json({
    status: 'submitted',
    score: outcome.score,
    bestSpinScore: outcome.bestSpinScore,
  });
}
