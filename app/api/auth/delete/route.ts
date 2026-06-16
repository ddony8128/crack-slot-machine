import { getDb } from '@/lib/db';
import { verifyPassword } from '@/lib/server/password';
import { clearPlayerCookie, currentPlayer } from '@/lib/server/playerAuth';

type DeleteBody = { password?: unknown };

// POST /api/auth/delete — soft-delete (탈퇴) the signed-in player's account.
export async function POST(req: Request) {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!verifyPassword(password, player.passwordHash)) {
    return Response.json({ error: 'wrong_password' }, { status: 403 });
  }

  await getDb().deactivatePlayer(player.id);
  await clearPlayerCookie();

  return Response.json({ ok: true });
}
