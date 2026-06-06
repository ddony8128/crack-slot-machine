import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSessionToken,
  isValidToken,
  checkPassword,
  MAX_AGE_SECONDS,
} from '@/lib/server/session';

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = 'test-secret';
  process.env.ADMIN_PASSWORD = 'hunter2';
});

describe('session tokens', () => {
  it('round-trips a freshly issued token', () => {
    const now = 1_000_000_000_000;
    const token = createSessionToken(now);
    expect(isValidToken(token, now)).toBe(true);
    expect(isValidToken(token, now + 1000)).toBe(true);
  });

  it('rejects an expired token', () => {
    const now = 1_000_000_000_000;
    const token = createSessionToken(now);
    expect(isValidToken(token, now + MAX_AGE_SECONDS * 1000 + 1)).toBe(false);
  });

  it('rejects tampered signatures and garbage', () => {
    const now = 1_000_000_000_000;
    const token = createSessionToken(now);
    expect(isValidToken(token + 'x', now)).toBe(false);
    expect(isValidToken('123.deadbeef', now)).toBe(false);
    expect(isValidToken('', now)).toBe(false);
    expect(isValidToken(undefined, now)).toBe(false);
  });

  it('a token signed with a different secret does not validate', () => {
    const now = 1_000_000_000_000;
    const token = createSessionToken(now);
    process.env.ADMIN_SESSION_SECRET = 'other-secret';
    expect(isValidToken(token, now)).toBe(false);
  });
});

describe('checkPassword', () => {
  it('matches the configured password only', () => {
    expect(checkPassword('hunter2')).toBe(true);
    expect(checkPassword('wrong')).toBe(false);
    expect(checkPassword('')).toBe(false);
    expect(checkPassword(null)).toBe(false);
  });
});
