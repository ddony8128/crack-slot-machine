import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { beginCascade, resolveSelection } from '@/lib/cascade';
import { scoreResult } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { PARKING_FEE_PER, DRACULA_FAMILY_PER } from '@/data/scoreTable';
import type { Rng } from '@/lib/rng';

/**
 * The two RULE SLOT rules that became PLAYER-SELECTED (직접 선택):
 *   - 가족 만들기 (monster-family) -> kind 'family' (pick 1 target; leftmost
 *     dracula copied in; +20 × dracula count at scoring).
 *   - 유료 주차 (vehicle-parking) -> kind 'park' (pick up to 2 vehicle cells;
 *     each held next spin + a 30-point fee, scored EVENT-based via symbol_held).
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

describe('select family (가족 만들기) — player picks the dracula copy target', () => {
  const rules: Rule[] = [RULES_BY_ID['monster-family']];

  it('pauses for a single pick when a dracula is present; all non-locked cells selectable', () => {
    const base: SymbolType[] = ['dracula', 'zombie', 'cherry', 'lemon', 'four'];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending?.kind).toBe('family');
    expect(frame.pending?.count).toBe(1);
    expect(frame.pending?.selectable).toEqual([true, true, true, true, true]);
    expect(frame.done).toBe(false);
  });

  it('copies the LEFTMOST dracula into the chosen cell + emits symbol_copied', () => {
    // leftmost dracula is idx2; player picks idx4 -> idx4 becomes dracula.
    const base: SymbolType[] = ['cherry', 'lemon', 'dracula', 'grape', 'four'];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [4]);

    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(['cherry', 'lemon', 'dracula', 'grape', 'dracula']);
    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'dracula', fromIndex: 2, toIndex: 4, byRuleId: 'monster-family' },
    ]);
    expect(frame.steps.at(-1)?.label).toBe('가족 만들기');
  });

  it('AUTO-SKIPS (no pause) when no dracula is on the board', () => {
    const base: SymbolType[] = ['zombie', 'ghost', 'cherry', 'lemon', 'four'];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(base);
    expect(frame.steps.some((s) => s.label.includes('건너뜀'))).toBe(true);
  });

  it('scoreResult adds +20 × dracula count when active (after the copy)', () => {
    const base: SymbolType[] = ['dracula', 'lemon', 'cherry', 'grape', 'four'];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [1]); // 2 draculas after
    const final = [...frame.working];
    const draculas = final.filter((s) => s === 'dracula').length;
    expect(draculas).toBe(2);

    const withRule = scoreResult(final, rules, frame.events, frame.scoreBoards, frame.haunted);
    const without = scoreResult(final, [], frame.events, frame.scoreBoards, frame.haunted);
    expect(withRule.bonusScore - without.bonusScore).toBe(DRACULA_FAMILY_PER * draculas); // 40
  });
});

describe('select park (유료 주차) — player picks up to 2 vehicle cells', () => {
  const rules: Rule[] = [RULES_BY_ID['vehicle-parking']];

  it('count = min(2, #vehicles) and selectableFor restricts to VEHICLE cells', () => {
    // 3 vehicles (idx0 plane, idx2 ship, idx4 car) -> count 2; non-vehicles excluded.
    const base: SymbolType[] = ['plane', 'cherry', 'ship', 'lemon', 'car'];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending?.kind).toBe('park');
    expect(frame.pending?.count).toBe(2);
    expect(frame.pending?.selectable).toEqual([true, false, true, false, true]);
  });

  it('the two chosen cells land in nextHold + emit 2 symbol_held events', () => {
    const base: SymbolType[] = ['plane', 'cherry', 'ship', 'lemon', 'car'];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [2, 4]); // ship + car

    expect(frame.done).toBe(true);
    expect(frame.nextHold).toEqual([2, 4]);
    expect(frame.working).toEqual(base); // no board change
    const held = frame.events.filter((e) => e.type === 'symbol_held');
    expect(held).toEqual([
      { type: 'symbol_held', symbolId: 'ship', index: 2, byRuleId: 'vehicle-parking' },
      { type: 'symbol_held', symbolId: 'car', index: 4, byRuleId: 'vehicle-parking' },
    ]);
  });

  it('scoreResult penalty = 60 (2 × 30) from the symbol_held events', () => {
    const base: SymbolType[] = ['plane', 'cherry', 'ship', 'lemon', 'car'];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [2, 4]);
    const final = [...frame.working];

    const withEvents = scoreResult(final, rules, frame.events, frame.scoreBoards, frame.haunted);
    const without = scoreResult(final, rules, [], frame.scoreBoards, frame.haunted);
    expect(withEvents.penalty - without.penalty).toBe(2 * PARKING_FEE_PER); // 60
  });

  it('AUTO-SKIPS (no pause) when there is no vehicle on the board', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
    expect(frame.nextHold).toEqual([]);
    expect(frame.steps.some((s) => s.label.includes('건너뜀'))).toBe(true);
  });
});
