import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';

// POST /api/admin/supporter — grant or revoke the 후원자 badge (admin only).
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { nickname?: unknown; granted?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const granted = body.granted === true;
  const note = typeof body.note === 'string' ? body.note : undefined;

  if (nickname.length === 0) {
    return Response.json({ error: 'nickname_required' }, { status: 400 });
  }

  const db = getDb();
  const player = await db.getPlayerByNickname(nickname);
  if (!player) {
    return Response.json({ error: 'player_not_found' }, { status: 404 });
  }

  const updated = await db.grantSupporterBadge(player.id, granted, note);
  return Response.json({
    player: {
      nickname: updated?.nickname ?? player.nickname,
      supporterBadge: updated?.supporterBadge ?? granted,
      supporterNote: updated?.supporterNote ?? null,
    },
  });
}
