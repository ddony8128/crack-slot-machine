import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { beginCascade, resolveSelection } from '@/lib/cascade';
import { computeHand, scoreResult } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { DRACULA_FAMILY_PER } from '@/data/scoreTable';
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

describe('유령들림 영속 — preHaunted carries the status across spins', () => {
  it('a previously-haunted cell stays haunted even with NO haunting rule this spin', () => {
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const frame = beginCascade(base, [null, null, null, null, null], ctxFor(), {
      preHaunted: [true, false, false, true, false],
    });
    expect(frame.haunted).toEqual([true, false, false, true, false]);
  });

  it('흡혈귀 퇴마사 clears a carried-over haunt on a dracula cell (so it stops persisting)', () => {
    // cell 0 was haunted last spin and now holds a dracula → exorcist un-haunts it.
    const base: SymbolType[] = ['dracula', 'seven', 'seven', 'seven', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vampire-exorcist']], ctxFor(), {
      preHaunted: [true, false, false, false, false],
    });
    expect(frame.haunted[0]).toBe(false);
  });

  it('a new haunt (지박령) ADDS to the carried-over set, not replaces it', () => {
    // cell 4 carried haunted; 지박령 haunts the leftmost ghost (cell 1).
    const base: SymbolType[] = ['seven', 'ghost', 'seven', 'seven', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['jibakryeong']], ctxFor(queuedRng([0])), {
      preHaunted: [false, false, false, false, true],
    });
    expect(frame.haunted[4]).toBe(true); // carried over
    expect(frame.haunted[1]).toBe(true); // newly haunted by 지박령
  });
});

describe('monster-haunt — leftmost monster cell becomes haunted (no board change)', () => {
  it('marks the leftmost monster cell haunted; others stay false', () => {
    // monsters at idx2 (zombie) and idx4 (ghost); leftmost is idx2.
    const base: SymbolType[] = ['cherry', 'lemon', 'zombie', 'diamond', 'ghost'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-haunt']], ctxFor());

    expect(frame.haunted).toEqual([false, false, true, false, false]);
    // No board change, no rng consumed. Emits a single cell_status_added for the
    // haunted cell (additive bookkeeping; no symbol-change events).
    expect(frame.working).toEqual(base);
    expect(frame.events).toEqual([
      { type: 'cell_status_added', status: 'haunted', index: 2, byRuleId: 'monster-haunt' },
    ]);
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

describe('monster-family — PLAYER picks the target; leftmost dracula is copied in', () => {
  it('pauses for a single pick; selectable = all non-locked cells', () => {
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'cherry', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-family']], ctxFor());
    expect(frame.pending?.kind).toBe('family');
    expect(frame.pending?.count).toBe(1);
    expect(frame.pending?.selectable).toEqual([true, true, true, true, true]);
    expect(frame.done).toBe(false);
  });

  it('copies the leftmost dracula into the chosen cell + emits symbol_copied', () => {
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'cherry', 'four'];
    const rules = [RULES_BY_ID['monster-family']];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [3]); // player picks idx3

    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(['dracula', 'zombie', 'zero', 'dracula', 'four']);
    const copies = frame.events.filter((e) => e.type === 'symbol_copied');
    expect(copies).toEqual([
      { type: 'symbol_copied', symbolId: 'dracula', fromIndex: 0, toIndex: 3, byRuleId: 'monster-family' },
    ]);
  });

  it('scoreResult adds +20 × dracula count when monster-family is active', () => {
    // After picking idx3 there are 2 draculas on the final board -> +40.
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'cherry', 'four'];
    const rules = [RULES_BY_ID['monster-family']];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [3]);
    const final = [...frame.working];
    const draculas = final.filter((s) => s === 'dracula').length;
    expect(draculas).toBe(2);

    // Isolate the family bonus: with the rule active vs. not (same events/board).
    const withRule = scoreResult(final, rules, frame.events, frame.scoreBoards, frame.haunted);
    const without = scoreResult(final, [], frame.events, frame.scoreBoards, frame.haunted);
    expect(withRule.bonusScore - without.bonusScore).toBe(DRACULA_FAMILY_PER * draculas); // 40
  });

  it('the copy event ALSO yields the +40 monster per-event copy bonus', () => {
    const base: SymbolType[] = ['dracula', 'zombie', 'zero', 'cherry', 'four'];
    const rules = [RULES_BY_ID['monster-family']];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [3]);
    const final = [...frame.working];

    // Per-event 'copied' tag on the monster set, independent of rule activation.
    const without = scoreResult(final, [], [], frame.scoreBoards, frame.haunted);
    const withEvents = scoreResult(final, [], frame.events, frame.scoreBoards, frame.haunted);
    expect(withEvents.bonusScore - without.bonusScore).toBe(40);
  });

  it('AUTO-SKIPS (no pause) when no dracula is on the board', () => {
    const base: SymbolType[] = ['zombie', 'ghost', 'zero', 'cherry', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['monster-family']], ctxFor());
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
    expect(frame.working).toEqual(base);
    expect(frame.events.filter((e) => e.type === 'symbol_copied')).toHaveLength(0);
    expect(frame.steps.some((s) => s.label.includes('건너뜀'))).toBe(true);
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
