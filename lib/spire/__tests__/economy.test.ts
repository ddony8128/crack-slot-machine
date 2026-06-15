import { describe, it, expect } from 'vitest';
import {
  spireClearPayout,
  spireInterest,
  spireSpinBonus,
  spireBuySymbolPrice,
  SPIRE_STAGES,
  SPIRE_STAGE_COUNT,
  SPIRE_SPINS_PER_STAGE,
  SPIRE_BASE_RULE_IDS,
  SPIRE_START_BAG,
  SPIRE_BAG_TOTAL,
} from '@/lib/spire/config';

describe('spire v0 economy', () => {
  it('clear payout follows the 4/6/8/0 tiers', () => {
    expect([1, 2, 3].map(spireClearPayout)).toEqual([4, 4, 4]);
    expect([4, 5, 6].map(spireClearPayout)).toEqual([6, 6, 6]);
    expect([7, 8, 9].map(spireClearPayout)).toEqual([8, 8, 8]);
    expect(spireClearPayout(10)).toBe(0);
    expect(spireClearPayout(99)).toBe(0);
  });

  it('interest = floor(balance/5), never negative', () => {
    expect(spireInterest(13)).toBe(2);
    expect(spireInterest(4)).toBe(0);
    expect(spireInterest(25)).toBe(5);
    expect(spireInterest(-3)).toBe(0);
  });

  it('spin bonus = +2 per remaining spin', () => {
    expect(spireSpinBonus(3)).toBe(6);
    expect(spireSpinBonus(0)).toBe(0);
    expect(spireSpinBonus(-1)).toBe(0);
  });

  it('symbol +1 price = current count', () => {
    expect(spireBuySymbolPrice(3)).toBe(3);
    expect(spireBuySymbolPrice(1)).toBe(1);
  });

  it('constants: 10 stages, 7 spins, 8 base rules, start bag totals 20', () => {
    expect(SPIRE_STAGES).toHaveLength(SPIRE_STAGE_COUNT);
    expect(SPIRE_SPINS_PER_STAGE).toBe(7);
    expect(SPIRE_BASE_RULE_IDS).toHaveLength(8);
    const start = Object.values(SPIRE_START_BAG).reduce((a, b) => a + b, 0);
    expect(start).toBe(SPIRE_BAG_TOTAL);
  });

  it('stage targets are strictly increasing', () => {
    for (let i = 1; i < SPIRE_STAGES.length; i++) {
      expect(SPIRE_STAGES[i].targetScore).toBeGreaterThan(SPIRE_STAGES[i - 1].targetScore);
    }
  });
});
