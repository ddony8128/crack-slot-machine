import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { verifySubmission } from '@/lib/server/verifySubmission';
import { PUZZLES_BY_KEY } from '@/lib/puzzle/config';
import { puzzleScore } from '@/lib/season/scoring';
import { puzzleRunConfig } from '@/lib/puzzle/run';
import { checkPuzzleRun, type GoalContext } from '@/lib/puzzle/goals';
import { computeHand } from '@/lib/score';
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

const EMPTY_RESULTS: ClientResults = { spins: [], finalScore: 0, bestSpinScore: 0 };

// POST /api/puzzles/[key]/submit — server replays a finished puzzle run, scores
// it from its OWN replayed spins, decides how many goals were achieved, and (on
// success) updates the player's puzzle record / best score.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { key } = await ctx.params;
  const puzzle = PUZZLES_BY_KEY[key];
  if (!puzzle) {
    return Response.json({ error: 'puzzle_not_found' }, { status: 404 });
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
  if (run.mode !== 'puzzle') {
    return Response.json({ error: 'not_a_puzzle_run' }, { status: 400 });
  }
  if (run.playerId !== player.id) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  if (run.puzzleKey !== key) {
    return Response.json({ error: 'puzzle_key_mismatch' }, { status: 400 });
  }

  const actions = Array.isArray(body.actions) ? body.actions : [];
  const clientResults = body.clientResults ?? null;
  const now = new Date().toISOString();

  // Version gate: only current-version runs may register, keeping puzzle records
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

  // The puzzle's fixed board / rule bag / spin limit. The same config is applied
  // on the client, so the server replay produces identical boards and scores.
  const config = puzzleRunConfig(key);
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
  // can trust these boards/scores to evaluate the goals.
  const spins = clientResults!.spins;
  const ctxs: GoalContext[] = spins.map((s) => ({
    board: s.finalBoard,
    hand: computeHand(s.finalBoard).hand,
    spinScore: s.spinScore,
  }));

  const { count: goalsAchieved } = checkPuzzleRun(puzzle.goals, ctxs);
  const totalGoals = puzzle.goals.length;
  const cleared = goalsAchieved === totalGoals;
  const spinCount = spins.length;

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
    cleared,
  });

  // v2 season score: 100 + leftover-spins×10 on clear (spec §3). best_scores
  // keeps the highest, so a faster (more-leftover) clear replaces an earlier one.
  const seasonScore = cleared ? puzzleScore(puzzle.spinLimit, spinCount) : 0;

  await db.upsertBestScore({
    playerId: player.id,
    seasonId: run.seasonId!,
    mode: 'puzzle',
    scopeKey: key,
    score: seasonScore,
    seasonPoints: seasonScore,
    cleared,
    runId: run.id,
  });

  await db.upsertPuzzleRecord({
    playerId: player.id,
    seasonId: run.seasonId!,
    puzzleKey: key,
    goalsAchieved,
    spinCount,
    runId: run.id,
  });

  const distribution = await db.getPuzzleDistribution(run.seasonId!, key);

  return Response.json({
    status: 'submitted',
    goalsAchieved,
    totalGoals,
    cleared,
    spinCount,
    distribution,
  });
}
