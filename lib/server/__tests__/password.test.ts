import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/server/password';

describe('password hashing', () => {
  it('round-trips a correct password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashPassword('s3cret');
    expect(verifyPassword('not-s3cret', stored)).toBe(false);
  });

  it('rejects a malformed stored string', () => {
    expect(verifyPassword('whatever', 'not-a-valid-hash')).toBe(false);
    expect(verifyPassword('whatever', '')).toBe(false);
    expect(verifyPassword('whatever', ':')).toBe(false);
  });

  it('produces a different hash each time (random salt)', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
    // Both still verify.
    expect(verifyPassword('same-password', a)).toBe(true);
    expect(verifyPassword('same-password', b)).toBe(true);
  });
});
