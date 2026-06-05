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
  it('fruit-surge doubles fruit weights', () => {
    const w = computeWeights([RULES_BY_ID['fruit-surge']], BASE_WEIGHTS);
    for (const f of FRUITS) {
      expect(w[f]).toBe(BASE_WEIGHTS[f] * 2);
    }
    expect(w.seven).toBe(BASE_WEIGHTS.seven);
    expect(w.zero).toBe(BASE_WEIGHTS.zero);
  });

  it('gem-surge doubles gem weights', () => {
    const w = computeWeights([RULES_BY_ID['gem-surge']], BASE_WEIGHTS);
    expect(w.diamond).toBe(BASE_WEIGHTS.diamond * 2);
    expect(w.ruby).toBe(BASE_WEIGHTS.ruby * 2);
    expect(w.sapphire).toBe(BASE_WEIGHTS.sapphire * 2);
  });

  it('seven-fever triples seven; zero-fog raises zero, lowers four', () => {
    const sf = computeWeights([RULES_BY_ID['seven-fever']], BASE_WEIGHTS);
    expect(sf.seven).toBe(BASE_WEIGHTS.seven * 3);

    const zf = computeWeights([RULES_BY_ID['zero-fog']], BASE_WEIGHTS);
    expect(zf.zero).toBeCloseTo(BASE_WEIGHTS.zero * 1.8);
    expect(zf.four).toBeCloseTo(BASE_WEIGHTS.four * 0.4);
  });

  it('no-zero sets zero weight to 0', () => {
    const w = computeWeights([RULES_BY_ID['no-zero']], BASE_WEIGHTS);
    expect(w.zero).toBe(0);
  });

  it('stacking weight rules multiplies', () => {
    const w = computeWeights(
      [RULES_BY_ID['seven-fever'], RULES_BY_ID['seven-fever']],
      BASE_WEIGHTS,
    );
    expect(w.seven).toBe(BASE_WEIGHTS.seven * 3 * 3);
  });

  it('does not mutate the base weights', () => {
    const before = BASE_WEIGHTS.cherry;
    computeWeights([RULES_BY_ID['fruit-surge']], BASE_WEIGHTS);
    expect(BASE_WEIGHTS.cherry).toBe(before);
  });
});

describe('baseSpin', () => {
  it('returns n deterministic symbols with a fixed rng', () => {
    // first entry in BASE_WEIGHTS is 'cherry'; rng -> 0 targets first symbol.
    const rng = queuedRng([0, 0, 0, 0, 0]);
    const result = baseSpin(BASE_WEIGHTS, rng, 5);
    expect(result).toHaveLength(5);
    expect(result.every((s) => s === 'cherry')).toBe(true);
  });

  it('rollSymbol respects uniform weighted boundaries', () => {
    // uniform weights total = 9, 9 symbols each band width 1.
    // 'seven' is index 6 -> band [6,7).
    const point = (6 + 0.5) / 9;
    const sym: SymbolType = rollSymbol(BASE_WEIGHTS, () => point);
    expect(sym).toBe('seven');
  });
});
