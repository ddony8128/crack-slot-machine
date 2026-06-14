import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';

// POST /api/admin/players/[id]/delete — soft-delete a player (admin only).
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const player = await getDb().softDeletePlayer(id);
  if (!player) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ player });
}
