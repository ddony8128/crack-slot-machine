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
  // A `now` well past every test day so daily rank rewards are SETTLED.
  const SETTLED = new Date('2027-01-01T00:00:00.000Z');

  function spireRow(playerId: string, seasonPoints: number, score = 0): BestScoreRow {
    return baseRow(playerId, 'spire', `spire`, score, seasonPoints, null, '2026-06-01T00:00:00.000Z');
  }
  function puzzleRow(playerId: string, scopeKey: string, seasonPoints: number): BestScoreRow {
    return baseRow(playerId, 'puzzle', scopeKey, seasonPoints, seasonPoints, seasonPoints > 0, '2026-06-01T00:00:00.000Z');
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

  it('aggregates spire(best)/puzzle(sum)/daily(first-play+settled rank)', () => {
    // 2-player days → top10 cutoff=1: rank1 +50, rank2 +0. Each played day +20.
    const rows: BestScoreRow[] = [
      spireRow('A', 900, 900),
      puzzleRow('A', 'puzzle-1', 130),
      puzzleRow('A', 'puzzle-2', 120),
      dailyRow('A', '2026-06-15', 500, '2026-06-15T10:00:00.000Z'),
      dailyRow('A', '2026-06-16', 400, '2026-06-16T10:00:00.000Z'),

      spireRow('B', 300, 300),
      puzzleRow('B', 'puzzle-1', 110),
      dailyRow('B', '2026-06-15', 100, '2026-06-15T10:00:00.000Z'),
      dailyRow('B', '2026-06-16', 50, '2026-06-16T10:00:00.000Z'),
    ];

    const result = buildSeasonRanking(rows, nick, SETTLED);
    const a = result.find((r) => r.playerId === 'A')!;
    const b = result.find((r) => r.playerId === 'B')!;

    expect(a.spirePoints).toBe(900);
    expect(a.puzzlePoints).toBe(250); // 130 + 120 (summed)
    expect(a.dailyPoints).toBe(140); // (20+50) + (20+50), rank1 both days
    expect(a.seasonPoints).toBe(1290);
    expect(a.nickname).toBe('nick-A');

    expect(b.spirePoints).toBe(300);
    expect(b.puzzlePoints).toBe(110);
    expect(b.dailyPoints).toBe(40); // (20+0) + (20+0), rank2 both days
    expect(b.seasonPoints).toBe(450);

    expect(result.map((r) => r.playerId)).toEqual(['A', 'B']);
    expect([a.rank, b.rank]).toEqual([1, 2]);
  });

  it('keeps the best spire seasonPoints per player, no cap', () => {
    const rows: BestScoreRow[] = [spireRow('A', 400), spireRow('A', 1200)];
    const result = buildSeasonRanking(rows, nick, SETTLED);
    expect(result[0].spirePoints).toBe(1200); // max, uncapped
  });

  it('daily rank rewards on a settled day (field of 3)', () => {
    // N=3 → top10 cutoff=1 (+50), top50 cutoff=2 (+30), rank3 +0. All +20 first-play.
    const rows: BestScoreRow[] = [
      dailyRow('P1', '2026-06-15', 300, '2026-06-15T04:00:00.000Z'),
      dailyRow('P2', '2026-06-15', 200, '2026-06-15T04:00:00.000Z'),
      dailyRow('P3', '2026-06-15', 100, '2026-06-15T04:00:00.000Z'),
    ];
    const result = buildSeasonRanking(rows, nick, SETTLED);
    expect(result.map((r) => [r.playerId, r.dailyPoints])).toEqual([
      ['P1', 70], // 20 + 50
      ['P2', 50], // 20 + 30
      ['P3', 20], // 20 + 0
    ]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('ranks daily ties within a day by earlier updatedAt', () => {
    const rows: BestScoreRow[] = [
      dailyRow('Late', '2026-06-15', 500, '2026-06-15T12:00:00.000Z'),
      dailyRow('Early', '2026-06-15', 500, '2026-06-15T09:00:00.000Z'),
    ];
    const result = buildSeasonRanking(rows, nick, SETTLED);
    const early = result.find((r) => r.playerId === 'Early')!;
    const late = result.find((r) => r.playerId === 'Late')!;
    expect(early.dailyPoints).toBe(70); // rank1: 20 + 50
    expect(late.dailyPoints).toBe(20); // rank2 (N=2): 20 + 0
  });

  it('UNSETTLED day pays only first-play (+20), no rank reward yet', () => {
    // now is DURING 2026-06-20's window (ends 06-21 03:00Z) → not settled.
    const duringDay = new Date('2026-06-20T20:00:00.000Z');
    const rows: BestScoreRow[] = [
      dailyRow('P1', '2026-06-20', 300, '2026-06-20T13:00:00.000Z'),
      dailyRow('P2', '2026-06-20', 100, '2026-06-20T13:00:00.000Z'),
    ];
    const result = buildSeasonRanking(rows, nick, duringDay);
    expect(result.find((r) => r.playerId === 'P1')!.dailyPoints).toBe(20);
    expect(result.find((r) => r.playerId === 'P2')!.dailyPoints).toBe(20);
  });
});
