import { getDb, TOTAL_SLUG } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';
import { isValidSlug } from '@/lib/server/validation';

// POST /api/admin/events/[slug]/active  body: { active: boolean }
// Activate or deactivate an event (admin only). The 'total' slug is fixed.
export async function POST(
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

  let body: { active?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.active !== 'boolean') {
    return Response.json({ error: 'active_required' }, { status: 400 });
  }

  if (slug === TOTAL_SLUG && body.active === false) {
    return Response.json({ error: 'cannot_disable_total' }, { status: 400 });
  }

  const event = await getDb().setEventActive(slug, body.active);
  if (!event) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ event });
}
