import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import type { SpireAction } from '@/lib/spire/replay';

// POST /api/spire/progress — autosave the in-progress 첨탑 action stream onto the
// player's still-PENDING spire run (called at stage start/end). Body: {runId, actions}.
// Validated: the run exists, belongs to the caller, is a pending spire run.
export async function POST(req: Request) {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { runId?: unknown; actions?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  const runId = typeof body.runId === 'string' ? body.runId : null;
  const actions = Array.isArray(body.actions) ? (body.actions as SpireAction[]) : null;
  if (!runId || !actions) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const db = getDb();
  const run = await db.getRun(runId);
  if (!run || run.playerId !== player.id || run.mode !== 'spire') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (run.status !== 'pending') {
    // Already submitted/rejected — nothing to autosave onto.
    return Response.json({ saved: false });
  }

  await db.saveRunActions(runId, actions);
  return Response.json({ saved: true });
}
