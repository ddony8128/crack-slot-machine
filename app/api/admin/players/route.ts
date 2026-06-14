import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/server/auth';
import { sanitizeNickname } from '@/lib/server/validation';

// GET /api/admin/players — list whitelist players (admin only).
// `?includeDeleted=1` includes soft-deleted rows.
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const includeDeleted =
    new URL(req.url).searchParams.get('includeDeleted') === '1';
  const players = await getDb().listPlayers({ includeDeleted });
  return Response.json({ players });
}

// POST /api/admin/players — register a nickname on the global whitelist (admin only).
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { nickname?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const nickname = sanitizeNickname(body.nickname);
  // sanitizeNickname returns 'Anonymous' for empty/non-string input; reject that
  // and any literal 'Anonymous' so staff must enter a real nickname.
  if (nickname === 'Anonymous') {
    return Response.json({ error: 'invalid_nickname' }, { status: 400 });
  }

  const db = getDb();
  let player;
  try {
    player = await db.createPlayer(nickname);
  } catch {
    return Response.json({ error: 'nickname_exists' }, { status: 409 });
  }
  return Response.json({ player }, { status: 201 });
}
