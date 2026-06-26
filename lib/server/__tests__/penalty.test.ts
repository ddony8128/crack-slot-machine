import { describe, it, expect } from 'vitest';
import {
  triggersPenalty,
  PENALTY_STREAK,
  PENALTY_WINDOW_MS,
  type PlaySpan,
} from '@/lib/server/penalty';

const BASE = Date.UTC(2026, 5, 18, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Build newest-first spans from a break (idle gap between plays) and a fixed
 * game duration. Play k (k=0 newest) ends at BASE - k*(break+duration).
 */
function spans(
  count: number,
  breakMs: number,
  durationMs = 10_000,
): PlaySpan[] {
  const step = breakMs + durationMs;
  return Array.from({ length: count }, (_, k) => {
    const end = BASE - k * step;
    return { start: iso(end - durationMs), end: iso(end) };
  });
}

describe('triggersPenalty (break between games)', () => {
  it('returns false with fewer than the streak length', () => {
    expect(triggersPenalty(spans(PENALTY_STREAK - 1, 30_000))).toBe(false);
    expect(triggersPenalty([])).toBe(false);
  });

  it('triggers when the idle gap between streak-length plays is each under 3 minutes', () => {
    expect(triggersPenalty(spans(PENALTY_STREAK, 60_000))).toBe(true);
  });

  it('does NOT escape just because a game is long (long duration, short break)', () => {
    // 10-minute games but only 30s breaks between them → still a penalty.
    expect(triggersPenalty(spans(PENALTY_STREAK, 30_000, 10 * 60_000))).toBe(true);
  });

  it('does not trigger when a break reaches the 3-minute window', () => {
    const s = spans(PENALTY_STREAK, 60_000);
    // Push the oldest play earlier so the gap before it is exactly the window.
    const prevStart = new Date(s[PENALTY_STREAK - 2].start).getTime();
    const end = prevStart - PENALTY_WINDOW_MS;
    s[PENALTY_STREAK - 1] = { start: iso(end - 10_000), end: iso(end) };
    expect(triggersPenalty(s)).toBe(false);
  });

  it('only considers the most recent streak', () => {
    expect(triggersPenalty(spans(8, 20_000))).toBe(true);
  });

  it('returns false on an unparseable timestamp', () => {
    const s = spans(PENALTY_STREAK, 60_000);
    s[2] = { start: 'not-a-date', end: s[2].end };
    expect(triggersPenalty(s)).toBe(false);
  });
});
