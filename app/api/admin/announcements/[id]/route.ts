import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';

// PATCH /api/admin/announcements/[id]  body: { title?, body?, published?, pinned? }
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { title?: unknown; body?: unknown; published?: unknown; pinned?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch: { title?: string; body?: string; published?: boolean; pinned?: boolean } = {};
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (t.length === 0 || t.length > 200) {
      return Response.json({ error: 'invalid_title' }, { status: 400 });
    }
    patch.title = t;
  }
  if (typeof body.body === 'string') {
    const b = body.body.trim();
    if (b.length === 0 || b.length > 5000) {
      return Response.json({ error: 'invalid_body' }, { status: 400 });
    }
    patch.body = b;
  }
  if (typeof body.published === 'boolean') patch.published = body.published;
  if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;

  const announcement = await getDb().updateAnnouncement(id, patch);
  if (!announcement) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ announcement });
}

// DELETE /api/admin/announcements/[id]
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  await getDb().deleteAnnouncement(id);
  return Response.json({ ok: true });
}
