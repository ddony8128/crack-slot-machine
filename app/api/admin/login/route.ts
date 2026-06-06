import { checkPassword, setAdminCookie } from '@/lib/server/auth';

// POST /api/admin/login — compare password to ADMIN_PASSWORD, issue session cookie.
export async function POST(req: Request) {
  let body: { password?: unknown };
  try {
    body = (await req.json()) as { password?: unknown };
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!checkPassword(body.password)) {
    return Response.json({ error: 'invalid_password' }, { status: 401 });
  }

  await setAdminCookie();
  return Response.json({ ok: true });
}
