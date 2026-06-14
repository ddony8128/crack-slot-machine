import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';

// POST /api/admin/players/[id]/restore — restore a soft-deleted player (admin only).
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  let player;
  try {
    player = await getDb().restorePlayer(id);
  } catch {
    // Restore can violate the partial-unique index when another ACTIVE row now
    // holds that nickname.
    return Response.json({ error: 'nickname_exists' }, { status: 409 });
  }
  if (!player) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ player });
}
