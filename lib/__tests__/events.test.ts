import { describe, it, expect } from 'vitest';
import type { EngineEvent, Rule, SymbolType } from '@/types';
import { beginCascade, resolveSelection } from '@/lib/cascade';
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

// A single rng draw value landing in `target`'s band of BASE_WEIGHTS.
function rngPoint(target: SymbolType): number {
  const entries = Object.entries(BASE_WEIGHTS) as Array<[SymbolType, number]>;
  const total = entries.reduce((s, [, w]) => s + (w > 0 ? w : 0), 0);
  let acc = 0;
  for (const [sym, w] of entries) {
    if (sym === target) break;
    acc += w;
  }
  return (acc + 0.5) / total;
}

const PREV: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];
const ctxNoRng = { previousResult: PREV, weights: BASE_WEIGHTS, rng: queuedRng([]) };

describe('cascade — additive engine event log', () => {
  it('four-shield emits symbol_rerolled (symbolId four) for each four index', () => {
    const base: SymbolType[] = ['four', 'cherry', 'four', 'diamond', 'cherry'];
    const ctx = {
      previousResult: PREV,
      weights: BASE_WEIGHTS,
      rng: queuedRng([rngPoint('grape'), rngPoint('seven')]),
    };
    const frame = beginCascade(base, [RULES_BY_ID['four-shield']], ctx);
    const rerolls = frame.events.filter((e) => e.type === 'symbol_rerolled');
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'four', index: 0, byRuleId: 'four-shield' },
      { type: 'symbol_rerolled', symbolId: 'four', index: 2, byRuleId: 'four-shield' },
    ]);
  });

  it('zero-to-seven emits symbol_transformed {from:zero,to:seven} per zero; none for non-zero', () => {
    const base: SymbolType[] = ['zero', 'cherry', 'zero', 'diamond', 'lemon'];
    const frame = beginCascade(base, [RULES_BY_ID['zero-to-seven']], ctxNoRng);
    const transforms = frame.events.filter((e) => e.type === 'symbol_transformed');
    expect(transforms).toEqual([
      { type: 'symbol_transformed', fromSymbolId: 'zero', toSymbolId: 'seven', index: 0, byRuleId: 'zero-to-seven' },
      { type: 'symbol_transformed', fromSymbolId: 'zero', toSymbolId: 'seven', index: 2, byRuleId: 'zero-to-seven' },
    ]);
    // No event mentions a non-zero cell index (1, 3, 4).
    const touched = new Set(transforms.map((e) => (e as { index: number }).index));
    expect(touched.has(1)).toBe(false);
    expect(touched.has(3)).toBe(false);
    expect(touched.has(4)).toBe(false);
  });

  it('left-pair emits one symbol_copied {fromIndex:0,toIndex:1,symbolId: cell0}', () => {
    const base: SymbolType[] = ['grape', 'lemon', 'cherry', 'diamond', 'ruby'];
    const frame = beginCascade(base, [RULES_BY_ID['left-pair']], ctxNoRng);
    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'grape', fromIndex: 0, toIndex: 1, byRuleId: 'left-pair' },
    ]);
  });

  it('last-lock emits symbol_locked at index 4 with the held previousResult value', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const prev: SymbolType[] = ['x', 'x', 'x', 'x', 'sapphire'] as SymbolType[];
    const frame = beginCascade(base, [RULES_BY_ID['last-lock']], {
      previousResult: prev,
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    const locks = frame.events.filter((e) => e.type === 'symbol_locked');
    expect(locks).toEqual([
      { type: 'symbol_locked', symbolId: 'sapphire', index: 4, byRuleId: 'last-lock' },
    ]);
  });

  it('select-swap emits two symbol_moved events with swapped from/to', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['select-swap']];
    const frame = beginCascade(base, rules, ctxNoRng);
    expect(frame.pending?.kind).toBe('swap');
    const done = resolveSelection(frame, rules, ctxNoRng, [0, 4]);
    const moves = done.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'cherry', fromIndex: 0, toIndex: 4, byRuleId: 'select-swap' },
      { type: 'symbol_moved', symbolId: 'ruby', fromIndex: 4, toIndex: 0, byRuleId: 'select-swap' },
    ]);
  });

  it('a transform to the SAME value emits NO event (first-cherry on a cherry cell)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const frame = beginCascade(base, [RULES_BY_ID['first-cherry']], ctxNoRng);
    expect(frame.events).toEqual([]);
  });

  it('a HELD cell DOES emit a transform event when a later rule changes it', () => {
    // center-lock HOLDS cell2 = ruby on the first roll; third-mirror is a later rule
    // and now sets cell2 = cell4 (seven), so it emits a copy event (hold is modifiable).
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const rules: Rule[] = [RULES_BY_ID['center-lock'], RULES_BY_ID['third-mirror']];
    const frame = beginCascade(base, rules, {
      previousResult: ['x', 'x', 'ruby', 'x', 'x'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    // The lock event fires at hold time; third-mirror's copy now fires too.
    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'seven', fromIndex: 4, toIndex: 2, byRuleId: 'third-mirror' },
    ]);
    const locks = frame.events.filter((e: EngineEvent) => e.type === 'symbol_locked');
    expect(locks).toEqual([
      { type: 'symbol_locked', symbolId: 'ruby', index: 2, byRuleId: 'center-lock' },
    ]);
  });
});
