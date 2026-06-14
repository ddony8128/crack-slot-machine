import { getDb } from '@/lib/db';
import { sanitizeNickname } from '@/lib/server/validation';
import { verifySubmission } from '@/lib/server/verifySubmission';
import { computeCredits } from '@/lib/server/rewards';
import { detectRunAchievements, hasAllAchievements } from '@/lib/achievements';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';
import type { ClientResults } from '@/lib/db/types';
import type { AchievementKey } from '@/types';
import type { RecordedAction } from '@/store/gameStore';

type SubmitBody = {
  nickname?: unknown;
  actions?: RecordedAction[];
  clientResults?: ClientResults;
  clientVersion?: string;
  rulesetVersion?: number;
};

// POST /api/runs/[runId]/submit — server replays the run and only stores its own
// computed score. Mismatch => rejected (client shows "치팅 감지").
export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const db = getDb();
  const run = await db.getRun(runId);
  if (!run) {
    return Response.json({ error: 'run_not_found' }, { status: 404 });
  }
  if (run.status !== 'pending') {
    return Response.json({ error: 'run_already_resolved' }, { status: 409 });
  }

  const event = await db.getEventById(run.eventId);
  if (!event) {
    return Response.json({ error: 'event_not_found' }, { status: 404 });
  }
  if (!event.isActive) {
    return Response.json({ error: 'event_inactive' }, { status: 403 });
  }

  const nickname = sanitizeNickname(body.nickname);
  const actions = Array.isArray(body.actions) ? body.actions : [];
  const clientResults = body.clientResults ?? null;
  const now = new Date().toISOString();

  // Version gate: only current-version runs may register (keeps leaderboards
  // comparable). A mismatch resolves the run as rejected.
  const versionOk =
    body.clientVersion === CLIENT_VERSION &&
    body.rulesetVersion === RULESET_VERSION &&
    run.clientVersion === CLIENT_VERSION &&
    run.rulesetVersion === RULESET_VERSION;

  if (!versionOk) {
    await db.finalizeRun(runId, {
      nickname,
      achievements: [],
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

  const outcome = verifySubmission(run.seed, actions, clientResults);

  if (outcome.status === 'rejected') {
    await db.finalizeRun(runId, {
      nickname,
      achievements: [],
      actions,
      clientResults: clientResults ?? { spins: [], finalScore: 0, bestSpinScore: 0 },
      score: null,
      bestSpinScore: null,
      status: 'rejected',
      verified: false,
      rejectReason: outcome.reason,
      submittedAt: now,
    });
    return Response.json({ status: 'rejected', reason: outcome.reason });
  }

  // Success path. The submitted boards are already verified to equal the
  // authoritative replay, so they are trustworthy for achievement detection.
  const boards = clientResults!.spins.map((s) => s.finalBoard);
  const runAchievements = detectRunAchievements(boards);

  // Reward state must reflect PRIOR plays only — read before finalizing.
  const playerId = run.playerId;
  const priorBest = playerId
    ? await db.getPlayerBestScore(playerId, run.eventId)
    : null;
  const priorAch: AchievementKey[] = playerId
    ? await db.getPlayerAchievements(playerId, run.eventId)
    : [];

  const isFirstPlay = priorBest === null;
  const hadAllBefore = hasAllAchievements(priorAch);
  const hasAllNow = hasAllAchievements([...priorAch, ...runAchievements]);

  const credits = computeCredits({
    isFirstPlay,
    previousBest: priorBest,
    totalScore: outcome.score,
    hadAllAchievementsBefore: hadAllBefore,
    hasAllAchievementsNow: hasAllNow,
  });

  await db.finalizeRun(runId, {
    nickname,
    achievements: runAchievements,
    actions,
    clientResults: clientResults!,
    score: outcome.score,
    bestSpinScore: outcome.bestSpinScore,
    status: 'submitted',
    verified: true,
    rejectReason: null,
    submittedAt: now,
  });

  const newAchievements = runAchievements.filter((k) => !priorAch.includes(k));

  return Response.json({
    status: 'submitted',
    score: outcome.score,
    bestSpinScore: outcome.bestSpinScore,
    eventSlug: event.slug,
    credits,
    newAchievements,
    allAchievementsComplete: hasAllNow,
    previousBest: priorBest,
  });
}
