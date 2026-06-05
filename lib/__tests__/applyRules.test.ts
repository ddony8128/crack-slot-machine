import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { applyRules } from '@/lib/applyRules';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import type { Rng } from '@/lib/rng';

// An rng that yields a queued sequence of values.
function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

// An rng that forces rollSymbol to return a specific symbol.
// rollSymbol walks Object.entries(weights) accumulating weight until target<0.
// Returning a tiny value (~0) targets the FIRST positive-weighted symbol.
function rngForSymbol(target: SymbolType): Rng {
  const entries = Object.entries(BASE_WEIGHTS) as Array<[SymbolType, number]>;
  const total = entries.reduce((s, [, w]) => s + (w > 0 ? w : 0), 0);
  // accumulate weight up to (but not including) target, then a hair more.
  let acc = 0;
  for (const [sym, w] of entries) {
    if (sym === target) break;
    acc += w;
  }
  // pick a point inside the target's band
  const point = (acc + 0.5) / total;
  return () => point;
}

const noCtx = {
  previousResult: ['zero', 'zero', 'zero', 'zero', 'zero'] as SymbolType[],
  weights: BASE_WEIGHTS,
  rng: queuedRng([]),
};

describe('applyRules', () => {
  it('edge-mirror then four-shield: 🍒 4 💎 0 🍋 => 🍒 🍋 💎 0 🍒', () => {
    const base: SymbolType[] = ['cherry', 'four', 'diamond', 'zero', 'lemon'];
    const rules: Rule[] = [RULES_BY_ID['edge-mirror'], RULES_BY_ID['four-shield']];
    const { finalResult, steps } = applyRules(base, rules, {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'), // rerolled four becomes lemon
    });
    expect(finalResult).toEqual(['cherry', 'lemon', 'diamond', 'zero', 'cherry']);
    // edge-mirror first snapshot, then four-shield snapshot
    expect(steps).toHaveLength(2);
    expect(steps[0].label).toBe('EDGE MIRROR');
    expect(steps[0].result).toEqual(['cherry', 'four', 'diamond', 'zero', 'cherry']);
    expect(steps[1].label).toBe('FOUR SHIELD');
    expect(steps[1].result).toEqual(['cherry', 'lemon', 'diamond', 'zero', 'cherry']);
  });

  it('left-pair: 7 0 🍒 💎 4 => 7 7 🍒 💎 4', () => {
    const base: SymbolType[] = ['seven', 'zero', 'cherry', 'diamond', 'four'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['left-pair']], noCtx);
    expect(finalResult).toEqual(['seven', 'seven', 'cherry', 'diamond', 'four']);
  });

  it('safe-convert then center-echo: 7 🍒 0 4 7 => 7 🍒 0 🍒 7', () => {
    const base: SymbolType[] = ['seven', 'cherry', 'zero', 'four', 'seven'];
    const rules: Rule[] = [RULES_BY_ID['safe-convert'], RULES_BY_ID['center-echo']];
    const { finalResult, steps } = applyRules(base, rules, noCtx);
    // safe-convert: idx3 four -> zero => 7 🍒 0 0 7
    expect(steps[0].result).toEqual(['seven', 'cherry', 'zero', 'zero', 'seven']);
    // center-echo: cell[3] = cell[1] => 7 🍒 0 🍒 7
    expect(finalResult).toEqual(['seven', 'cherry', 'zero', 'cherry', 'seven']);
  });

  it('lucky-convert: 🍒 0 4 💎 0 => 🍒 7 4 💎 0', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'four', 'diamond', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['lucky-convert']], noCtx);
    expect(finalResult).toEqual(['cherry', 'seven', 'four', 'diamond', 'zero']);
  });

  it('weight-type rules are skipped (no steps)', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'four', 'diamond', 'zero'];
    const { finalResult, steps } = applyRules(
      base,
      [RULES_BY_ID['fruit-mode'], RULES_BY_ID['gem-mode']],
      noCtx,
    );
    expect(steps).toHaveLength(0);
    expect(finalResult).toEqual(base);
    expect(finalResult).not.toBe(base); // fresh copy
  });

  it('center-lock uses previousResult center cell', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'four', 'diamond', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['center-lock']], {
      previousResult: ['seven', 'seven', 'ruby', 'seven', 'seven'],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(finalResult).toEqual(['cherry', 'zero', 'ruby', 'diamond', 'zero']);
  });
});
