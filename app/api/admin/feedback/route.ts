import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';

// GET /api/admin/feedback — all feedback (admin), newest first, nickname resolved.
export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const rows = await db.listFeedback();

  // Resolve each author's nickname (deduped) so the admin sees who wrote it.
  const ids = [...new Set(rows.map((r) => r.playerId).filter((x): x is string => !!x))];
  const players = await Promise.all(ids.map((id) => db.getPlayerById(id)));
  const nicknameById = new Map(
    ids.map((id, i) => [id, players[i]?.nickname ?? '알수없음']),
  );

  const items = rows.map((r) => ({
    id: r.id,
    nickname: r.playerId ? nicknameById.get(r.playerId) ?? '알수없음' : '(탈퇴/게스트)',
    rating: r.rating,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt,
  }));
  return Response.json({ items });
}
