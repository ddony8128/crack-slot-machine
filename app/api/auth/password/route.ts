import { getDb } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/server/password';
import { currentPlayer } from '@/lib/server/playerAuth';

type PasswordBody = { currentPassword?: unknown; newPassword?: unknown };

// POST /api/auth/password — change the signed-in player's password.
export async function POST(req: Request) {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: PasswordBody;
  try {
    body = (await req.json()) as PasswordBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === 'string' ? body.currentPassword : '';
  if (!verifyPassword(currentPassword, player.passwordHash)) {
    return Response.json({ error: 'wrong_password' }, { status: 403 });
  }

  // Mirror signup's password rule.
  const newPassword =
    typeof body.newPassword === 'string' ? body.newPassword : '';
  if (newPassword.length < 8) {
    return Response.json({ error: 'weak_password' }, { status: 400 });
  }

  await getDb().updatePlayerPassword(player.id, hashPassword(newPassword));

  return Response.json({ ok: true });
}
