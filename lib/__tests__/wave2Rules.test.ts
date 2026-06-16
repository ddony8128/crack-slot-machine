import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import type { Rng } from '@/lib/rng';

// Queued rng: each call returns the next value (0 once exhausted). Under
// BASE_WEIGHTS the 9 base symbols carry weight 1 (monster/cat/vehicle = 0), so a
// rolled value of 0 maps to the first positive-weighted symbol -> 'cherry'.
function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

const PREV_ZEROS: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];

const ctxFor = (rng: Rng = queuedRng([])) => ({
  previousResult: PREV_ZEROS,
  weights: BASE_WEIGHTS,
  rng,
});

describe('지박령 (jibakryeong) — leftmost ghost cell is haunted AND rerolled', () => {
  it('haunts the leftmost ghost (idx1) and rerolls it; later ghost (idx3) untouched', () => {
    const base: SymbolType[] = ['seven', 'ghost', 'zero', 'ghost', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['jibakryeong']], ctxFor(queuedRng([0])));

    // idx1 cell stays haunted even though its symbol was rerolled (-> 'cherry').
    expect(frame.haunted).toEqual([false, true, false, false, false]);
    expect(frame.working[1]).toBe('cherry');
    // The trailing ghost at idx3 is untouched.
    expect(frame.working[3]).toBe('ghost');

    const rerolls = frame.events.filter((e) => e.type === 'symbol_rerolled');
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'ghost', index: 1, byRuleId: 'jibakryeong' },
    ]);
  });

  it('no ghost on the board -> no-op (no haunt, no reroll)', () => {
    const base: SymbolType[] = ['seven', 'zombie', 'zero', 'dracula', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['jibakryeong']], ctxFor(queuedRng([0])));

    expect(frame.haunted).toEqual([false, false, false, false, false]);
    expect(frame.working).toEqual(base);
    expect(frame.events).toHaveLength(0);
  });
});

describe('퍼져나가는 역병 (plague) — leftmost zombie copies to both sides, original rerolled', () => {
  it('copies into idx0 & idx2 from idx1, then rerolls idx1', () => {
    const base: SymbolType[] = ['zero', 'zombie', 'seven', 'four', 'cherry'];
    const frame = beginCascade(base, [RULES_BY_ID['plague']], ctxFor(queuedRng([0])));

    // Sides copied to zombie; center (idx1) rerolled to 'cherry'.
    expect(frame.working).toEqual(['zombie', 'cherry', 'zombie', 'four', 'cherry']);

    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'zombie', fromIndex: 1, toIndex: 0, byRuleId: 'plague' },
      { type: 'symbol_copied', symbolId: 'zombie', fromIndex: 1, toIndex: 2, byRuleId: 'plague' },
    ]);
    const rerolls = frame.events.filter((e) => e.type === 'symbol_rerolled');
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'zombie', index: 1, byRuleId: 'plague' },
    ]);
  });

  it('leftmost zombie at idx0 -> only the right side (idx1) is copied', () => {
    const base: SymbolType[] = ['zombie', 'seven', 'zero', 'four', 'cherry'];
    const frame = beginCascade(base, [RULES_BY_ID['plague']], ctxFor(queuedRng([0])));

    // No left neighbour; idx1 becomes zombie; idx0 (original) rerolled to 'cherry'.
    expect(frame.working).toEqual(['cherry', 'zombie', 'zero', 'four', 'cherry']);

    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'zombie', fromIndex: 0, toIndex: 1, byRuleId: 'plague' },
    ]);
    const rerolls = frame.events.filter((e) => e.type === 'symbol_rerolled');
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'zombie', index: 0, byRuleId: 'plague' },
    ]);
  });

  it('no zombie on the board -> no-op', () => {
    const base: SymbolType[] = ['zero', 'ghost', 'seven', 'dracula', 'cherry'];
    const frame = beginCascade(base, [RULES_BY_ID['plague']], ctxFor(queuedRng([0])));

    expect(frame.working).toEqual(base);
    expect(frame.events).toHaveLength(0);
  });
});
