import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';
import { isValidSlug } from '@/lib/server/validation';

// PATCH /api/admin/events/[slug]  body: { title?: string; description?: string|null }
// Edit an existing event's title/description (admin only). The slug itself is
// immutable (it's the shareable URL key).
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: 'invalid_slug' }, { status: 400 });
  }

  let body: { title?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch: { title?: string; description?: string | null } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return Response.json({ error: 'title_required' }, { status: 400 });
    }
    patch.title = body.title.trim().slice(0, 120);
  }

  if (body.description !== undefined) {
    if (typeof body.description === 'string') {
      const d = body.description.trim().slice(0, 500);
      patch.description = d.length > 0 ? d : null;
    } else if (body.description === null) {
      patch.description = null;
    } else {
      return Response.json({ error: 'invalid_description' }, { status: 400 });
    }
  }

  if (patch.title === undefined && patch.description === undefined) {
    return Response.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const event = await getDb().updateEvent(slug, patch);
  if (!event) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ event });
}
