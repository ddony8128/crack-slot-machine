import 'server-only';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import type { PlayerRow } from '@/lib/db/types';
import {
  PLAYER_COOKIE,
  PLAYER_MAX_AGE_SECONDS,
  createPlayerToken,
  readPlayerToken,
} from '@/lib/server/playerSession';

export { PLAYER_COOKIE } from '@/lib/server/playerSession';

/** The signed-in player's id from the cookie, or null. */
export async function currentPlayerId(): Promise<string | null> {
  const store = await cookies();
  return readPlayerToken(store.get(PLAYER_COOKIE)?.value, Date.now());
}

/** The signed-in player row (validated against the DB), or null. */
export async function currentPlayer(): Promise<PlayerRow | null> {
  const id = await currentPlayerId();
  if (!id) return null;
  const player = await getDb().getPlayerById(id);
  if (!player || player.deletedAt) return null;
  return player;
}

export async function setPlayerCookie(playerId: string): Promise<void> {
  const store = await cookies();
  store.set(PLAYER_COOKIE, createPlayerToken(playerId, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PLAYER_MAX_AGE_SECONDS,
  });
}

export async function clearPlayerCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PLAYER_COOKIE);
}
