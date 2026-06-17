import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';

// GET /api/admin/announcements — every announcement (admin), pinned then newest.
export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const items = await getDb().listAnnouncements();
  return Response.json({ items });
}

// POST /api/admin/announcements  body: { title, body, published?, pinned?, seasonId? }
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    title?: unknown;
    body?: unknown;
    published?: unknown;
    pinned?: unknown;
    seasonId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (title.length === 0 || title.length > 200) {
    return Response.json({ error: 'invalid_title' }, { status: 400 });
  }
  if (text.length === 0 || text.length > 5000) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const announcement = await getDb().createAnnouncement({
    title,
    body: text,
    published: body.published === true,
    pinned: body.pinned === true,
    seasonId: typeof body.seasonId === 'string' ? body.seasonId : null,
  });
  return Response.json({ announcement });
}
