import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'rs_admin';
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error('ADMIN_SESSION_SECRET is not set');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Token = `<issuedMs>.<hmac(issuedMs)>`. Stateless; verified by recomputation. */
export function createSessionToken(nowMs: number): string {
  const issued = String(nowMs);
  return `${issued}.${sign(issued)}`;
}

export function isValidToken(token: string | undefined, nowMs: number): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const issued = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(issued))) return false;
  const issuedMs = Number(issued);
  if (!Number.isFinite(issuedMs)) return false;
  return nowMs - issuedMs <= MAX_AGE_SECONDS * 1000;
}

/** Verify the admin password against ADMIN_PASSWORD (constant-time). */
export function checkPassword(input: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== 'string' || input.length === 0) return false;
  return safeEqual(input, expected);
}
