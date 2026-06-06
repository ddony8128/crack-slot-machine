import { describe, it, expect } from 'vitest';
import { isValidSlug, sanitizeNickname, MAX_NICKNAME } from '@/lib/server/validation';

describe('isValidSlug', () => {
  it('accepts lowercase/digits/hyphen up to 50 chars', () => {
    expect(isValidSlug('total')).toBe(true);
    expect(isValidSlug('sss-party')).toBe(true);
    expect(isValidSlug('june-test-2026')).toBe(true);
    expect(isValidSlug('a'.repeat(50))).toBe(true);
  });
  it('rejects uppercase, spaces, symbols, empty, and >50 chars', () => {
    expect(isValidSlug('Total')).toBe(false);
    expect(isValidSlug('has space')).toBe(false);
    expect(isValidSlug('under_score')).toBe(false);
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a'.repeat(51))).toBe(false);
    expect(isValidSlug("'; drop table events;--")).toBe(false);
  });
});

describe('sanitizeNickname', () => {
  it('trims and caps at 60 chars', () => {
    expect(sanitizeNickname('  hi  ')).toBe('hi');
    expect(sanitizeNickname('x'.repeat(80))).toHaveLength(MAX_NICKNAME);
  });
  it('falls back to Anonymous for empty/non-string', () => {
    expect(sanitizeNickname('')).toBe('Anonymous');
    expect(sanitizeNickname('   ')).toBe('Anonymous');
    expect(sanitizeNickname(null)).toBe('Anonymous');
    expect(sanitizeNickname(42)).toBe('Anonymous');
  });
});
