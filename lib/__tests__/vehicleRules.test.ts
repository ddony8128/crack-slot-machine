import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { computeWeights } from '@/lib/spin';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS, VEHICLES } from '@/data/symbols';
import type { Rng } from '@/lib/rng';

function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

const PREV_ZEROS: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];

describe('vehicle-surge — VEHICLES weight ×(slot rule count + 1)', () => {
  it('with [vehicle-surge] + 2 other rules -> ×(3+1) = ×4', () => {
    const w = computeWeights(
      [
        RULES_BY_ID['vehicle-surge'],
        RULES_BY_ID['seven-fever'],
        RULES_BY_ID['gem-surge'],
      ],
      BASE_WEIGHTS,
    );
    for (const v of VEHICLES) {
      expect(w[v]).toBe(BASE_WEIGHTS[v] * 4);
    }
  });

  it('with only [vehicle-surge] -> ×(1+1) = ×2', () => {
    const w = computeWeights([RULES_BY_ID['vehicle-surge']], BASE_WEIGHTS);
    for (const v of VEHICLES) {
      expect(w[v]).toBe(BASE_WEIGHTS[v] * 2);
    }
  });

  it('null slots are not counted (2 rules + nulls -> ×3)', () => {
    const w = computeWeights(
      [RULES_BY_ID['vehicle-surge'], null, RULES_BY_ID['seven-fever'], null, null],
      BASE_WEIGHTS,
    );
    for (const v of VEHICLES) {
      expect(w[v]).toBe(BASE_WEIGHTS[v] * 3);
    }
  });

  it('absent -> VEHICLES weights unchanged', () => {
    const w = computeWeights([RULES_BY_ID['seven-fever']], BASE_WEIGHTS);
    for (const v of VEHICLES) {
      expect(w[v]).toBe(BASE_WEIGHTS[v]);
    }
  });
});

describe('vehicle-logistics — swap two random cells per plane', () => {
  it('2 planes -> two swaps with known index picks + symbol_moved events', () => {
    // floor(x*5): 0.05->0, 0.45->2, 0.65->3, 0.85->4
    const base: SymbolType[] = ['plane', 'cherry', 'plane', 'lemon', 'grape'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-logistics']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.05, 0.45, 0.65, 0.85]),
    });
    // swap1: idx0<->idx2 -> [plane(from2), cherry, plane(from0), lemon, grape]
    // swap2: idx3<->idx4 -> [plane, cherry, plane, grape, lemon]
    expect(frame.working).toEqual(['plane', 'cherry', 'plane', 'grape', 'lemon']);

    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      // swap1 (idx0 <-> idx2): both cells held 'plane'
      { type: 'symbol_moved', symbolId: 'plane', fromIndex: 0, toIndex: 2, byRuleId: 'vehicle-logistics' },
      { type: 'symbol_moved', symbolId: 'plane', fromIndex: 2, toIndex: 0, byRuleId: 'vehicle-logistics' },
      // swap2 (idx3 <-> idx4): lemon <-> grape
      { type: 'symbol_moved', symbolId: 'lemon', fromIndex: 3, toIndex: 4, byRuleId: 'vehicle-logistics' },
      { type: 'symbol_moved', symbolId: 'grape', fromIndex: 4, toIndex: 3, byRuleId: 'vehicle-logistics' },
    ]);
  });

  it('rerolls the second pick until it is distinct from the first', () => {
    // 1 plane -> one swap. a=0 (0.05), b first draws 0 again (0.05) then 4 (0.85).
    const base: SymbolType[] = ['plane', 'cherry', 'lemon', 'grape', 'diamond'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-logistics']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.05, 0.05, 0.85]),
    });
    // swap idx0 <-> idx4: plane <-> diamond
    expect(frame.working).toEqual(['diamond', 'cherry', 'lemon', 'grape', 'plane']);
    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'plane', fromIndex: 0, toIndex: 4, byRuleId: 'vehicle-logistics' },
      { type: 'symbol_moved', symbolId: 'diamond', fromIndex: 4, toIndex: 0, byRuleId: 'vehicle-logistics' },
    ]);
  });

  it('0 planes -> no-op (board unchanged, no events)', () => {
    const base: SymbolType[] = ['ship', 'car', 'lemon', 'grape', 'diamond'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-logistics']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.5, 0.5]),
    });
    expect(frame.working).toEqual(base);
    expect(frame.events.filter((e) => e.type === 'symbol_moved')).toHaveLength(0);
  });
});

describe('vehicle-bigboat — leftmost ship copies into both neighbours', () => {
  it('ship at idx2 -> idx1 and idx3 become ship + symbol_copied events', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'ship', 'grape', 'diamond'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-bigboat']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.working).toEqual(['cherry', 'ship', 'ship', 'ship', 'diamond']);
    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'ship', fromIndex: 2, toIndex: 1, byRuleId: 'vehicle-bigboat' },
      { type: 'symbol_copied', symbolId: 'ship', fromIndex: 2, toIndex: 3, byRuleId: 'vehicle-bigboat' },
    ]);
  });

  it('ship at idx0 -> only the right neighbour (idx1) is copied', () => {
    const base: SymbolType[] = ['ship', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-bigboat']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.working).toEqual(['ship', 'ship', 'grape', 'diamond', 'seven']);
    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'ship', fromIndex: 0, toIndex: 1, byRuleId: 'vehicle-bigboat' },
    ]);
  });

  it('leftmost ship is chosen when multiple ships exist', () => {
    const base: SymbolType[] = ['cherry', 'ship', 'grape', 'ship', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-bigboat']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    // leftmost ship at idx1 copies into idx0 and idx2
    expect(frame.working).toEqual(['ship', 'ship', 'ship', 'ship', 'seven']);
  });

  it('no ship -> no-op (board unchanged, no events)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-bigboat']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.working).toEqual(base);
    expect(frame.events.filter((e) => e.type === 'symbol_copied')).toHaveLength(0);
  });
});
