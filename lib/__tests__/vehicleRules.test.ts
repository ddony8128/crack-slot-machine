import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade, resolveSelection } from '@/lib/cascade';
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

describe('vehicle-logistics (물류 사업) — PLAYER swap repeated once per plane', () => {
  const rules = [RULES_BY_ID['vehicle-logistics']];
  // logiswap is deterministic (no rng); a fresh empty-queue ctx is fine each call.
  const ctx = () => ({ previousResult: PREV_ZEROS, weights: BASE_WEIGHTS, rng: queuedRng([]) });

  it('2 planes -> pauses for TWO player swaps (remaining counts down 2 → 1)', () => {
    const base: SymbolType[] = ['plane', 'cherry', 'plane', 'lemon', 'grape'];
    let frame = beginCascade(base, rules, ctx());
    expect(frame.pending?.kind).toBe('logiswap');
    expect(frame.pending?.count).toBe(2);
    expect(frame.pending?.remaining).toBe(2);
    expect(frame.done).toBe(false);

    // 1st swap: player picks idx3 <-> idx4 (lemon <-> grape).
    frame = resolveSelection(frame, rules, ctx(), [3, 4]);
    expect(frame.working).toEqual(['plane', 'cherry', 'plane', 'grape', 'lemon']);
    // still paused for the 2nd swap.
    expect(frame.pending?.kind).toBe('logiswap');
    expect(frame.pending?.remaining).toBe(1);
    expect(frame.done).toBe(false);

    // 2nd swap: player picks idx0 <-> idx1 (plane <-> cherry). Rule completes.
    frame = resolveSelection(frame, rules, ctx(), [0, 1]);
    expect(frame.working).toEqual(['cherry', 'plane', 'plane', 'grape', 'lemon']);
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);

    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'lemon', fromIndex: 3, toIndex: 4, byRuleId: 'vehicle-logistics' },
      { type: 'symbol_moved', symbolId: 'grape', fromIndex: 4, toIndex: 3, byRuleId: 'vehicle-logistics' },
      { type: 'symbol_moved', symbolId: 'plane', fromIndex: 0, toIndex: 1, byRuleId: 'vehicle-logistics' },
      { type: 'symbol_moved', symbolId: 'cherry', fromIndex: 1, toIndex: 0, byRuleId: 'vehicle-logistics' },
    ]);
  });

  it('1 plane -> a single swap, then the rule resolves', () => {
    const base: SymbolType[] = ['plane', 'cherry', 'lemon', 'grape', 'diamond'];
    let frame = beginCascade(base, rules, ctx());
    expect(frame.pending?.remaining).toBe(1);
    frame = resolveSelection(frame, rules, ctx(), [0, 4]); // plane <-> diamond
    expect(frame.working).toEqual(['diamond', 'cherry', 'lemon', 'grape', 'plane']);
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
  });

  it('0 planes -> AUTO-SKIPS (no pause, board unchanged, no events)', () => {
    const base: SymbolType[] = ['ship', 'car', 'lemon', 'grape', 'diamond'];
    const frame = beginCascade(base, rules, ctx());
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
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
