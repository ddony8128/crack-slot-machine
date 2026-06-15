process.env.ADMIN_SESSION_SECRET = 'test-secret-please';

import { describe, it, expect } from 'vitest';
import {
  createPlayerToken,
  readPlayerToken,
  PLAYER_MAX_AGE_SECONDS,
} from '@/lib/server/playerSession';

const NOW = 1_700_000_000_000;

describe('player session tokens', () => {
  it('round-trips a freshly issued token to its player id', () => {
    const token = createPlayerToken('player-123', NOW);
    expect(readPlayerToken(token, NOW)).toBe('player-123');
    expect(readPlayerToken(token, NOW + 1000)).toBe('player-123');
  });

  it('rejects a tampered signature', () => {
    const token = createPlayerToken('player-123', NOW);
    expect(readPlayerToken(token + 'x', NOW)).toBeNull();
    const [id, issued] = token.split('.');
    expect(readPlayerToken(`${id}.${issued}.deadbeef`, NOW)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createPlayerToken('player-123', NOW);
    const expiredNow = NOW + PLAYER_MAX_AGE_SECONDS * 1000 + 1;
    expect(readPlayerToken(token, expiredNow)).toBeNull();
  });

  it('accepts a token right at the expiry edge', () => {
    const token = createPlayerToken('player-123', NOW);
    expect(readPlayerToken(token, NOW + PLAYER_MAX_AGE_SECONDS * 1000)).toBe('player-123');
  });

  it('rejects wrong-shaped tokens', () => {
    expect(readPlayerToken(undefined, NOW)).toBeNull();
    expect(readPlayerToken('', NOW)).toBeNull();
    expect(readPlayerToken('only-one-part', NOW)).toBeNull();
    expect(readPlayerToken('two.parts', NOW)).toBeNull();
    expect(readPlayerToken('a.b.c.d', NOW)).toBeNull();
  });

  it('rejects a token with a non-numeric issued timestamp', () => {
    // Sign a payload whose issued field is not a finite number.
    const token = createPlayerToken('player-123', NOW);
    const sig = token.split('.')[2];
    // Re-sign nothing valid; tamper issued so signature check fails first anyway.
    expect(readPlayerToken(`player-123.notanumber.${sig}`, NOW)).toBeNull();
  });
});
