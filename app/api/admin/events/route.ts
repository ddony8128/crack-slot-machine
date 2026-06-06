import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';
import { isValidSlug } from '@/lib/server/validation';

// GET /api/admin/events — list all events (admin only).
export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const events = await getDb().listEvents();
  return Response.json({ events });
}

// POST /api/admin/events — create a new event slug (admin only).
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { slug?: unknown; title?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description =
    typeof body.description === 'string' && body.description.trim().length > 0
      ? body.description.trim()
      : null;

  if (!isValidSlug(slug)) {
    return Response.json({ error: 'invalid_slug' }, { status: 400 });
  }
  if (title.length === 0) {
    return Response.json({ error: 'title_required' }, { status: 400 });
  }

  const db = getDb();
  if (await db.getEventBySlug(slug)) {
    return Response.json({ error: 'slug_exists' }, { status: 409 });
  }

  const event = await db.createEvent({ slug, title, description });
  return Response.json({ event }, { status: 201 });
}
