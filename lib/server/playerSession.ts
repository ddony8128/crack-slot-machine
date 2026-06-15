import { createHmac, timingSafeEqual } from 'node:crypto';

/** Player auth cookie + stateless token. Mirrors the admin session design but
 *  carries the player id. Signed with ADMIN_SESSION_SECRET (server-only). */
export const PLAYER_COOKIE = 'rs_player';
export const PLAYER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error('ADMIN_SESSION_SECRET is not set');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Token = `<playerId>.<issuedMs>.<hmac(playerId.issuedMs)>`. */
export function createPlayerToken(playerId: string, nowMs: number): string {
  const payload = `${playerId}.${nowMs}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the playerId if the token is valid & unexpired, else null. */
export function readPlayerToken(token: string | undefined, nowMs: number): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [playerId, issued, sig] = parts;
  if (!safeEqual(sig, sign(`${playerId}.${issued}`))) return null;
  const issuedMs = Number(issued);
  if (!Number.isFinite(issuedMs)) return null;
  if (nowMs - issuedMs > PLAYER_MAX_AGE_SECONDS * 1000) return null;
  return playerId;
}
