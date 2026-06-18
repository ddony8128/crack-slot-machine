import { getDb } from '@/lib/db';
import { sanitizeNickname } from '@/lib/server/validation';
import { verifySubmission } from '@/lib/server/verifySubmission';
import { detectRunAchievements, hasAllAchievements } from '@/lib/achievements';
import { triggersPenalty, PENALTY_STREAK } from '@/lib/server/penalty';
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

  // Achievement state must reflect PRIOR plays only — read before finalizing.
  // Identity is the local player row when present, else the run's nickname
  // (8번출구 공유 화이트리스트 모드에서는 player_id 가 없으므로 닉네임으로 집계).
  const playerId = run.playerId;
  const priorAch: AchievementKey[] = playerId
    ? await db.getPlayerAchievements(playerId, run.eventId)
    : await db.getPlayerAchievementsByNickname(nickname, run.eventId);
  const priorBest = playerId
    ? await db.getPlayerBestScore(playerId, run.eventId)
    : await db.getPlayerBestScoreByNickname(nickname, run.eventId);

  const hasAllNow = hasAllAchievements([...priorAch, ...runAchievements]);

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

  // 반복 플레이 패널티: 방금 끝낸 런을 포함한 최근 종료 시각으로 판정하고,
  // 조건 충족 + 아직 미발생인 닉네임에게만 최초 1회 패널티를 기록/표시한다.
  let penalty = false;
  if (nickname) {
    const spans = await db.getRecentSubmittedSpans(
      nickname,
      run.eventId,
      PENALTY_STREAK,
    );
    if (triggersPenalty(spans) && !(await db.hasPenalty(nickname, run.eventId))) {
      await db.recordPenalty(nickname, run.eventId);
      penalty = true;
    }
  }

  return Response.json({
    status: 'submitted',
    score: outcome.score,
    bestSpinScore: outcome.bestSpinScore,
    eventSlug: event.slug,
    newAchievements,
    allAchievementsComplete: hasAllNow,
    previousBest: priorBest,
    penalty,
  });
}
