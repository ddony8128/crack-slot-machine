import { describe, it, expect } from 'vitest';
import {
  puzzleScore,
  dailyRankReward,
  spireSeasonScore,
  DAILY_FIRST_PLAY,
  SUPPORTER_MIN_AMOUNT,
} from '@/lib/season/scoring';

describe('puzzleScore', () => {
  it('100 + 10 per leftover spin', () => {
    expect(puzzleScore(8, 5)).toBe(130); // 3 leftover
    expect(puzzleScore(6, 6)).toBe(100); // none leftover
    expect(puzzleScore(5, 9)).toBe(100); // overshoot clamps to 0 leftover
  });
});

describe('dailyRankReward (settled day)', () => {
  it('top10% → +50 only, top50% → +30, else 0', () => {
    // 7 participants: top10 cutoff=ceil(0.7)=1, top50 cutoff=ceil(3.5)=4
    expect(dailyRankReward(1, 7)).toBe(50);
    expect(dailyRankReward(2, 7)).toBe(30);
    expect(dailyRankReward(4, 7)).toBe(30);
    expect(dailyRankReward(5, 7)).toBe(0);
  });
  it('small field still pays rank 1', () => {
    expect(dailyRankReward(1, 1)).toBe(50);
    expect(dailyRankReward(1, 3)).toBe(50); // top10 cutoff=max(1,ceil(0.3))=1
    expect(dailyRankReward(2, 3)).toBe(30); // top50 cutoff=max(1,ceil(1.5))=2
    expect(dailyRankReward(3, 3)).toBe(0);
  });
  it('guards invalid input', () => {
    expect(dailyRankReward(0, 5)).toBe(0);
    expect(dailyRankReward(6, 5)).toBe(0);
    expect(dailyRankReward(1, 0)).toBe(0);
  });
  it('first-play constant', () => {
    expect(DAILY_FIRST_PLAY).toBe(20);
  });
});

describe('spireSeasonScore', () => {
  it('maxClearedStage×100 + money×10 + unusedSpins×10', () => {
    expect(spireSeasonScore(10, 18, 11)).toBe(1000 + 180 + 110); // 1290
    expect(spireSeasonScore(6, 9, 5)).toBe(600 + 90 + 50); // 740
    expect(spireSeasonScore(0, 0, 0)).toBe(0);
    expect(spireSeasonScore(-1, -5, -2)).toBe(0); // clamps
  });
});

describe('donation threshold', () => {
  it('is 만원', () => {
    expect(SUPPORTER_MIN_AMOUNT).toBe(10000);
  });
});
