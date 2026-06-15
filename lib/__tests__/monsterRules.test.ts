import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { computeHand, scoreResult } from '@/lib/score';
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

describe('monster-haunt — leftmost monster cell becomes haunted (no board change)', () => {
  it('marks the leftmost monster cell haunted; others stay false', () => {
    // monsters at idx2 (zombie) and idx4 (ghost); leftmost is idx2.
    const base: SymbolType[] = ['cherry', 'lemon', 'zombie', 'diamond', 'ghost'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-haunt']], ctxFor());

    expect(frame.haunted).toEqual([false, false, true, false, false]);
    // No board change, no rng consumed, no events emitted.
    expect(frame.working).toEqual(base);
    expect(frame.events).toHaveLength(0);
  });

  it('no monster on the board -> all haunted flags stay false', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-haunt']], ctxFor());
    expect(frame.haunted).toEqual([false, false, false, false, false]);
    expect(frame.working).toEqual(base);
  });
});

describe('phantom-ghost hand — a haunted cell adds one ghost to the counts', () => {
  it('computeHand without haunted: cherries form a Pair', () => {
    expect(computeHand(['ghost', 'cherry', 'cherry', 'zero', 'four'])).toEqual({
      hand: 'Pair',
      handScore: 10,
    });
  });

  it('one real ghost + one haunted cell elsewhere => 2 ghosts => Pair', () => {
    // [ghost, dracula, zombie, zero, four]: ghost1, dracula1, zombie1 => No Hand.
    const board: SymbolType[] = ['ghost', 'dracula', 'zombie', 'zero', 'four'];
    expect(computeHand(board)).toEqual({ hand: 'No Hand', handScore: 0 });

    // haunt the dracula cell (idx1) -> phantom ghost -> 2 ghosts -> Pair.
    const haunted = [false, true, false, false, false];
    expect(computeHand(board, haunted)).toEqual({ hand: 'Pair', handScore: 10 });
  });

  it('scoreResult reflects the phantom-ghost hand', () => {
    const board: SymbolType[] = ['ghost', 'dracula', 'zombie', 'zero', 'four'];
    const haunted = [false, true, false, false, false];
    const without = scoreResult(board, [], undefined, undefined);
    const withHaunt = scoreResult(board, [], undefined, undefined, haunted);
    expect(without.hand).toBe('No Hand');
    expect(without.handScore).toBe(0);
    expect(withHaunt.hand).toBe('Pair');
    expect(withHaunt.handScore).toBe(10);
  });
});

describe('monster-family — leftmost dracula copies into leftmost non-dracula', () => {
  it('copies dracula into idx1 and emits a symbol_copied event', () => {
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'cherry', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-family']], ctxFor());

    expect(frame.working).toEqual(['dracula', 'dracula', 'zero', 'cherry', 'four']);
    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'dracula', fromIndex: 0, toIndex: 1, byRuleId: 'monster-family' },
    ]);
  });

  it('the copy event yields the +40 monster copy bonus in scoreResult', () => {
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'cherry', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-family']], ctxFor());
    const final = [...frame.working];

    // Bonus driven purely by the per-event 'copied' tag on the monster set.
    const without = scoreResult(final, [], [], frame.scoreBoards, frame.haunted);
    const withEvents = scoreResult(final, [], frame.events, frame.scoreBoards, frame.haunted);
    expect(withEvents.bonusScore - without.bonusScore).toBe(40);
  });

  it('no dracula on the board -> no-op', () => {
    const base: SymbolType[] = ['zombie', 'ghost', 'zero', 'cherry', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-family']], ctxFor());
    expect(frame.working).toEqual(base);
    expect(frame.events.filter((e) => e.type === 'symbol_copied')).toHaveLength(0);
  });
});

describe('integration — monster-haunt then scoring yields the phantom-ghost hand', () => {
  it('haunting the leftmost monster gives a Pair of ghosts at scoring', () => {
    // [ghost, zombie, dracula, zero, four]: leftmost monster is the ghost (idx0).
    // After haunt: phantom ghost -> 2 ghosts -> Pair.
    const base: SymbolType[] = ['ghost', 'zombie', 'dracula', 'zero', 'four'];
    const rules: Rule[] = [RULES_BY_ID['monster-haunt']];
    const frame = beginCascade(base, rules, ctxFor());
    expect(frame.haunted).toEqual([true, false, false, false, false]);

    const final = [...frame.working];
    const score = scoreResult(final, rules, frame.events, frame.scoreBoards, frame.haunted);
    expect(score.hand).toBe('Pair');
    expect(score.handScore).toBe(10);
  });
});
