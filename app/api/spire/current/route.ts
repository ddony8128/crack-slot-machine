import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { replaySpireRun, type SpireAction } from '@/lib/spire/replay';

// GET /api/spire/current — the player's resumable (PENDING, has-actions) 첨탑 run for
// the active season, if any. Returns {current: {runId, seed, actions, stageReached}}
// or {current: null}. stageReached is derived by replaying the saved actions so the
// hub/client can show "이어하기 (N스테이지)" without trusting the client.
export async function GET() {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  if (!season) return Response.json({ current: null });

  const run = await db.getInProgressRun(player.id, season.id, 'spire');
  if (!run || !run.actions) return Response.json({ current: null });

  const actions = run.actions as SpireAction[];
  const replay = replaySpireRun(run.seed, actions);
  // A corrupt/unreplayable save (or one that already ended) is not resumable.
  if (!replay.ok || replay.runEnded) return Response.json({ current: null });

  return Response.json({
    current: {
      runId: run.id,
      seed: run.seed,
      actions,
      stageReached: replay.finalState.currentStage,
    },
  });
}
