import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { applyRules } from '@/lib/applyRules';
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

describe('cascade — select rules (resumable, interactive)', () => {
  it('select-copy: chosen cell becomes its left neighbor', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const frame = beginCascade(base, [RULES_BY_ID['select-copy']], ctxNoRng);
    // Pauses for input: copy needs index >= 1 unclaimed.
    expect(frame.pending).not.toBeNull();
    expect(frame.pending?.kind).toBe('copy');
    // index 0 is NOT selectable for copy.
    expect(frame.pending?.selectable[0]).toBe(false);
    expect(frame.pending?.selectable[3]).toBe(true);

    // Pick cell 3 -> becomes cell 2 (grape).
    const done = resolveSelection(frame, [RULES_BY_ID['select-copy']], ctxNoRng, [3]);
    expect(done.done).toBe(true);
    expect(done.working[3]).toBe('grape');
    expect(done.interactive).toBe(true);
    expect(done.steps).toHaveLength(1);
    expect(done.steps[0].label).toBe('SELECT COPY');
  });

  it('select-swap: the two chosen cells swap symbols', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const frame = beginCascade(base, [RULES_BY_ID['select-swap']], ctxNoRng);
    expect(frame.pending?.kind).toBe('swap');

    const done = resolveSelection(frame, [RULES_BY_ID['select-swap']], ctxNoRng, [0, 4]);
    expect(done.done).toBe(true);
    expect(done.working[0]).toBe('ruby');
    expect(done.working[4]).toBe('cherry');
    expect(done.working[2]).toBe('grape'); // untouched
  });

  it('select-reroll: the chosen cell is rerolled via the stubbed rng', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const ctx = { previousResult: PREV, weights: BASE_WEIGHTS, rng: queuedRng([rngPoint('seven')]) };
    const frame = beginCascade(base, [RULES_BY_ID['select-reroll']], ctx);
    expect(frame.pending?.kind).toBe('reroll');

    const done = resolveSelection(frame, [RULES_BY_ID['select-reroll']], ctx, [1]);
    expect(done.done).toBe(true);
    expect(done.working[1]).toBe('seven');
  });

  it('select rules act on any NON-LOCKED cell — earlier auto-claims do not disable cells', () => {
    // left-pair claims cell1 (auto, not locked); the select-copy must still treat
    // cell1 as selectable. Only LOCKED cells are excluded (plus index0 for copy).
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['left-pair'], RULES_BY_ID['select-copy']];
    const frame = beginCascade(base, rules, ctxNoRng);
    expect(frame.pending?.kind).toBe('copy');
    // cell0 excluded (copy needs a left neighbour); cells 1..4 selectable (none locked).
    expect(frame.pending?.selectable).toEqual([false, true, true, true, true]);
  });

  it('a LOCKED cell is excluded from selection (last-lock freezes cell4)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['last-lock'], RULES_BY_ID['select-swap']];
    const frame = beginCascade(base, rules, {
      previousResult: ['a', 'a', 'a', 'a', 'sapphire'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.pending?.kind).toBe('swap');
    expect(frame.pending?.selectable[4]).toBe(false); // cell4 locked
    expect(frame.pending?.selectable.filter(Boolean).length).toBe(4);
  });

  it('select-swap AUTO-SKIPS only when fewer than two NON-LOCKED cells remain', () => {
    // fruit-freeze holds the 2 leftmost fruits (cells 0,1), center-lock holds 2,
    // last-lock holds 4 -> only cell3 is free -> swap needs >= 2 -> auto-skip.
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const rules: Rule[] = [
      RULES_BY_ID['fruit-freeze'], // pre-roll: hold leftmost 2 fruits of prev (0,1)
      RULES_BY_ID['center-lock'],  // hold cell2
      RULES_BY_ID['last-lock'],    // hold cell4
      RULES_BY_ID['select-swap'],  // only cell3 free -> auto-skip
    ];
    const frame = beginCascade(base, rules, {
      previousResult: ['cherry', 'lemon', 'grape', 'diamond', 'ruby'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.done).toBe(true);
    expect(frame.pending).toBeNull();
    const skip = frame.steps.find((s) => s.label.includes('건너뜀'));
    expect(skip?.label).toBe('SELECT SWAP (건너뜀)');
  });

  it('resumes the rest of the cascade after a select rule resolves', () => {
    // select-copy (pauses) then first-cherry runs after resolution.
    const base: SymbolType[] = ['lemon', 'grape', 'diamond', 'ruby', 'sapphire'];
    const rules: Rule[] = [RULES_BY_ID['select-copy'], RULES_BY_ID['first-cherry']];
    const frame = beginCascade(base, rules, ctxNoRng);
    expect(frame.pending?.kind).toBe('copy');
    expect(frame.done).toBe(false);

    // pick cell2 -> becomes cell1 (grape), then first-cherry writes cell0.
    const done = resolveSelection(frame, rules, ctxNoRng, [2]);
    expect(done.done).toBe(true);
    expect(done.working[2]).toBe('grape');
    expect(done.working[0]).toBe('cherry');
    expect(done.steps.map((s) => s.label)).toEqual(['SELECT COPY', 'FIRST CHERRY']);
  });

  it('two select rules pause in sequence', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['select-reroll'], RULES_BY_ID['select-swap']];
    const ctx = {
      previousResult: PREV,
      weights: BASE_WEIGHTS,
      rng: queuedRng([rngPoint('seven')]),
    };
    let frame = beginCascade(base, rules, ctx);
    expect(frame.pending?.kind).toBe('reroll');

    frame = resolveSelection(frame, rules, ctx, [0]);
    expect(frame.working[0]).toBe('seven');
    expect(frame.done).toBe(false);
    expect(frame.pending?.kind).toBe('swap');
    // cell0 was rerolled (claimed, NOT locked) -> still selectable for the swap.
    expect(frame.pending?.selectable[0]).toBe(true);

    frame = resolveSelection(frame, rules, ctx, [1, 2]);
    expect(frame.done).toBe(true);
    expect(frame.working[1]).toBe('grape');
    expect(frame.working[2]).toBe('lemon');
  });
});

describe('applyRules — select rules AUTO-SKIP (pure path)', () => {
  it('select rules never pause and push a "(건너뜀)" step', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const { finalResult, steps } = applyRules(base, [RULES_BY_ID['select-copy']], ctxNoRng);
    // board unchanged; step labeled as skipped.
    expect(finalResult).toEqual(base);
    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe('SELECT COPY (건너뜀)');
  });
});
