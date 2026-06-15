import { getDb } from '@/lib/db';
import { verifyPassword } from '@/lib/server/password';
import { setPlayerCookie } from '@/lib/server/playerAuth';

type LoginBody = { nickname?: unknown; password?: unknown };

// POST /api/auth/login — verify credentials and issue the player session cookie.
export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const db = getDb();
  const player = nickname ? await db.getPlayerByNickname(nickname) : null;
  if (!player || !verifyPassword(password, player.passwordHash)) {
    return Response.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  await setPlayerCookie(player.id);

  return Response.json({ player: { id: player.id, nickname: player.nickname } });
}
