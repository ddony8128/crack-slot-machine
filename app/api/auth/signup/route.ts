import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/server/password';
import { setPlayerCookie } from '@/lib/server/playerAuth';
import { sanitizeNickname } from '@/lib/server/validation';

type SignupBody = {
  nickname?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  agree?: unknown;
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

  // Email + phone are BOTH optional, but at least ONE must be provided (§1.3).
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (email.length === 0 && phone.length === 0) {
    return Response.json({ error: 'contact_required' }, { status: 400 });
  }
  if (email.length > 0 && !email.includes('@')) {
    return Response.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (phone.length > 0 && !/\d/.test(phone)) {
    return Response.json({ error: 'invalid_phone' }, { status: 400 });
  }
  // Primary contact (back-compat for contact_type/contact_value reads): email
  // when present, else phone.
  const contactType: 'email' | 'phone' = email.length > 0 ? 'email' : 'phone';
  const contactValue = email.length > 0 ? email : phone;

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

  // Pre-checks for friendlier 409s (the create is still guarded below).
  if (await db.getPlayerByNickname(nickname)) {
    return Response.json({ error: 'nickname_taken' }, { status: 409 });
  }
  if (email.length > 0 && (await db.getPlayerByEmail(email))) {
    return Response.json({ error: 'email_taken' }, { status: 409 });
  }
  if (phone.length > 0 && (await db.getPlayerByPhone(phone))) {
    return Response.json({ error: 'phone_taken' }, { status: 409 });
  }

  const passwordHash = hashPassword(password);

  let player;
  try {
    player = await db.createPlayer({
      nickname,
      contactType,
      contactValue,
      email: email.length > 0 ? email : null,
      phone: phone.length > 0 ? phone : null,
      passwordHash,
    });
  } catch {
    // Unique-index race: nickname/email/phone taken between pre-check and insert.
    return Response.json({ error: 'nickname_taken' }, { status: 409 });
  }

  await setPlayerCookie(player.id);

  // NOTE: guest quick-game records are intentionally NOT migrated to the new
  // account (spec §3) — a guest's runs stay under their guest identity.

  return Response.json(
    { player: { id: player.id, nickname: player.nickname } },
    { status: 201 },
  );
}
