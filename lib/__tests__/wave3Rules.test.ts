import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade, advanceCascade } from '@/lib/cascade';
import { scoreResult } from '@/lib/score';
import { comboRulesForSets } from '@/lib/rules/combos';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { EXORCIST_PER } from '@/data/scoreTable';
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
const ctxFor = (rng: Rng = queuedRng([])) => ({
  previousResult: PREV_ZEROS,
  weights: BASE_WEIGHTS,
  rng,
});

describe('흡혈귀 퇴마사 (vampire-exorcist)', () => {
  it('un-haunts a haunted dracula cell + emits cell_status_removed + scores +200', () => {
    // monster-haunt haunts the leftmost monster (the dracula at idx 0), THEN
    // vampire-exorcist clears that haunted dracula.
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'seven', 'four'];
    const frame = beginCascade(
      base,
      [RULES_BY_ID['monster-haunt'], RULES_BY_ID['vampire-exorcist']],
      ctxFor(),
    );
    expect(frame.haunted).toEqual([false, false, false, false, false]);
    expect(frame.working).toEqual(base); // no board change

    const added = frame.events.filter(
      (e) => e.type === 'cell_status_added' && e.byRuleId === 'monster-haunt',
    );
    const removed = frame.events.filter(
      (e) => e.type === 'cell_status_removed' && e.byRuleId === 'vampire-exorcist',
    );
    expect(added).toHaveLength(1);
    expect(removed).toEqual([
      { type: 'cell_status_removed', status: 'haunted', index: 0, byRuleId: 'vampire-exorcist' },
    ]);

    // EVENT-based: scoreResult gains +EXORCIST_PER from the removal event.
    const withExorcist = scoreResult(frame.working, [], frame.events).bonusScore;
    const without = scoreResult(frame.working, [], []).bonusScore;
    expect(withExorcist - without).toBe(EXORCIST_PER);
  });

  it('leaves a haunted NON-dracula cell haunted (no removal)', () => {
    // jibakryeong haunts the leftmost ghost cell (idx 0) and rerolls it into a
    // lemon (rng 0 -> first weighted symbol is a fruit, but value irrelevant).
    const base: SymbolType[] = ['ghost', 'zombie', 'zero', 'seven', 'four'];
    const frame = beginCascade(
      base,
      [RULES_BY_ID['jibakryeong'], RULES_BY_ID['vampire-exorcist']],
      ctxFor(queuedRng([0])),
    );
    // idx 0 is haunted but NOT a dracula -> exorcist does nothing.
    expect(frame.haunted[0]).toBe(true);
    const removed = frame.events.filter((e) => e.type === 'cell_status_removed');
    expect(removed).toHaveLength(0);
  });
});

describe('망령의 집착 (gem-obsession)', () => {
  it('haunts the leftmost gem cell + emits cell_status_added', () => {
    const base: SymbolType[] = ['zero', 'ruby', 'diamond', 'seven', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['gem-obsession']], ctxFor());
    expect(frame.haunted).toEqual([false, true, false, false, false]);
    expect(frame.working).toEqual(base); // no board change
    const added = frame.events.filter(
      (e) => e.type === 'cell_status_added' && e.byRuleId === 'gem-obsession',
    );
    expect(added).toEqual([
      { type: 'cell_status_added', status: 'haunted', index: 1, byRuleId: 'gem-obsession' },
    ]);
  });

  it('no gem on the board -> no haunt, no event', () => {
    const base: SymbolType[] = ['zero', 'seven', 'four', 'zero', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['gem-obsession']], ctxFor());
    expect(frame.haunted).toEqual([false, false, false, false, false]);
    expect(frame.events).toHaveLength(0);
  });
});

describe('좀비 고양이 (combo-zombie-cat)', () => {
  it('cell 0 becomes zombie_cat + transform event', () => {
    const base: SymbolType[] = ['lemon', 'dracula', 'cheese_cat', 'seven', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['combo-zombie-cat']], ctxFor());
    expect(frame.working).toEqual(['zombie_cat', 'dracula', 'cheese_cat', 'seven', 'four']);
    const transforms = frame.events.filter((e) => e.type === 'symbol_transformed');
    expect(transforms).toEqual([
      {
        type: 'symbol_transformed',
        fromSymbolId: 'lemon',
        toSymbolId: 'zombie_cat',
        index: 0,
        byRuleId: 'combo-zombie-cat',
      },
    ]);
  });
});

describe('유령 고양이 (combo-ghost-cat)', () => {
  // No public rule haunts a base CAT cell directly, so seed the haunted state on
  // a finished frame and re-advance through combo-ghost-cat alone. Resetting
  // slotIndex/done lets advanceCascade run the single appended rule.
  function runGhostCat(board: SymbolType[], haunt: number[]) {
    const rules = [RULES_BY_ID['combo-ghost-cat']];
    const frame = beginCascade([...board], [], ctxFor());
    for (const i of haunt) frame.haunted[i] = true;
    frame.slotIndex = 0;
    frame.done = false;
    return advanceCascade(frame, rules, ctxFor());
  }

  it('a haunted cat cell becomes ghost_cat and is un-haunted (transform + cell_status_removed)', () => {
    const board: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'seven', 'four'];
    const frame = runGhostCat(board, [0]);
    expect(frame.working[0]).toBe('ghost_cat');
    expect(frame.haunted[0]).toBe(false);
    const transforms = frame.events.filter((e) => e.type === 'symbol_transformed');
    expect(transforms).toEqual([
      {
        type: 'symbol_transformed',
        fromSymbolId: 'cheese_cat',
        toSymbolId: 'ghost_cat',
        index: 0,
        byRuleId: 'combo-ghost-cat',
      },
    ]);
    const removed = frame.events.filter(
      (e) => e.type === 'cell_status_removed' && e.byRuleId === 'combo-ghost-cat',
    );
    expect(removed).toEqual([
      { type: 'cell_status_removed', status: 'haunted', index: 0, byRuleId: 'combo-ghost-cat' },
    ]);
  });

  it('a haunted NON-cat cell is left untouched', () => {
    // idx 1 (the ghost) is haunted but is not a CAT -> unchanged, still haunted.
    const board: SymbolType[] = ['cheese_cat', 'ghost', 'zero', 'seven', 'four'];
    const frame = runGhostCat(board, [1]);
    expect(frame.working[1]).toBe('ghost');
    expect(frame.haunted[1]).toBe(true);
    expect(frame.events.filter((e) => e.type === 'symbol_transformed')).toHaveLength(0);
  });
});

describe('combo registry membership', () => {
  it("comboRulesForSets(['monster','gem']) includes gem-obsession", () => {
    expect(comboRulesForSets(['monster', 'gem'])).toContain('gem-obsession');
  });

  it("comboRulesForSets(['monster','cat']) includes both combo-zombie-cat and combo-ghost-cat", () => {
    const out = comboRulesForSets(['monster', 'cat']);
    expect(out).toContain('combo-zombie-cat');
    expect(out).toContain('combo-ghost-cat');
  });
});
