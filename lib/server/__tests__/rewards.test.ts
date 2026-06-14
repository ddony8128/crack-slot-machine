import { describe, it, expect } from 'vitest';
import { computeCredits } from '@/lib/server/rewards';

describe('computeCredits', () => {
  it('first play crossing all three thresholds in one play = 4 credits', () => {
    const summary = computeCredits({
      isFirstPlay: true,
      previousBest: null,
      totalScore: 12000,
      hadAllAchievementsBefore: false,
      hasAllAchievementsNow: false,
    });
    expect(summary.awards.map((a) => a.reason)).toEqual([
      'first_play',
      'score_2000',
      'score_5000',
      'score_10000',
    ]);
    expect(summary.total).toBe(4);
    expect(summary.awards.every((a) => a.amount === 1)).toBe(true);
  });

  it('returning player previousBest 3000 hitting 6000 awards only score_5000', () => {
    const summary = computeCredits({
      isFirstPlay: false,
      previousBest: 3000,
      totalScore: 6000,
      hadAllAchievementsBefore: false,
      hasAllAchievementsNow: false,
    });
    expect(summary.awards.map((a) => a.reason)).toEqual(['score_5000']);
    expect(summary.total).toBe(1);
  });

  it('all_achievements awarded once when newly completed (now but not before)', () => {
    const summary = computeCredits({
      isFirstPlay: false,
      previousBest: 12000,
      totalScore: 12000,
      hadAllAchievementsBefore: false,
      hasAllAchievementsNow: true,
    });
    expect(summary.awards.map((a) => a.reason)).toEqual(['all_achievements']);
    expect(summary.total).toBe(1);
  });

  it('all_achievements not awarded again when already complete before', () => {
    const summary = computeCredits({
      isFirstPlay: false,
      previousBest: 12000,
      totalScore: 12000,
      hadAllAchievementsBefore: true,
      hasAllAchievementsNow: true,
    });
    expect(summary.awards).toEqual([]);
    expect(summary.total).toBe(0);
  });

  it('below 2000 first play = just first_play', () => {
    const summary = computeCredits({
      isFirstPlay: true,
      previousBest: null,
      totalScore: 1500,
      hadAllAchievementsBefore: false,
      hasAllAchievementsNow: false,
    });
    expect(summary.awards.map((a) => a.reason)).toEqual(['first_play']);
    expect(summary.total).toBe(1);
  });
});
