import { describe, it, expect } from 'vitest';
import { spireRunConfig, spireProgress } from '@/lib/spire/run';
import { SPIRE_STAGES, SPIRE_STAGE_COUNT, SPIRE_SPINS_PER_STAGE } from '@/lib/spire/config';

describe('spireRunConfig', () => {
  it('builds a pool run of stageCount*spinsPerStage spins', () => {
    const cfg = spireRunConfig('s1', 'fruit');
    expect(cfg.provisioning).toBe('pool');
    expect(cfg.maxSpins).toBe(SPIRE_STAGE_COUNT * SPIRE_SPINS_PER_STAGE);
    expect(cfg.initialBoard).toHaveLength(5);
    expect(cfg.rulePoolIds).toContain('select-swap'); // spire basic
    expect(cfg.baseWeights?.zero).toBe(9); // post-choice bag
  });
});

describe('spireProgress', () => {
  // one stage = SPIRE_SPINS_PER_STAGE spins; put the whole stage score in spin 0.
  const stage = (score: number): number[] => [score, ...Array(SPIRE_SPINS_PER_STAGE - 1).fill(0)];

  it('all 10 stages cleared → stagesCleared 10, no fail', () => {
    const scores = SPIRE_STAGES.flatMap((s) => stage(s.targetScore));
    const p = spireProgress(scores);
    expect(p.stagesCleared).toBe(10);
    expect(p.failedStage).toBeNull();
    expect(p.totalScore).toBe(SPIRE_STAGES.reduce((a, s) => a + s.targetScore, 0));
  });

  it('fails at stage 3 when stage 3 is below target', () => {
    const scores = [
      ...stage(SPIRE_STAGES[0].targetScore),
      ...stage(SPIRE_STAGES[1].targetScore),
      ...stage(SPIRE_STAGES[2].targetScore - 1), // miss stage 3
      ...stage(SPIRE_STAGES[3].targetScore),     // would-be stage 4 ignored
    ];
    const p = spireProgress(scores);
    expect(p.stagesCleared).toBe(2);
    expect(p.failedStage).toBe(3);
  });

  it('incomplete final stage counts as a fail at that stage', () => {
    const scores = [
      ...stage(SPIRE_STAGES[0].targetScore),
      ...stage(SPIRE_STAGES[1].targetScore),
      0, 0, // partial stage 3
    ];
    const p = spireProgress(scores);
    expect(p.stagesCleared).toBe(2);
    expect(p.failedStage).toBe(3);
  });

  it('empty run → 0 cleared, fails at stage 1', () => {
    const p = spireProgress([]);
    expect(p.stagesCleared).toBe(0);
    expect(p.failedStage).toBe(1);
    expect(p.totalScore).toBe(0);
  });
});
