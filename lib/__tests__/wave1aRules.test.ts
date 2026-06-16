import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { scoreResult, scoreItems } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { GEM_BEAUTY } from '@/data/scoreTable';
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

describe('영역 다툼 (cat-turf) — reroll cats with an adjacent cat', () => {
  it('rerolls the two adjacent cats (idx 0,1) but NOT the lone cat (idx 3)', () => {
    // [cheese_cat, tuxedo_cat, zero, calico_cat, seven]
    // idx0 & idx1 are adjacent cats -> rerolled; idx3 is a lone cat -> untouched.
    const base: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'calico_cat', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-turf']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      // 0.72 -> 'seven' (matches vitamin test); two rerolls consume two draws.
      rng: queuedRng([0.72, 0.72]),
    });

    // lone cat at idx3 and the non-cats are untouched.
    expect(frame.working[2]).toBe('zero');
    expect(frame.working[3]).toBe('calico_cat');
    expect(frame.working[4]).toBe('seven');
    // adjacent cats were rerolled (to seven under this rng).
    expect(frame.working[0]).toBe('seven');
    expect(frame.working[1]).toBe('seven');

    // emitReroll fired for idx 0 and 1 ONLY, carrying the OLD (cat) symbol.
    const rerolls = frame.events.filter(
      (e) => e.type === 'symbol_rerolled' && e.byRuleId === 'cat-turf',
    );
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'cheese_cat', index: 0, byRuleId: 'cat-turf' },
      { type: 'symbol_rerolled', symbolId: 'tuxedo_cat', index: 1, byRuleId: 'cat-turf' },
    ]);

    // the last cascade step records the rerolled indices.
    const step = frame.steps[frame.steps.length - 1];
    expect(step.rerolled).toEqual([0, 1]);
  });

  it('no adjacent cats -> no reroll (lone cats untouched)', () => {
    const base: SymbolType[] = ['cheese_cat', 'zero', 'tuxedo_cat', 'zero', 'calico_cat'];
    const frame = beginCascade(base, [RULES_BY_ID['cat-turf']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.72]),
    });
    expect(frame.working).toEqual(base);
    expect(
      frame.events.filter((e) => e.type === 'symbol_rerolled' && e.byRuleId === 'cat-turf'),
    ).toHaveLength(0);
  });
});

describe('교통사고 (vehicle-crash) — reroll vehicles with an adjacent vehicle', () => {
  it('rerolls the two adjacent vehicles (idx 0,1) but NOT the lone vehicle (idx 3)', () => {
    // [plane, ship, zero, car, seven]
    const base: SymbolType[] = ['plane', 'ship', 'zero', 'car', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-crash']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.72, 0.72]),
    });

    expect(frame.working[2]).toBe('zero');
    expect(frame.working[3]).toBe('car'); // lone vehicle untouched
    expect(frame.working[4]).toBe('seven');
    expect(frame.working[0]).toBe('seven');
    expect(frame.working[1]).toBe('seven');

    const rerolls = frame.events.filter(
      (e) => e.type === 'symbol_rerolled' && e.byRuleId === 'vehicle-crash',
    );
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'plane', index: 0, byRuleId: 'vehicle-crash' },
      { type: 'symbol_rerolled', symbolId: 'ship', index: 1, byRuleId: 'vehicle-crash' },
    ]);

    const step = frame.steps[frame.steps.length - 1];
    expect(step.rerolled).toEqual([0, 1]);
  });

  it('no adjacent vehicles -> no reroll (lone vehicles untouched)', () => {
    const base: SymbolType[] = ['plane', 'zero', 'ship', 'zero', 'car'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-crash']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.72]),
    });
    expect(frame.working).toEqual(base);
    expect(
      frame.events.filter((e) => e.type === 'symbol_rerolled' && e.byRuleId === 'vehicle-crash'),
    ).toHaveLength(0);
  });
});

describe('미의 추구 (gem-beauty) — +100 when a gem is on the board', () => {
  const beauty = RULES_BY_ID['gem-beauty'];

  it('board with a gem + [gem-beauty] adds exactly GEM_BEAUTY (100) to bonusScore', () => {
    const board: SymbolType[] = ['diamond', 'seven', 'zero', 'four', 'cherry'];
    const withRule = scoreResult(board, [beauty]).bonusScore;
    const without = scoreResult(board, []).bonusScore;
    expect(withRule - without).toBe(GEM_BEAUTY); // 100
  });

  it('board with NO gem -> +0 even though the rule is slotted', () => {
    const board: SymbolType[] = ['cherry', 'lemon', 'seven', 'zero', 'four'];
    const withRule = scoreResult(board, [beauty]).bonusScore;
    const without = scoreResult(board, []).bonusScore;
    expect(withRule - without).toBe(0);
  });

  it('pushes a "미의 추구 ×1" ScoreItem when a gem is present', () => {
    const board: SymbolType[] = ['diamond', 'seven', 'zero', 'four', 'cherry'];
    const items = scoreItems(board, [beauty]);
    expect(items).toContainEqual({ label: '미의 추구 ×1', points: GEM_BEAUTY });
  });

  it('no gem -> no ScoreItem', () => {
    const board: SymbolType[] = ['cherry', 'lemon', 'seven', 'zero', 'four'];
    const items = scoreItems(board, [beauty]);
    expect(items.some((it) => it.label.startsWith('미의 추구'))).toBe(false);
  });

  it('copy-above stacks the bonus to ×2 (gem present)', () => {
    // [gem-beauty, copy-above] -> copy-above duplicates the gem-beauty above it.
    const board: SymbolType[] = ['diamond', 'seven', 'zero', 'four', 'cherry'];
    const rules = [beauty, RULES_BY_ID['copy-above']];
    const withStack = scoreResult(board, rules).bonusScore;
    const without = scoreResult(board, []).bonusScore;
    expect(withStack - without).toBe(GEM_BEAUTY * 2); // 200
    const items = scoreItems(board, rules);
    expect(items).toContainEqual({ label: '미의 추구 ×2', points: GEM_BEAUTY * 2 });
  });
});
