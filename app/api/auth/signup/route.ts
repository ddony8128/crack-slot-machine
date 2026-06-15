import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/server/password';
import { setPlayerCookie } from '@/lib/server/playerAuth';
import { sanitizeNickname } from '@/lib/server/validation';

type SignupBody = {
  nickname?: unknown;
  contactType?: unknown;
  contactValue?: unknown;
  password?: unknown;
  agree?: unknown;
  guestName?: unknown;
};

// POST /api/auth/signup — create a Season 1 player account and sign them in.
export async function POST(req: Request) {
  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Nickname: sanitize then reject the empty/Anonymous fallback.
  const nickname = sanitizeNickname(body.nickname);
  if (nickname === 'Anonymous') {
    return Response.json({ error: 'invalid_nickname' }, { status: 400 });
  }

  // Contact type must be one of the known kinds.
  const contactType = body.contactType;
  if (contactType !== 'email' && contactType !== 'phone') {
    return Response.json({ error: 'invalid_contact' }, { status: 400 });
  }

  // Contact value: trimmed non-empty, with a light shape check per type.
  const contactValue =
    typeof body.contactValue === 'string' ? body.contactValue.trim() : '';
  if (contactValue.length === 0) {
    return Response.json({ error: 'invalid_contact' }, { status: 400 });
  }
  if (contactType === 'email' && !contactValue.includes('@')) {
    return Response.json({ error: 'invalid_contact' }, { status: 400 });
  }
  if (contactType === 'phone' && !/\d/.test(contactValue)) {
    return Response.json({ error: 'invalid_contact' }, { status: 400 });
  }

  // Password strength.
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) {
    return Response.json({ error: 'weak_password' }, { status: 400 });
  }

  // Privacy agreement is mandatory.
  if (body.agree !== true) {
    return Response.json({ error: 'agreement_required' }, { status: 400 });
  }

  const db = getDb();

  // Pre-check for a friendlier 409 (the create is still guarded below).
  if (await db.getPlayerByNickname(nickname)) {
    return Response.json({ error: 'nickname_taken' }, { status: 409 });
  }

  const passwordHash = hashPassword(password);

  let player;
  try {
    player = await db.createPlayer({
      nickname,
      contactType,
      contactValue,
      passwordHash,
    });
  } catch {
    // Unique-index race: another request took the nickname between the
    // pre-check and the insert.
    return Response.json({ error: 'nickname_taken' }, { status: 409 });
  }

  await setPlayerCookie(player.id);

  // Best-effort guest→account merge: attach the guest's quick runs to the new
  // account. A failure here must NOT fail the signup.
  if (typeof body.guestName === 'string' && body.guestName.trim().length > 0) {
    try {
      await db.reassignGuestQuickRuns({
        guestDisplayName: body.guestName.trim(),
        playerId: player.id,
        nickname: player.nickname,
      });
    } catch (err) {
      console.error('reassignGuestQuickRuns failed', err);
    }
  }

  return Response.json(
    { player: { id: player.id, nickname: player.nickname } },
    { status: 201 },
  );
}
