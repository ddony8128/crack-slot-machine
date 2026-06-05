import { describe, it, expect, beforeEach } from 'vitest';
import type { RankingRecord } from '@/types';
import {
  loadRankings,
  sortRankings,
  saveRanking,
  clearRankings,
  getRank,
  bestSpinScore,
} from '@/lib/ranking';

const STORAGE_KEY = 'rule-slot-rankings';

function rec(partial: Partial<RankingRecord> & { id: string }): RankingRecord {
  return {
    nickname: 'player',
    score: 0,
    bestSpinScore: 0,
    finalRules: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

beforeEach(() => {
  // jsdom provides localStorage; ensure a clean slate per test.
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    // Minimal in-memory mock fallback.
    globalThis.localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;
  }
  window.localStorage.clear();
});

describe('sortRankings', () => {
  it('sorts by score desc primarily', () => {
    const sorted = sortRankings([
      rec({ id: 'a', score: 100 }),
      rec({ id: 'b', score: 300 }),
      rec({ id: 'c', score: 200 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks score ties by bestSpinScore desc', () => {
    const sorted = sortRankings([
      rec({ id: 'a', score: 100, bestSpinScore: 10 }),
      rec({ id: 'b', score: 100, bestSpinScore: 50 }),
      rec({ id: 'c', score: 100, bestSpinScore: 30 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks further ties by createdAt asc (earlier first)', () => {
    const sorted = sortRankings([
      rec({
        id: 'late',
        score: 100,
        bestSpinScore: 10,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
      rec({
        id: 'early',
        score: 100,
        bestSpinScore: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      rec({
        id: 'mid',
        score: 100,
        bestSpinScore: 10,
        createdAt: '2026-02-01T00:00:00.000Z',
      }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['early', 'mid', 'late']);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = [rec({ id: 'a', score: 1 }), rec({ id: 'b', score: 2 })];
    const sorted = sortRankings(input);
    expect(sorted).not.toBe(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('saveRanking', () => {
  it('persists and returns sorted', () => {
    saveRanking(rec({ id: 'a', score: 100 }));
    const returned = saveRanking(rec({ id: 'b', score: 300 }));
    expect(returned.map((r) => r.id)).toEqual(['b', 'a']);
    // Persisted state matches.
    expect(loadRankings().map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('loadRankings', () => {
  it('returns [] when empty', () => {
    expect(loadRankings()).toEqual([]);
  });

  it('returns [] when JSON is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadRankings()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"foo":"bar"}');
    expect(loadRankings()).toEqual([]);
  });
});

describe('clearRankings', () => {
  it('empties stored rankings', () => {
    saveRanking(rec({ id: 'a', score: 100 }));
    expect(loadRankings()).toHaveLength(1);
    clearRankings();
    expect(loadRankings()).toEqual([]);
  });
});

describe('getRank', () => {
  it('returns correct 1-based rank', () => {
    const records = [
      rec({ id: 'a', score: 100 }),
      rec({ id: 'b', score: 300 }),
      rec({ id: 'c', score: 200 }),
    ];
    expect(getRank(records, 'b')).toBe(1);
    expect(getRank(records, 'c')).toBe(2);
    expect(getRank(records, 'a')).toBe(3);
  });

  it('returns -1 for unknown id', () => {
    expect(getRank([rec({ id: 'a' })], 'missing')).toBe(-1);
  });
});

describe('bestSpinScore', () => {
  it('picks the max round score', () => {
    expect(bestSpinScore([10, 90, 40, -20])).toBe(90);
  });

  it('returns 0 for an empty array', () => {
    expect(bestSpinScore([])).toBe(0);
  });
});
