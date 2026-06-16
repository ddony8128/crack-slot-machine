import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';

const ADMIN_INVALIDATED = 'admin_invalidated';

// POST /api/admin/runs/invalidate — mark a run rejected (admin only). v0 note:
// the best_scores row is NOT auto-recomputed; rankings read from best_scores, so
// a future cleanup pass owns removing the invalidated run's points.
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { runId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
  if (runId.length === 0) {
    return Response.json({ error: 'run_id_required' }, { status: 400 });
  }

  const db = getDb();
  const run = await db.getRun(runId);
  if (!run) {
    return Response.json({ error: 'run_not_found' }, { status: 404 });
  }

  await db.invalidateRun(runId, ADMIN_INVALIDATED);
  return Response.json({
    ok: true,
    runId,
    status: 'rejected',
    rejectReason: ADMIN_INVALIDATED,
    // v0 limitation surfaced to the UI.
    note: 'best_scores 랭킹은 자동 재계산되지 않습니다 (런 기록만 무효 처리).',
  });
}
