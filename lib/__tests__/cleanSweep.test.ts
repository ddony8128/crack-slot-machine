import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { scoreResult } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { CLEAN_BONUS } from '@/data/scoreTable';

const ctx = () => ({
  previousResult: ['zero', 'zero', 'zero', 'zero', 'zero'] as SymbolType[],
  weights: BASE_WEIGHTS,
  rng: () => 0,
});

describe('CLEAN SWEEP is position-aware (board at the rule\'s moment)', () => {
  it('does NOT pay when a 4 is present at its slot, even if removed later', () => {
    // base has a 4; CLEAN SWEEP is BEFORE safe-convert (which removes the 4).
    const base: SymbolType[] = ['four', 'cherry', 'cherry', 'zero', 'zero'];
    const rules = [RULES_BY_ID['clean-bonus'], RULES_BY_ID['safe-convert']];
    const frame = beginCascade(base, rules, ctx());
    expect(frame.working.includes('four')).toBe(false); // final board is 4-free

    // position-aware: clean-bonus saw a 4 → no bonus
    const aware = scoreResult(frame.working, rules, frame.events, frame.scoreBoards);
    // final-board fallback (no scoreBoards): would pay
    const fallback = scoreResult(frame.working, rules);
    expect(fallback.bonusScore - aware.bonusScore).toBe(CLEAN_BONUS);
  });

  it('DOES pay when the board is 4-free at its slot (4 removed before it)', () => {
    const base: SymbolType[] = ['four', 'cherry', 'cherry', 'zero', 'zero'];
    const rules = [RULES_BY_ID['safe-convert'], RULES_BY_ID['clean-bonus']];
    const frame = beginCascade(base, rules, ctx());
    const aware = scoreResult(frame.working, rules, frame.events, frame.scoreBoards);
    // clean-bonus ran after the 4 was converted → +120 included
    const withoutClean = scoreResult(frame.working, [RULES_BY_ID['safe-convert']], frame.events, []);
    expect(aware.bonusScore - withoutClean.bonusScore).toBe(CLEAN_BONUS);
  });
});
