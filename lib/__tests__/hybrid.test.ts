import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { scoreResult } from '@/lib/score';
import { symbolInSet } from '@/lib/symbols/tags';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
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
const ctxFor = (rng: Rng = queuedRng([])) => ({
  previousResult: PREV_ZEROS,
  weights: BASE_WEIGHTS,
  rng,
});

const CAT = SYMBOL_SETS_BY_ID['cat'];
const MONSTER = SYMBOL_SETS_BY_ID['monster'];
const FRUIT = SYMBOL_SETS_BY_ID['fruit'];

describe('symbolInSet — hybrids belong to multiple sets, base symbols to one', () => {
  it('zombie_cat is a member of BOTH the cat and the monster sets', () => {
    expect(symbolInSet('zombie_cat', CAT)).toBe(true);
    expect(symbolInSet('zombie_cat', MONSTER)).toBe(true);
    // but not of an unrelated set.
    expect(symbolInSet('zombie_cat', FRUIT)).toBe(false);
  });

  it('cheese_cat (base) is only in the cat set', () => {
    expect(symbolInSet('cheese_cat', CAT)).toBe(true);
    expect(symbolInSet('cheese_cat', MONSTER)).toBe(false);
  });

  it('dracula (base) is only in the monster set', () => {
    expect(symbolInSet('dracula', MONSTER)).toBe(true);
    expect(symbolInSet('dracula', CAT)).toBe(false);
  });

  it('ghost_cat is a member of BOTH the cat and the monster sets', () => {
    expect(symbolInSet('ghost_cat', CAT)).toBe(true);
    expect(symbolInSet('ghost_cat', MONSTER)).toBe(true);
    expect(symbolInSet('ghost_cat', FRUIT)).toBe(false);
  });
});

describe('scoring — a hybrid counts toward multiple sets', () => {
  it('one zombie_cat gives the cat per-symbol +30', () => {
    // Board with one zombie_cat + filler numbers (no other set members).
    const board: SymbolType[] = ['zombie_cat', 'zero', 'seven', 'four', 'zero'];
    const without: SymbolType[] = ['lemon', 'zero', 'seven', 'four', 'zero'];
    const withCat = scoreResult(board, []).bonusScore;
    const baseline = scoreResult(without, []).bonusScore;
    // The only difference is the zombie_cat -> +30 cat per-symbol.
    expect(withCat - baseline).toBe(30);
  });

  it('one ghost_cat gives the cat per-symbol +30', () => {
    const board: SymbolType[] = ['ghost_cat', 'zero', 'seven', 'four', 'zero'];
    const without: SymbolType[] = ['lemon', 'zero', 'seven', 'four', 'zero'];
    const withCat = scoreResult(board, []).bonusScore;
    const baseline = scoreResult(without, []).bonusScore;
    expect(withCat - baseline).toBe(30);
  });

  it('a symbol_copied event of ghost_cat gives the monster copied +40 (per-event)', () => {
    const board: SymbolType[] = ['ghost_cat', 'zero', 'seven', 'four', 'zero'];
    const events = [
      { type: 'symbol_copied', symbolId: 'ghost_cat', fromIndex: 0, toIndex: 1, byRuleId: 'x' } as const,
    ];
    const without = scoreResult(board, [], []).bonusScore;
    const withCopy = scoreResult(board, [], events).bonusScore;
    expect(withCopy - without).toBe(40);
  });

  it('a symbol_copied event of zombie_cat gives the monster copied +40 (per-event)', () => {
    const board: SymbolType[] = ['zombie_cat', 'zero', 'seven', 'four', 'zero'];
    const events = [
      { type: 'symbol_copied', symbolId: 'zombie_cat', fromIndex: 0, toIndex: 1, byRuleId: 'x' } as const,
    ];
    const without = scoreResult(board, [], []).bonusScore;
    const withCopy = scoreResult(board, [], events).bonusScore;
    expect(withCopy - without).toBe(40);
  });

  it('zombie_cat + 2 base cats does NOT complete cat 3종 unless all 3 base cat types present', () => {
    // zombie_cat + cheese_cat + tuxedo_cat: only 2 of 3 BASE cat types present.
    // No 3종 (200) because calico_cat is missing — all-types keys off base symbols.
    // Three cat members on board (zombie_cat + 2 base) -> per-symbol 3 * 30 = 90,
    // plus an adjacent cluster (idx 0,1,2 are all cat members) -> 3 * -60 = -180.
    const board: SymbolType[] = ['zombie_cat', 'cheese_cat', 'tuxedo_cat', 'zero', 'seven'];
    expect(scoreResult(board, []).bonusScore).toBe(90 - 180);

    // Now include all 3 base cat types -> 3종 (200) DOES fire.
    // per-symbol 3*30=90, adjacent 3*-60=-180, all-types +200 -> 110.
    const complete: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'calico_cat', 'zero', 'seven'];
    expect(scoreResult(complete, []).bonusScore).toBe(90 - 180 + 200);
  });
});

describe('monster-infect — leftmost cat becomes zombie_cat when a monster is present', () => {
  it("['cheese_cat','dracula','zero','seven','four'] -> idx0 becomes zombie_cat + transform event", () => {
    const base: SymbolType[] = ['cheese_cat', 'dracula', 'zero', 'seven', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-infect']], ctxFor());
    expect(frame.working).toEqual(['zombie_cat', 'dracula', 'zero', 'seven', 'four']);
    const transforms = frame.events.filter((e) => e.type === 'symbol_transformed');
    expect(transforms).toEqual([
      {
        type: 'symbol_transformed',
        fromSymbolId: 'cheese_cat',
        toSymbolId: 'zombie_cat',
        index: 0,
        byRuleId: 'monster-infect',
      },
    ]);
  });

  it('no monster on the board -> unchanged', () => {
    const base: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'seven', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-infect']], ctxFor());
    expect(frame.working).toEqual(base);
    expect(frame.events).toHaveLength(0);
  });

  it('monster but no cat -> unchanged', () => {
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'seven', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-infect']], ctxFor());
    expect(frame.working).toEqual(base);
    expect(frame.events).toHaveLength(0);
  });

  it('targets the LEFTMOST base cat among several', () => {
    const base: SymbolType[] = ['zero', 'cheese_cat', 'tuxedo_cat', 'ghost', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-infect']], ctxFor());
    expect(frame.working).toEqual(['zero', 'zombie_cat', 'tuxedo_cat', 'ghost', 'four']);
  });
});

describe('integration — an infected zombie_cat scores as a cat', () => {
  it('after monster-infect, scoreResult counts the new zombie_cat (cat per-symbol)', () => {
    // cheese_cat + dracula -> infect makes idx0 a zombie_cat.
    const base: SymbolType[] = ['cheese_cat', 'dracula', 'zero', 'seven', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-infect']], ctxFor());
    const final = [...frame.working];
    expect(final[0]).toBe('zombie_cat');

    // The board has one cat member (the zombie_cat) -> cat per-symbol +30.
    // Compare against a baseline board where idx0 is a plain non-cat symbol.
    const baseline: SymbolType[] = ['lemon', 'dracula', 'zero', 'seven', 'four'];
    const withCat = scoreResult(final, []).bonusScore;
    const noCat = scoreResult(baseline, []).bonusScore;
    expect(withCat - noCat).toBe(30);
  });
});
