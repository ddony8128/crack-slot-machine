import { clearAdminCookie } from '@/lib/server/auth';

// POST /api/admin/logout — clear the admin session cookie.
export async function POST() {
  await clearAdminCookie();
  return Response.json({ ok: true });
}
