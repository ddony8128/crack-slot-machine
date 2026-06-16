import { describe, it, expect } from 'vitest';
import {
  puzzleSeasonPoints,
  seasonDailyTotal,
  buildSeasonRanking,
} from '@/lib/season/scoring';
import type { BestScoreRow, RunMode } from '@/lib/db/types';

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
  function puzzleRow(playerId: string, scopeKey: string, seasonPoints: number): BestScoreRow {
    return baseRow(playerId, 'puzzle', scopeKey, seasonPoints, seasonPoints, seasonPoints > 0, '2026-06-01T00:00:00.000Z');
  }
  // Daily rows now carry their SETTLED rank reward in `seasonPoints` (0 until the
  // day is settled by settleDueDailyChallenges). buildSeasonRanking just sums
  // DAILY_FIRST_PLAY + that stored reward per row — no per-day ranking recompute.
  function dailyRow(
    playerId: string,
    dateKey: string,
    score: number,
    updatedAt: string,
    rankReward = 0,
  ): BestScoreRow {
    return baseRow(playerId, 'daily', dateKey, score, rankReward, null, updatedAt);
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

  it('aggregates spire(best)/puzzle(sum)/daily(first-play+persisted rank)', () => {
    // Daily rows carry their settled rank reward in seasonPoints; +20 per row is
    // derived here. A's days were settled rank1 (+50), B's rank2 (+0).
    const rows: BestScoreRow[] = [
      spireRow('A', 900, 900),
      puzzleRow('A', 'puzzle-1', 130),
      puzzleRow('A', 'puzzle-2', 120),
      dailyRow('A', '2026-06-15', 500, '2026-06-15T10:00:00.000Z', 50),
      dailyRow('A', '2026-06-16', 400, '2026-06-16T10:00:00.000Z', 50),

      spireRow('B', 300, 300),
      puzzleRow('B', 'puzzle-1', 110),
      dailyRow('B', '2026-06-15', 100, '2026-06-15T10:00:00.000Z', 0),
      dailyRow('B', '2026-06-16', 50, '2026-06-16T10:00:00.000Z', 0),
    ];

    const result = buildSeasonRanking(rows, nick);
    const a = result.find((r) => r.playerId === 'A')!;
    const b = result.find((r) => r.playerId === 'B')!;

    expect(a.spirePoints).toBe(900);
    expect(a.puzzlePoints).toBe(250); // 130 + 120 (summed)
    expect(a.dailyPoints).toBe(140); // (20+50) + (20+50)
    expect(a.seasonPoints).toBe(1290);
    expect(a.nickname).toBe('nick-A');

    expect(b.spirePoints).toBe(300);
    expect(b.puzzlePoints).toBe(110);
    expect(b.dailyPoints).toBe(40); // (20+0) + (20+0)
    expect(b.seasonPoints).toBe(450);

    expect(result.map((r) => r.playerId)).toEqual(['A', 'B']);
    expect([a.rank, b.rank]).toEqual([1, 2]);
  });

  it('keeps the best spire seasonPoints per player, no cap', () => {
    const rows: BestScoreRow[] = [spireRow('A', 400), spireRow('A', 1200)];
    const result = buildSeasonRanking(rows, nick);
    expect(result[0].spirePoints).toBe(1200); // max, uncapped
  });

  it('sums daily as DAILY_FIRST_PLAY×rows + Σ persisted rank rewards', () => {
    // Three settled rows for one player: +20 each + their stored rewards.
    const rows: BestScoreRow[] = [
      dailyRow('P1', '2026-06-15', 300, '2026-06-15T04:00:00.000Z', 50),
      dailyRow('P1', '2026-06-16', 200, '2026-06-16T04:00:00.000Z', 30),
      dailyRow('P1', '2026-06-17', 100, '2026-06-17T04:00:00.000Z', 0),
    ];
    const result = buildSeasonRanking(rows, nick);
    // 3×20 + (50+30+0) = 60 + 80 = 140
    expect(result[0].dailyPoints).toBe(140);
  });

  it('an unsettled daily row (seasonPoints 0) pays only first-play (+20)', () => {
    const rows: BestScoreRow[] = [
      dailyRow('P1', '2026-06-20', 300, '2026-06-20T13:00:00.000Z'),
      dailyRow('P2', '2026-06-20', 100, '2026-06-20T13:00:00.000Z'),
    ];
    const result = buildSeasonRanking(rows, nick);
    expect(result.find((r) => r.playerId === 'P1')!.dailyPoints).toBe(20);
    expect(result.find((r) => r.playerId === 'P2')!.dailyPoints).toBe(20);
  });
});
