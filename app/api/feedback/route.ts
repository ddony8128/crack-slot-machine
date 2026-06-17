import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';

// POST /api/feedback  body: { body: string; rating?: number }
// Login-required: feedback is attributed to the player so admins see a nickname.
export async function POST(req: Request) {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'login_required' }, { status: 401 });
  }

  let body: { body?: unknown; rating?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (text.length === 0 || text.length > 2000) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Rating is optional; when present it must be an integer 1..5.
  let rating: number | null = null;
  if (body.rating !== undefined && body.rating !== null) {
    const r = Number(body.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return Response.json({ error: 'invalid_rating' }, { status: 400 });
    }
    rating = r;
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  const feedback = await db.createFeedback({
    playerId: player.id,
    seasonId: season?.id ?? null,
    rating,
    body: text,
  });
  return Response.json({ ok: true, id: feedback.id });
}
