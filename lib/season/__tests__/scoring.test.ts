import { describe, it, expect } from 'vitest';
import {
  spireSeasonPoints,
  puzzleSeasonPoints,
  dailyPointsForRank,
  seasonDailyTotal,
  buildSeasonRanking,
  SEASON_MODE_CAP,
} from '@/lib/season/scoring';
import type { BestScoreRow, RunMode } from '@/lib/db/types';

describe('spireSeasonPoints', () => {
  it('combines stage base with the run-score bonus', () => {
    // 8*70 + min(300, floor(42000/200)=210) = 560 + 210 = 770
    expect(spireSeasonPoints(8, 42000)).toBe(770);
  });

  it('caps the run-score bonus at 300', () => {
    // bonus = min(300, floor(1_000_000/200)=5000) = 300; 0*70 + 300
    expect(spireSeasonPoints(0, 1_000_000)).toBe(300);
  });

  it('caps the total at 1000 even with 10 stages and a high score', () => {
    // 10*70 = 700, +300 bonus = 1000 (already at cap)
    expect(spireSeasonPoints(10, 1_000_000)).toBe(1000);
    // pushing beyond still clamps
    expect(spireSeasonPoints(15, 1_000_000)).toBe(SEASON_MODE_CAP);
  });

  it('clamps negatives and missing scores to 0', () => {
    expect(spireSeasonPoints(-5, -100)).toBe(0);
    expect(spireSeasonPoints(0, 0)).toBe(0);
  });
});

describe('puzzleSeasonPoints', () => {
  it('awards 100 per cleared puzzle', () => {
    expect(puzzleSeasonPoints(3)).toBe(300);
  });

  it('caps at 1000', () => {
    expect(puzzleSeasonPoints(12)).toBe(1000);
  });

  it('returns 0 for none cleared', () => {
    expect(puzzleSeasonPoints(0)).toBe(0);
  });
});

describe('dailyPointsForRank', () => {
  it('pays a top-1% rank the maximum', () => {
    expect(dailyPointsForRank(1, 100)).toBe(100);
  });

  it('uses percentile bands in larger fields', () => {
    expect(dailyPointsForRank(25, 100)).toBe(80); // 25% -> band <=0.3
    expect(dailyPointsForRank(50, 100)).toBe(60); // 50% -> band <=0.6
    expect(dailyPointsForRank(90, 100)).toBe(40); // 90% -> bottom band
  });

  it('falls back to the small-field schedule for tiny fields', () => {
    expect(dailyPointsForRank(1, 1)).toBe(100);
    expect(dailyPointsForRank(2, 2)).toBe(80);
    expect(dailyPointsForRank(3, 3)).toBe(60);
  });

  it('returns 0 for out-of-range ranks', () => {
    expect(dailyPointsForRank(0, 10)).toBe(0);
    expect(dailyPointsForRank(11, 10)).toBe(0);
    expect(dailyPointsForRank(1, 0)).toBe(0);
  });
});

describe('seasonDailyTotal', () => {
  it('sums the best 10 days and caps at 1000', () => {
    const twelve = Array(12).fill(100);
    expect(seasonDailyTotal(twelve)).toBe(1000);
  });

  it('sums a small list directly', () => {
    expect(seasonDailyTotal([40, 60, 80])).toBe(180);
  });

  it('keeps only the top-10 values', () => {
    // eleven 60s -> top 10 counted = 600
    expect(seasonDailyTotal(Array(11).fill(60))).toBe(600);
  });

  it('is 0 for no days', () => {
    expect(seasonDailyTotal([])).toBe(0);
  });
});

describe('buildSeasonRanking', () => {
  const nick = (id: string) => `nick-${id}`;

  function spireRow(playerId: string, seasonPoints: number, score = 0): BestScoreRow {
    return baseRow(playerId, 'spire', `spire`, score, seasonPoints, null, '2026-06-01T00:00:00.000Z');
  }
  function puzzleRow(playerId: string, scopeKey: string, cleared: boolean): BestScoreRow {
    return baseRow(playerId, 'puzzle', scopeKey, 0, 0, cleared, '2026-06-01T00:00:00.000Z');
  }
  function dailyRow(
    playerId: string,
    dateKey: string,
    score: number,
    updatedAt: string,
  ): BestScoreRow {
    return baseRow(playerId, 'daily', dateKey, score, 0, null, updatedAt);
  }
  function baseRow(
    playerId: string,
    mode: RunMode,
    scopeKey: string,
    score: number,
    seasonPoints: number,
    cleared: boolean | null,
    updatedAt: string,
  ): BestScoreRow {
    return {
      id: `${playerId}-${mode}-${scopeKey}`,
      playerId,
      seasonId: 's1',
      mode,
      scopeKey,
      score,
      seasonPoints,
      cleared,
      runId: null,
      updatedAt,
    };
  }

  it('aggregates spire/puzzle/daily points and ranks players', () => {
    // Two dates. Per date, the higher score is rank 1.
    // Field size 2 -> rank1=100, rank2=80 (small-field schedule).
    const rows: BestScoreRow[] = [
      // Player A: strong spire, two puzzles, wins both days.
      spireRow('A', 900, 0),
      puzzleRow('A', 'puzzle-1', true),
      puzzleRow('A', 'puzzle-2', true),
      dailyRow('A', '2026-06-15', 500, '2026-06-15T10:00:00.000Z'),
      dailyRow('A', '2026-06-16', 400, '2026-06-16T10:00:00.000Z'),

      // Player B: weaker spire, one puzzle, second on both days.
      spireRow('B', 300, 0),
      puzzleRow('B', 'puzzle-1', true),
      dailyRow('B', '2026-06-15', 100, '2026-06-15T10:00:00.000Z'),
      dailyRow('B', '2026-06-16', 50, '2026-06-16T10:00:00.000Z'),
    ];

    const result = buildSeasonRanking(rows, nick);

    const a = result.find((r) => r.playerId === 'A')!;
    const b = result.find((r) => r.playerId === 'B')!;

    // Player A
    expect(a.spirePoints).toBe(900);
    expect(a.puzzlePoints).toBe(200); // 2 cleared * 100
    expect(a.dailyPoints).toBe(200); // rank1 both days: 100 + 100
    expect(a.seasonPoints).toBe(1300);
    expect(a.nickname).toBe('nick-A');

    // Player B
    expect(b.spirePoints).toBe(300);
    expect(b.puzzlePoints).toBe(100); // 1 cleared
    expect(b.dailyPoints).toBe(160); // rank2 both days: 80 + 80
    expect(b.seasonPoints).toBe(560);

    // Ordering + ranks
    expect(result.map((r) => r.playerId)).toEqual(['A', 'B']);
    expect(a.rank).toBe(1);
    expect(b.rank).toBe(2);
  });

  it('uses spirePoints stored as the best per player and caps spire at 1000', () => {
    const rows: BestScoreRow[] = [spireRow('A', 400), spireRow('A', 1200)];
    const result = buildSeasonRanking(rows, nick);
    expect(result[0].spirePoints).toBe(SEASON_MODE_CAP);
  });

  it('breaks ties by daily, then spire, then puzzle points', () => {
    // Three players, all with seasonPoints 100, differing daily totals.
    const rows: BestScoreRow[] = [
      // P1: daily only (rank decided by score within the day)
      dailyRow('P1', '2026-06-15', 300, '2026-06-15T01:00:00.000Z'),
      dailyRow('P2', '2026-06-15', 200, '2026-06-15T01:00:00.000Z'),
      dailyRow('P3', '2026-06-15', 100, '2026-06-15T01:00:00.000Z'),
    ];
    // Field of 3: rank1=100, rank2=80, rank3=60.
    const result = buildSeasonRanking(rows, nick);
    expect(result.map((r) => [r.playerId, r.dailyPoints])).toEqual([
      ['P1', 100],
      ['P2', 80],
      ['P3', 60],
    ]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('ranks daily ties within a day by earlier updatedAt', () => {
    const rows: BestScoreRow[] = [
      dailyRow('Late', '2026-06-15', 500, '2026-06-15T12:00:00.000Z'),
      dailyRow('Early', '2026-06-15', 500, '2026-06-15T09:00:00.000Z'),
    ];
    const result = buildSeasonRanking(rows, nick);
    const early = result.find((r) => r.playerId === 'Early')!;
    const late = result.find((r) => r.playerId === 'Late')!;
    // Equal score -> earlier updatedAt sorts first -> rank 1 -> 100 pts
    expect(early.dailyPoints).toBe(100);
    expect(late.dailyPoints).toBe(80);
  });
});
