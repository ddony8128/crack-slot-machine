import { describe, it, expect } from 'vitest';
import {
  stageAttemptSeed,
  bagToWeights,
  spireStageRunConfig,
  spireStageOutcome,
  spireStageTarget,
} from '@/lib/spire/stage';
import { SPIRE_SPINS_PER_STAGE, SPIRE_STAGES } from '@/lib/spire/config';

describe('stageAttemptSeed', () => {
  it('is stable + distinct per stage/attempt', () => {
    expect(stageAttemptSeed('run1', 4, 2)).toBe('run1:stage-4:attempt-2');
    expect(stageAttemptSeed('run1', 4, 2)).toBe(stageAttemptSeed('run1', 4, 2));
    expect(stageAttemptSeed('run1', 4, 1)).not.toBe(stageAttemptSeed('run1', 4, 2));
  });
});

describe('bagToWeights', () => {
  it('expands counts into a full weight map with 0 defaults', () => {
    const w = bagToWeights({ zero: 9, four: 5, seven: 3, cherry: 1 });
    expect(w.zero).toBe(9);
    expect(w.cherry).toBe(1);
    expect(w.lemon).toBe(0); // absent → 0
  });
});

describe('spireStageRunConfig', () => {
  it('builds a 7-spin pool run from the bag + pool, seeded by attempt', () => {
    const bag = { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 };
    const cfg = spireStageRunConfig('run1', 4, 2, bag, ['select-swap', 'seven-fever']);
    expect(cfg.maxSpins).toBe(SPIRE_SPINS_PER_STAGE);
    expect(cfg.provisioning).toBe('pool');
    expect(cfg.rulePoolIds).toEqual(['select-swap', 'seven-fever']);
    expect(cfg.initialBoard).toHaveLength(5);
    expect(cfg.baseWeights?.zero).toBe(9);
    // same inputs → same board; different attempt → (almost surely) different seed-driven board
    const same = spireStageRunConfig('run1', 4, 2, bag, ['select-swap']);
    expect(same.initialBoard).toEqual(cfg.initialBoard);
  });
});

describe('spireStageOutcome (immediate clear)', () => {
  it('clears the moment cumulative ≥ target, banking remaining spins', () => {
    // target 500, reached on spin 4 of 7 → 3 remaining
    const o = spireStageOutcome([100, 100, 100, 250, 999, 999, 999], 500);
    expect(o.cleared).toBe(true);
    expect(o.spinsUsed).toBe(4);
    expect(o.remainingSpins).toBe(3);
    expect(o.stageScore).toBe(550); // cumulative through the clearing spin
  });

  it('fails when 7 spins never reach the target', () => {
    const o = spireStageOutcome([10, 10, 10, 10, 10, 10, 10], 500);
    expect(o.cleared).toBe(false);
    expect(o.spinsUsed).toBe(7);
    expect(o.remainingSpins).toBe(0);
    expect(o.stageScore).toBe(70);
  });

  it('clears exactly on the final spin → 0 remaining', () => {
    const o = spireStageOutcome([100, 100, 100, 100, 50, 25, 25], 500);
    expect(o.cleared).toBe(true);
    expect(o.spinsUsed).toBe(7);
    expect(o.remainingSpins).toBe(0);
  });

  it('spireStageTarget matches the table', () => {
    expect(spireStageTarget(1)).toBe(SPIRE_STAGES[0].targetScore);
    expect(spireStageTarget(10)).toBe(20000);
    expect(spireStageTarget(99)).toBe(0);
  });
});
