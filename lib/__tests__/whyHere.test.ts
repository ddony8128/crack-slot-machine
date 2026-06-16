import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { beginCascade, resolveSelection } from '@/lib/cascade';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import type { Rng } from '@/lib/rng';

/**
 * 왜 여기 타 있어 (why-here, cat×vehicle combo) -> kind 'catswap'.
 * The player picks ONE target cell; the LEFTMOST cat that has a VEHICLE neighbour
 * is swapped with the chosen cell. Applicable only when such a cat exists.
 * Pure board op (no rng) -> replays deterministically.
 */

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

describe('select catswap (왜 여기 타 있어) — leftmost vehicle-adjacent cat swaps with the chosen cell', () => {
  const rules: Rule[] = [RULES_BY_ID['why-here']];

  it('pauses for a single pick when a cat is adjacent to a vehicle; all non-locked cells selectable', () => {
    // cat at idx0 has vehicle (car) at idx1 -> applicable.
    const base: SymbolType[] = ['cheese_cat', 'car', 'zero', 'seven', 'ruby'];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending?.kind).toBe('catswap');
    expect(frame.pending?.count).toBe(1);
    expect(frame.pending?.selectable).toEqual([true, true, true, true, true]);
    expect(frame.done).toBe(false);
  });

  it('swaps the leftmost vehicle-adjacent cat (src) into the chosen cell + emits 2 symbol_moved events', () => {
    // cat at idx0 (vehicle neighbour car at idx1) is the source; player picks idx4.
    const base: SymbolType[] = ['cheese_cat', 'car', 'zero', 'seven', 'ruby'];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [4]);

    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(['ruby', 'car', 'zero', 'seven', 'cheese_cat']);
    expect(frame.working[0]).toBe('ruby');
    expect(frame.working[4]).toBe('cheese_cat');
    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'cheese_cat', fromIndex: 0, toIndex: 4, byRuleId: 'why-here' },
      { type: 'symbol_moved', symbolId: 'ruby', fromIndex: 4, toIndex: 0, byRuleId: 'why-here' },
    ]);
    expect(frame.steps.at(-1)?.label).toBe('왜 여기 타 있어');
  });

  it('picks the LEFTMOST vehicle-adjacent cat as the source (not just any cat)', () => {
    // idx0 cat has NO vehicle neighbour; idx3 cat has a vehicle (plane) at idx2.
    // Source must be idx3, not idx0.
    const base: SymbolType[] = ['tuxedo_cat', 'zero', 'plane', 'calico_cat', 'seven'];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [1]);

    expect(frame.working[3]).toBe('zero');         // chosen cell got src's value
    expect(frame.working[1]).toBe('calico_cat');   // src cat moved into chosen cell
    expect(frame.working[0]).toBe('tuxedo_cat');   // non-adjacent cat untouched
    const moves = frame.events.filter((e) => e.type === 'symbol_moved');
    expect(moves).toEqual([
      { type: 'symbol_moved', symbolId: 'calico_cat', fromIndex: 3, toIndex: 1, byRuleId: 'why-here' },
      { type: 'symbol_moved', symbolId: 'zero', fromIndex: 1, toIndex: 3, byRuleId: 'why-here' },
    ]);
  });

  it('self-swap (chosen cell IS the source) is a harmless no-op (no events)', () => {
    const base: SymbolType[] = ['cheese_cat', 'car', 'zero', 'seven', 'ruby'];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [0]); // pick the source cell itself

    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(base); // unchanged
    expect(frame.events.filter((e) => e.type === 'symbol_moved')).toEqual([]);
  });

  it('AUTO-SKIPS (no pause) when cats exist but NONE is adjacent to a vehicle', () => {
    const base: SymbolType[] = ['cheese_cat', 'zero', 'tuxedo_cat', 'seven', 'ruby'];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(base);
    expect(frame.steps.some((s) => s.label.includes('건너뜀'))).toBe(true);
  });

  it('AUTO-SKIPS (no pause) when there is no cat on the board', () => {
    const base: SymbolType[] = ['car', 'plane', 'ship', 'seven', 'ruby'];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(base);
    expect(frame.steps.some((s) => s.label.includes('건너뜀'))).toBe(true);
  });

  it('AUTO-SKIPS via the pure (autoSkipSelect) path even when applicable', () => {
    const base: SymbolType[] = ['cheese_cat', 'car', 'zero', 'seven', 'ruby'];
    const frame = beginCascade(base, rules, ctxFor(), { autoSkipSelect: true });
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(base);
  });

  it('is deterministic: same board + same chosen index -> identical result (no rng consumed)', () => {
    const base: SymbolType[] = ['cheese_cat', 'car', 'zero', 'seven', 'ruby'];
    const run = () => {
      const rng = queuedRng([0.111, 0.222, 0.333]); // values that must NOT be consumed
      let f = beginCascade(base, rules, ctxFor(rng));
      f = resolveSelection(f, rules, ctxFor(rng), [3]);
      return f;
    };
    const a = run();
    const b = run();
    expect(a.working).toEqual(b.working);
    expect(a.events).toEqual(b.events);
    expect(a.working).toEqual(['seven', 'car', 'zero', 'cheese_cat', 'ruby']);
  });
});
