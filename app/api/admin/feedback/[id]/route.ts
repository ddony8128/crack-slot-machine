import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';
import type { FeedbackStatus } from '@/lib/db/types';

const STATUSES: FeedbackStatus[] = ['new', 'read', 'archived'];

// PATCH /api/admin/feedback/[id]  body: { status: 'new'|'read'|'archived' }
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const status = body.status as FeedbackStatus;
  if (!STATUSES.includes(status)) {
    return Response.json({ error: 'invalid_status' }, { status: 400 });
  }

  const feedback = await getDb().updateFeedbackStatus(id, status);
  if (!feedback) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ feedback });
}
