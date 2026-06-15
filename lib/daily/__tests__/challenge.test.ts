import { describe, it, expect } from 'vitest';
import {
  dailyDateKey,
  dailyWindow,
  dailySeed,
  dailyGroups,
} from '@/lib/daily/challenge';

describe('dailyDateKey', () => {
  it('treats instants before the 03:00Z boundary as the previous day', () => {
    expect(dailyDateKey(new Date('2026-06-15T02:59:00Z'))).toBe('2026-06-14');
  });

  it('rolls over to the new day at exactly 03:00Z', () => {
    expect(dailyDateKey(new Date('2026-06-15T03:00:00Z'))).toBe('2026-06-15');
  });

  it('stays on the day for later instants', () => {
    expect(dailyDateKey(new Date('2026-06-15T18:00:00Z'))).toBe('2026-06-15');
  });
});

describe('dailyWindow', () => {
  it('returns a 24h window starting at 03:00Z', () => {
    expect(dailyWindow('2026-06-15')).toEqual({
      startsAt: '2026-06-15T03:00:00.000Z',
      endsAt: '2026-06-16T03:00:00.000Z',
    });
  });
});

describe('dailySeed', () => {
  it('namespaces the date key', () => {
    expect(dailySeed('2026-06-15')).toBe('daily-seed-2026-06-15');
  });
});

describe('dailyGroups', () => {
  it('returns the rotation-index-0 pair at the season start key', () => {
    expect(dailyGroups('2026-06-15')).toEqual({
      groupASetId: 'fruit',
      groupBSetId: 'gem',
    });
  });

  it('is deterministic for a given key', () => {
    expect(dailyGroups('2026-06-15')).toEqual(dailyGroups('2026-06-15'));
  });

  it('advances to the next rotation pair one day later', () => {
    expect(dailyGroups('2026-06-16')).toEqual({
      groupASetId: 'horror',
      groupBSetId: 'card',
    });
  });
});
