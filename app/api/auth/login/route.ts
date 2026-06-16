import { getDb } from '@/lib/db';
import type { Db, PlayerRow } from '@/lib/db/types';
import { verifyPassword } from '@/lib/server/password';
import { setPlayerCookie } from '@/lib/server/playerAuth';

// Accept the legacy `nickname` field too, so older clients keep working.
type LoginBody = { identifier?: unknown; nickname?: unknown; password?: unknown };

/**
 * Resolve a player by ANY of the three things they could have signed up with:
 * nickname, email, or phone. Users routinely try to log in with the email/phone
 * they registered — accepting all three is what makes "signed up, can't log in"
 * go away. Lookups are case-insensitive and never throw on duplicate/case-variant
 * rows (see the Db implementations).
 */
async function findPlayer(db: Db, identifier: string): Promise<PlayerRow | null> {
  // Email first when it looks like one, else try nickname → email → phone. The
  // order only matters when a value could match more than one column; the
  // signup uniqueness rules make real collisions across columns unlikely.
  const looksLikeEmail = identifier.includes('@');
  const candidates: Array<Promise<PlayerRow | null>> = looksLikeEmail
    ? [db.getPlayerByEmail(identifier), db.getPlayerByNickname(identifier)]
    : [
        db.getPlayerByNickname(identifier),
        db.getPlayerByEmail(identifier),
        db.getPlayerByPhone(identifier),
      ];
  for (const candidate of candidates) {
    const player = await candidate;
    if (player) return player;
  }
  return null;
}

// POST /api/auth/login — verify credentials and issue the player session cookie.
export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  // `identifier` is the new single field; fall back to `nickname` for back-compat.
  const rawIdentifier =
    typeof body.identifier === 'string'
      ? body.identifier
      : typeof body.nickname === 'string'
        ? body.nickname
        : '';
  const identifier = rawIdentifier.trim();
  const password = typeof body.password === 'string' ? body.password : '';

  const db = getDb();
  const player = identifier ? await findPlayer(db, identifier) : null;
  if (!player || !verifyPassword(password, player.passwordHash)) {
    return Response.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  await setPlayerCookie(player.id);

  return Response.json({ player: { id: player.id, nickname: player.nickname } });
}
