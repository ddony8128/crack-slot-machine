import { clearPlayerCookie } from '@/lib/server/playerAuth';

// POST /api/auth/logout — clear the player session cookie.
export async function POST() {
  await clearPlayerCookie();
  return Response.json({ ok: true });
}
