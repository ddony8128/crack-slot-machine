import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { baseSpin, computeWeights } from '@/lib/spin';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS, FRUITS } from '@/data/symbols';
import { rollSymbol, type Rng } from '@/lib/rng';

function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

describe('computeWeights', () => {
  it('fruit-mode increases fruit weight vs base', () => {
    const w = computeWeights([RULES_BY_ID['fruit-mode']], BASE_WEIGHTS);
    for (const f of FRUITS) {
      expect(w[f]).toBeGreaterThan(BASE_WEIGHTS[f]);
    }
    // non-fruit unchanged
    expect(w.seven).toBe(BASE_WEIGHTS.seven);
    expect(w.zero).toBe(BASE_WEIGHTS.zero);
  });

  it('zero-fog raises zero and lowers four', () => {
    const w = computeWeights([RULES_BY_ID['zero-fog']], BASE_WEIGHTS);
    expect(w.zero).toBeGreaterThan(BASE_WEIGHTS.zero);
    expect(w.four).toBeLessThan(BASE_WEIGHTS.four);
  });

  it('does not mutate the base weights', () => {
    const before = BASE_WEIGHTS.cherry;
    computeWeights([RULES_BY_ID['fruit-mode']], BASE_WEIGHTS);
    expect(BASE_WEIGHTS.cherry).toBe(before);
  });

  it('stacking weight rules multiplies', () => {
    const w = computeWeights(
      [RULES_BY_ID['seven-fever'], RULES_BY_ID['seven-fever']],
      BASE_WEIGHTS,
    );
    expect(w.seven).toBe(BASE_WEIGHTS.seven * 3 * 3);
  });
});

describe('baseSpin', () => {
  it('returns n deterministic symbols with a fixed rng', () => {
    // first symbol in BASE_WEIGHTS entries order is 'cherry' (weight 10).
    // rng -> 0 always targets the first positive-weighted symbol.
    const rng = queuedRng([0, 0, 0, 0, 0]);
    const result = baseSpin(BASE_WEIGHTS, rng, 5);
    expect(result).toHaveLength(5);
    expect(result.every((s) => s === 'cherry')).toBe(true);
  });

  it('rollSymbol respects weighted boundaries', () => {
    // cumulative weight before 'seven':
    // cherry(10)+lemon(10)+grape(10)+diamond(8)+ruby(8)+sapphire(8) = 54
    // total = 54+4(seven)+18(zero)+14(four) = 90; 'seven' band is [54, 58)
    const total = Object.values(BASE_WEIGHTS).reduce((a, b) => a + b, 0);
    const point = (54 + 0.5) / total;
    const sym: SymbolType = rollSymbol(BASE_WEIGHTS, () => point);
    expect(sym).toBe('seven');
  });
});
