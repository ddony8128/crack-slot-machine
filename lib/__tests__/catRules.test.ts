import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
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

describe('cat-hold — pre-roll HOLD pass', () => {
  it('holds every cell whose previous value was a cat; others get the fresh roll', () => {
    const prev: SymbolType[] = ['cheese_cat', 'zero', 'tuxedo_cat', 'zero', 'calico_cat'];
    // Non-cat-prev cells (1, 3) keep their rolled base value (seven here).
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const ctx = {
      previousResult: prev,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    };
    const frame = beginCascade(base, [RULES_BY_ID['cat-hold']], ctx);

    // cat-prev cells held to the previous cat value and locked.
    expect(frame.working[0]).toBe('cheese_cat');
    expect(frame.working[2]).toBe('tuxedo_cat');
    expect(frame.working[4]).toBe('calico_cat');
    expect(frame.locked).toEqual([true, false, true, false, true]);

    // non-cat-prev cells keep the rolled base (unchanged by the hold).
    expect(frame.working[1]).toBe('seven');
    expect(frame.working[3]).toBe('seven');

    // emits a symbol_locked event for each held cat cell.
    const locks = frame.events.filter((e) => e.type === 'symbol_locked');
    expect(locks).toEqual([
      { type: 'symbol_locked', symbolId: 'cheese_cat', index: 0, byRuleId: 'cat-hold' },
      { type: 'symbol_locked', symbolId: 'tuxedo_cat', index: 2, byRuleId: 'cat-hold' },
      { type: 'symbol_locked', symbolId: 'calico_cat', index: 4, byRuleId: 'cat-hold' },
    ]);
  });

  it('a LATER transform rule can still modify a held cat (hold is first-roll only)', () => {
    // cat-hold holds cell0 (cheese_cat). first-cherry is a later rule and overwrites
    // cell0 -> cherry, un-holding it.
    const prev: SymbolType[] = ['cheese_cat', 'zero', 'zero', 'zero', 'zero'];
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const rules: Rule[] = [RULES_BY_ID['cat-hold'], RULES_BY_ID['first-cherry']];
    const frame = beginCascade(base, rules, {
      previousResult: prev,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.working[0]).toBe('cherry'); // later rule overwrote the held cat
    expect(frame.locked[0]).toBe(false); // writing the held cell un-holds it
  });

  it('holds ALL cat-prev cells with no count limit (unlike fruit-freeze max 2)', () => {
    const prev: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'calico_cat', 'cheese_cat', 'tuxedo_cat'];
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-hold']], {
      previousResult: prev,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.locked).toEqual([true, true, true, true, true]);
    expect(frame.working).toEqual(prev);
  });
});

describe('cat-zoomies — rightmost cat moves to index 0, others shift right', () => {
  it('[x, cheese_cat, x, tuxedo_cat, 7] -> [tuxedo_cat, x, cheese_cat, x, 7]', () => {
    const base: SymbolType[] = ['cherry', 'cheese_cat', 'lemon', 'tuxedo_cat', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-zoomies']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    // rightmost cat at idx3 (tuxedo_cat) -> idx0; cells 0..2 shift to 1..3.
    expect(frame.working).toEqual(['tuxedo_cat', 'cherry', 'cheese_cat', 'lemon', 'seven']);

    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      // shifts emitted highest-index-first (i -> i+1) reading the value that moved.
      { type: 'symbol_moved', symbolId: 'lemon', fromIndex: 2, toIndex: 3, byRuleId: 'cat-zoomies' },
      { type: 'symbol_moved', symbolId: 'cheese_cat', fromIndex: 1, toIndex: 2, byRuleId: 'cat-zoomies' },
      { type: 'symbol_moved', symbolId: 'cherry', fromIndex: 0, toIndex: 1, byRuleId: 'cat-zoomies' },
      // then the cat moves from its old index to 0.
      { type: 'symbol_moved', symbolId: 'tuxedo_cat', fromIndex: 3, toIndex: 0, byRuleId: 'cat-zoomies' },
    ]);
  });

  it('no cat on the board -> no-op (no moves, board unchanged)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-zoomies']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.working).toEqual(base);
    expect(frame.events.filter((e) => e.type === 'symbol_moved')).toHaveLength(0);
  });

  it('cat already at index 0 -> no-op (r === 0)', () => {
    const base: SymbolType[] = ['cheese_cat', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-zoomies']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.working).toEqual(base);
    expect(frame.events.filter((e) => e.type === 'symbol_moved')).toHaveLength(0);
  });
});

describe('cat-jump — leftmost cat swaps two cells left or right (random)', () => {
  it('cat at idx2 with both directions: rng < 0.5 picks the LEFT target (idx0)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'cheese_cat', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-jump']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.2]), // < 0.5 -> first (left, idx0)
    });
    expect(frame.working).toEqual(['cheese_cat', 'lemon', 'cherry', 'diamond', 'seven']);
    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'cheese_cat', fromIndex: 2, toIndex: 0, byRuleId: 'cat-jump' },
      { type: 'symbol_moved', symbolId: 'cherry', fromIndex: 0, toIndex: 2, byRuleId: 'cat-jump' },
    ]);
  });

  it('cat at idx2 with both directions: rng >= 0.5 picks the RIGHT target (idx4)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'cheese_cat', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-jump']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.8]), // >= 0.5 -> second (right, idx4)
    });
    expect(frame.working).toEqual(['cherry', 'lemon', 'seven', 'diamond', 'cheese_cat']);
    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'cheese_cat', fromIndex: 2, toIndex: 4, byRuleId: 'cat-jump' },
      { type: 'symbol_moved', symbolId: 'seven', fromIndex: 4, toIndex: 2, byRuleId: 'cat-jump' },
    ]);
  });

  it('cat at idx0: only the +2 target (idx2) is valid, rng draw still consumed safely', () => {
    const base: SymbolType[] = ['tuxedo_cat', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-jump']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.2]), // single option -> rng value irrelevant
    });
    expect(frame.working).toEqual(['grape', 'lemon', 'tuxedo_cat', 'diamond', 'seven']);
    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'tuxedo_cat', fromIndex: 0, toIndex: 2, byRuleId: 'cat-jump' },
      { type: 'symbol_moved', symbolId: 'grape', fromIndex: 2, toIndex: 0, byRuleId: 'cat-jump' },
    ]);
  });

  it('leftmost cat is chosen even when multiple cats exist', () => {
    // cats at idx1 and idx3; leftmost (idx1) jumps. Both directions valid -> rng<0.5
    // picks idx-1? no: L-2 = -1 invalid, so targets = [3] only... use idx2 instead.
    const base: SymbolType[] = ['cherry', 'cheese_cat', 'lemon', 'tuxedo_cat', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-jump']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.8]), // L=1: only +2 target (idx3) valid (L-2=-1 invalid)
    });
    // leftmost cat at idx1 swaps with idx3 (the only valid target).
    expect(frame.working).toEqual(['cherry', 'tuxedo_cat', 'lemon', 'cheese_cat', 'seven']);
  });

  it('no cat on the board -> no-op (no moves, board unchanged)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-jump']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.2]),
    });
    expect(frame.working).toEqual(base);
    expect(frame.events.filter((e) => e.type === 'symbol_moved')).toHaveLength(0);
  });
});

describe('cat-hold then a transform un-holds the held cat (integration)', () => {
  it('held cat at idx3 is moved by cat-zoomies (un-holds, moves to idx0)', () => {
    const prev: SymbolType[] = ['zero', 'zero', 'zero', 'tuxedo_cat', 'zero'];
    // cell3's base value is overwritten by cat-hold; all other cells are non-cats so
    // the held cat is the only cat on the board for cat-zoomies to find.
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'seven', 'diamond'];
    const rules: Rule[] = [RULES_BY_ID['cat-hold'], RULES_BY_ID['cat-zoomies']];
    const frame = beginCascade(base, rules, {
      previousResult: prev,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    // cat-hold held cell3 = tuxedo_cat; cat-zoomies then moved it to idx0 (un-held).
    expect(frame.working[0]).toBe('tuxedo_cat');
    expect(frame.locked[0]).toBe(false);
  });
});
