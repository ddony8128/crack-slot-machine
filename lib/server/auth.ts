import 'server-only';
import { cookies } from 'next/headers';
import {
  ADMIN_COOKIE,
  MAX_AGE_SECONDS,
  createSessionToken,
  isValidToken,
} from '@/lib/server/session';

export { ADMIN_COOKIE } from '@/lib/server/session';
export { checkPassword } from '@/lib/server/session';

/** True if the current request carries a valid admin session cookie. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return isValidToken(store.get(ADMIN_COOKIE)?.value, Date.now());
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionToken(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
