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
    expect(done.steps[0].label).toBe(RULES_BY_ID['select-copy'].name);
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
    expect(skip?.label).toBe(`${RULES_BY_ID['select-swap'].name} (건너뜀)`);
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
    expect(done.steps.map((s) => s.label)).toEqual([
      RULES_BY_ID['select-copy'].name,
      RULES_BY_ID['first-cherry'].name,
    ]);
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
    expect(steps[0].label).toBe(`${RULES_BY_ID['select-copy'].name} (건너뜀)`);
  });
});

/**
 * The headline behavior change: rules apply top→bottom and a LATER rule OVERWRITES
 * whatever an earlier rule wrote (pure sequential). The ONLY off-limits cells are
 * pre-roll LOCKED ones. There is no first-claim / "upper wins".
 */
describe('rule interaction (sequential, lower-wins)', () => {
  const ctx = (rng = queuedRng([])) => ({
    previousResult: PREV,
    weights: BASE_WEIGHTS,
    rng,
  });

  it('gem-fish then left-pair: left-pair OVERWRITES cell1 (the motivating case)', () => {
    // cell0 gem (diamond). gem-fish targets leftmost non-gem = cell1 (seven) and
    // rerolls it to a gem (ruby). Then left-pair sets cell1 = cell0 = diamond,
    // OVERWRITING gem-fish's reroll. Under the OLD first-claim model left-pair
    // would have been blocked.
    const base: SymbolType[] = ['diamond', 'seven', 'cherry', 'lemon', 'four'];
    const rules: Rule[] = [RULES_BY_ID['gem-fish'], RULES_BY_ID['left-pair']];
    const { finalResult } = applyRules(base, rules, ctx(queuedRng([rngPoint('ruby')])));
    expect(finalResult[1]).toBe('diamond'); // left-pair wins, copies cell0
  });

  it('left-pair then gem-fish: order reversed, gem-fish may reroll the copied cell', () => {
    // left-pair sets cell1 = cell0 = seven (a non-gem). Now leftmost non-gem is
    // cell0 (seven). gem-fish rerolls cell0 to a gem (ruby). cell1 stays seven.
    const base: SymbolType[] = ['seven', 'diamond', 'ruby', 'sapphire', 'diamond'];
    const rules: Rule[] = [RULES_BY_ID['left-pair'], RULES_BY_ID['gem-fish']];
    const { finalResult } = applyRules(base, rules, ctx(queuedRng([rngPoint('ruby')])));
    expect(finalResult[1]).toBe('seven'); // left-pair copied cell0 (seven)
    expect(finalResult[0]).toBe('ruby'); // gem-fish then rerolled cell0 (leftmost non-gem)
  });

  it('left-pair then center-echo chain: cell1=cell0, then cell3=cell1', () => {
    // left-pair: cell1 = cell0 = cherry. center-echo: cell3 = cell1 = cherry.
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['left-pair'], RULES_BY_ID['center-echo']];
    const { finalResult } = applyRules(base, rules, ctx());
    expect(finalResult).toEqual(['cherry', 'cherry', 'grape', 'cherry', 'ruby']);
  });

  it('red-dye then center-echo: the mirror copies a just-converted cell', () => {
    // red-dye: cell1 (lemon) and cell3 (diamond) -> cherry. center-echo: cell3 =
    // cell1 = cherry (cell1 is now the converted cherry).
    const base: SymbolType[] = ['ruby', 'lemon', 'grape', 'diamond', 'seven'];
    const rules: Rule[] = [RULES_BY_ID['red-dye'], RULES_BY_ID['center-echo']];
    const { finalResult } = applyRules(base, rules, ctx());
    expect(finalResult[1]).toBe('cherry'); // converted by red-dye
    expect(finalResult[3]).toBe('cherry'); // center-echo copied the converted cell1
  });

  it('two transforms on the same cell: the LOWER one wins', () => {
    // first-cherry writes cell0 = cherry. Then left-pair-equivalent? Use two rules
    // that both write cell0: first-cherry, then a copy-above of nothing... instead
    // use first-cherry (cell0=cherry) then select? Simpler: first-cherry then
    // red-dye does NOT touch cherry. Use first-cherry then ... we want two writers
    // of cell0. third-mirror writes cell2; use first-cherry then a manual: red-dye
    // would skip cherry. So pair first-cherry with a later transform on cell0.
    // left-pair writes cell1 (not cell0). The cleanest two-writers-of-cell0:
    // safe-convert (cell0 four -> ruby) THEN first-cherry (cell0 -> cherry).
    const base: SymbolType[] = ['four', 'lemon', 'grape', 'diamond', 'seven'];
    const rules: Rule[] = [RULES_BY_ID['safe-convert'], RULES_BY_ID['first-cherry']];
    const { finalResult } = applyRules(base, rules, ctx());
    expect(finalResult[0]).toBe('cherry'); // first-cherry (lower) overwrites safe-convert's ruby
  });

  it('first-cherry above safe-convert: reverse order -> safe-convert no longer sees a 4', () => {
    // first-cherry: cell0 (four) -> cherry. safe-convert: no 4s left -> no-op.
    const base: SymbolType[] = ['four', 'lemon', 'grape', 'diamond', 'seven'];
    const rules: Rule[] = [RULES_BY_ID['first-cherry'], RULES_BY_ID['safe-convert']];
    const { finalResult } = applyRules(base, rules, ctx());
    expect(finalResult[0]).toBe('cherry');
  });

  it('four-shield then four-parry: shield removes all 4s, parry finds none -> no-op', () => {
    // four-shield rerolls cell0 & cell2 (both four) to grape. four-parry then finds
    // no four -> no-op. Only two draws consumed.
    const base: SymbolType[] = ['four', 'cherry', 'four', 'diamond', 'lemon'];
    const rng = queuedRng([rngPoint('grape'), rngPoint('grape')]);
    const rules: Rule[] = [RULES_BY_ID['four-shield'], RULES_BY_ID['four-parry']];
    const { finalResult } = applyRules(base, rules, ctx(rng));
    expect(finalResult[0]).toBe('grape');
    expect(finalResult[2]).toBe('grape');
    expect(finalResult.includes('four')).toBe(false);
  });

  it('four-parry then four-shield: parry clears the leftmost 4, shield clears the rest', () => {
    // four-parry: cell0 (four) -> lemon. four-shield: remaining fours (cell2) -> grape.
    const base: SymbolType[] = ['four', 'cherry', 'four', 'diamond', 'seven'];
    const rng = queuedRng([rngPoint('lemon'), rngPoint('grape')]);
    const rules: Rule[] = [RULES_BY_ID['four-parry'], RULES_BY_ID['four-shield']];
    const { finalResult } = applyRules(base, rules, ctx(rng));
    expect(finalResult[0]).toBe('lemon'); // parry
    expect(finalResult[2]).toBe('grape'); // shield got the second four
    expect(finalResult.includes('four')).toBe(false);
  });

  it('lock (pre-roll) + transform targeting the locked cell: transform is BLOCKED', () => {
    // center-lock holds cell2 = previous[2] = ruby. third-mirror would set cell2 =
    // cell4, but cell2 is frozen -> blocked.
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const rules: Rule[] = [RULES_BY_ID['center-lock'], RULES_BY_ID['third-mirror']];
    const { finalResult, locked } = applyRules(base, rules, {
      previousResult: ['x', 'x', 'ruby', 'x', 'x'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(finalResult[2]).toBe('ruby'); // frozen, third-mirror could not write it
    expect(locked[2]).toBe(true);
  });

  it('lock (pre-roll) + reroll targeting the locked cell: reroll SKIPS it', () => {
    // last-lock holds cell4 = previous[4] = four. four-shield rerolls all NON-locked
    // fours: cell0 -> lemon, but the locked cell4 (also a four) is skipped.
    const base: SymbolType[] = ['four', 'cherry', 'cherry', 'cherry', 'four'];
    const rules: Rule[] = [RULES_BY_ID['last-lock'], RULES_BY_ID['four-shield']];
    const { finalResult, locked } = applyRules(base, rules, {
      previousResult: ['x', 'x', 'x', 'x', 'four'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([rngPoint('lemon')]),
    });
    expect(finalResult[0]).toBe('lemon'); // rerolled
    expect(finalResult[4]).toBe('four'); // locked, skipped
    expect(locked[4]).toBe(true);
  });

  it('third-mirror after last-lock: cell2 copies the HELD cell4 value', () => {
    // last-lock holds cell4 = previous[4] = sapphire. third-mirror: cell2 = cell4 =
    // sapphire (reading the held value). cell2 itself is NOT locked, so it writes.
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'four'];
    const rules: Rule[] = [RULES_BY_ID['last-lock'], RULES_BY_ID['third-mirror']];
    const { finalResult, locked } = applyRules(base, rules, {
      previousResult: ['x', 'x', 'x', 'x', 'sapphire'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(finalResult[4]).toBe('sapphire'); // held
    expect(finalResult[2]).toBe('sapphire'); // copied the held value
    expect(locked[2]).toBe(false);
  });

  it('first-cherry then left-pair: left-pair copies the just-written cherry', () => {
    // first-cherry: cell0 = cherry. left-pair: cell1 = cell0 = cherry.
    const base: SymbolType[] = ['seven', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['first-cherry'], RULES_BY_ID['left-pair']];
    const { finalResult } = applyRules(base, rules, ctx());
    expect(finalResult[0]).toBe('cherry');
    expect(finalResult[1]).toBe('cherry'); // copied the new cell0
  });

  it('copy-above duplicates a transform under sequential model (left-pair twice = idempotent copy)', () => {
    // left-pair: cell1 = cell0 = cherry. copy-above re-applies left-pair: cell1 =
    // cell0 = cherry again (same result, but it DID overwrite, not skip).
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['left-pair'], RULES_BY_ID['copy-above']];
    const { finalResult, steps } = applyRules(base, rules, ctx());
    expect(finalResult[1]).toBe('cherry');
    expect(steps[1].label).toBe(
      `${RULES_BY_ID['copy-above'].name} → ${RULES_BY_ID['left-pair'].name}`,
    );
  });

  it('copy-above duplicates a reroll, hitting the NOW-leftmost match', () => {
    // gem-fish: leftmost non-gem = cell0 (seven) -> ruby. copy-above re-runs
    // gem-fish: leftmost non-gem is now cell1 (zero) -> sapphire.
    const base: SymbolType[] = ['seven', 'zero', 'diamond', 'ruby', 'sapphire'];
    const rng = queuedRng([rngPoint('ruby'), rngPoint('sapphire')]);
    const rules: Rule[] = [RULES_BY_ID['gem-fish'], RULES_BY_ID['copy-above']];
    const { finalResult } = applyRules(base, rules, ctx(rng));
    expect(finalResult[0]).toBe('ruby'); // first gem-fish
    expect(finalResult[1]).toBe('sapphire'); // copy-above hit the next non-gem
  });

  it('select-copy OVERWRITES a prior transform (locked cells excluded)', () => {
    // first-cherry sets cell0 = cherry, then select-copy lets the player set
    // cell1 = cell0 = cherry, OVERWRITING whatever was there. cell0 stays excluded
    // from copy selection (no left neighbour); nothing is locked.
    const base: SymbolType[] = ['seven', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['first-cherry'], RULES_BY_ID['select-copy']];
    const frame = beginCascade(base, rules, ctxNoRng);
    expect(frame.pending?.kind).toBe('copy');
    expect(frame.working[0]).toBe('cherry'); // first-cherry already applied
    expect(frame.pending?.selectable).toEqual([false, true, true, true, true]);
    const done = resolveSelection(frame, rules, ctxNoRng, [1]);
    expect(done.working[1]).toBe('cherry'); // copied cell0 (cherry), overwriting lemon
  });

  it('select-swap OVERWRITES prior transforms; a locked cell is not selectable', () => {
    // center-lock holds cell2. left-pair sets cell1 = cell0. select-swap then swaps
    // two NON-locked cells the player picks (cell2 excluded).
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [
      RULES_BY_ID['center-lock'],
      RULES_BY_ID['left-pair'],
      RULES_BY_ID['select-swap'],
    ];
    const frame = beginCascade(base, rules, {
      previousResult: ['x', 'x', 'grape', 'x', 'x'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(frame.working[1]).toBe('cherry'); // left-pair applied
    expect(frame.pending?.kind).toBe('swap');
    expect(frame.pending?.selectable[2]).toBe(false); // locked
    const done = resolveSelection(frame, rules, {
      previousResult: ['x', 'x', 'grape', 'x', 'x'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    }, [0, 4]);
    expect(done.working[0]).toBe('ruby'); // swapped from cell4
    expect(done.working[4]).toBe('cherry'); // swapped from cell0
    expect(done.working[2]).toBe('grape'); // locked, untouched
  });

  it('select-reroll OVERWRITES a prior transform on the chosen cell', () => {
    // first-cherry sets cell0 = cherry; select-reroll rerolls cell0 -> seven,
    // overwriting it (cell0 IS selectable for reroll — only locks are excluded).
    const base: SymbolType[] = ['lemon', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['first-cherry'], RULES_BY_ID['select-reroll']];
    const ictx = { previousResult: PREV, weights: BASE_WEIGHTS, rng: queuedRng([rngPoint('seven')]) };
    const frame = beginCascade(base, rules, ictx);
    expect(frame.working[0]).toBe('cherry');
    expect(frame.pending?.selectable[0]).toBe(true); // not locked -> selectable
    const done = resolveSelection(frame, rules, ictx, [0]);
    expect(done.working[0]).toBe('seven'); // rerolled, overwriting the cherry
  });

  it('zero-to-seven then seven-fish-like chain: conversions stack sequentially', () => {
    // zero-to-seven: all zeros -> seven. Then left-pair copies cell0 (now seven)
    // into cell1 -> demonstrates reading a converted value downstream.
    const base: SymbolType[] = ['zero', 'lemon', 'zero', 'diamond', 'zero'];
    const rules: Rule[] = [RULES_BY_ID['zero-to-seven'], RULES_BY_ID['left-pair']];
    const { finalResult } = applyRules(base, rules, ctx());
    expect(finalResult[0]).toBe('seven'); // converted
    expect(finalResult[1]).toBe('seven'); // left-pair copied the converted cell0
    expect(finalResult[2]).toBe('seven');
    expect(finalResult[4]).toBe('seven');
  });
});

describe('regression — rules no longer no-op after another rule touched a cell', () => {
  it("RED DYE converts a cell that FRUIT FISH just rerolled (user's report)", () => {
    // base: cell0 sapphire is the leftmost non-fruit -> fruit-fish rerolls it to a
    // fruit (we feed lemon). Then RED DYE must convert ALL lemons INCLUDING cell0.
    const base: SymbolType[] = ['sapphire', 'lemon', 'ruby', 'grape', 'lemon'];
    const rules: Rule[] = [RULES_BY_ID['fruit-fish'], RULES_BY_ID['red-dye']];
    const ctx = { previousResult: PREV, weights: BASE_WEIGHTS, rng: queuedRng([rngPoint('lemon')]) };
    const { finalResult } = applyRules(base, rules, ctx);
    // cell0 lemon (from fruit-fish) -> cherry; cells 1 and 4 lemon -> cherry too.
    expect(finalResult[0]).toBe('cherry');
    expect(finalResult[1]).toBe('cherry');
    expect(finalResult[4]).toBe('cherry');
  });

  it('CENTER ECHO overwrites a cell a prior rule changed (cell3 = cell1)', () => {
    // safe-convert turns the 4s -> ruby (claims nothing now); center-echo then
    // sets cell3 = cell1 regardless of earlier writes.
    const base: SymbolType[] = ['grape', 'grape', 'four', 'four', 'cherry'];
    const rules: Rule[] = [RULES_BY_ID['safe-convert'], RULES_BY_ID['center-echo']];
    const { finalResult } = applyRules(base, rules, ctxNoRng);
    // safe-convert: cells 2,3 four->ruby; center-echo: cell3 = cell1 = grape.
    expect(finalResult[3]).toBe('grape');
  });
});

describe('COPY ABOVE covers every rule type', () => {
  it('above a SELECT rule → pauses AGAIN for another pick (labeled COPY ABOVE → ...)', () => {
    const base: SymbolType[] = ['lemon', 'grape', 'diamond', 'ruby', 'sapphire'];
    const rules: Rule[] = [RULES_BY_ID['select-copy'], RULES_BY_ID['copy-above']];
    let frame = beginCascade(base, rules, ctxNoRng);
    expect(frame.pending?.kind).toBe('copy');
    frame = resolveSelection(frame, rules, ctxNoRng, [3]); // cell3 = cell2 (diamond)
    expect(frame.done).toBe(false);
    expect(frame.pending?.kind).toBe('copy');
    expect(frame.pending?.ruleName).toBe(
      `${RULES_BY_ID['copy-above'].name} → ${RULES_BY_ID['select-copy'].name}`,
    );
    frame = resolveSelection(frame, rules, ctxNoRng, [4]); // cell4 = cell3 (diamond)
    expect(frame.done).toBe(true);
    expect(frame.working[3]).toBe('diamond');
    expect(frame.working[4]).toBe('diamond');
  });

  it('above FRUIT FREEZE → holds the NEXT 2 fruits (4 held total)', () => {
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const prev: SymbolType[] = ['cherry', 'lemon', 'grape', 'grape', 'ruby'];
    const rules: Rule[] = [RULES_BY_ID['fruit-freeze'], RULES_BY_ID['copy-above']];
    const frame = beginCascade(base, rules, { previousResult: prev, weights: BASE_WEIGHTS, rng: queuedRng([]) });
    expect(frame.locked).toEqual([true, true, true, true, false]);
    expect(frame.working.slice(0, 4)).toEqual(['cherry', 'lemon', 'grape', 'grape']);
  });

  it('above a single-cell lock (center-lock) is idempotent (still locked, no error)', () => {
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const prev: SymbolType[] = ['a', 'a', 'ruby', 'a', 'a'] as SymbolType[];
    const rules: Rule[] = [RULES_BY_ID['center-lock'], RULES_BY_ID['copy-above']];
    const frame = beginCascade(base, rules, { previousResult: prev, weights: BASE_WEIGHTS, rng: queuedRng([]) });
    expect(frame.locked[2]).toBe(true);
    expect(frame.working[2]).toBe('ruby');
  });
});

describe('cascade — step.rerolled (re-spin animation hint)', () => {
  it('FOUR SHIELD: a 4 rerolled into ANOTHER 4 still records rerolled (value unchanged)', () => {
    // The bug: a same-value reroll left the cell out of the diff, so the reveal
    // showed no motion. rerolled must flag the cell regardless of value.
    const base: SymbolType[] = ['four', 'cherry', 'cherry', 'cherry', 'cherry'];
    const ctx = { previousResult: PREV, weights: BASE_WEIGHTS, rng: queuedRng([rngPoint('four')]) };
    const frame = beginCascade(base, [RULES_BY_ID['four-shield']], ctx);
    const step = frame.steps.find((s) => s.label === RULES_BY_ID['four-shield'].name);
    expect(step?.result[0]).toBe('four'); // landed on 4 again — no value change
    expect(step?.rerolled).toEqual([0]); // ...but still flagged as re-spun
  });

  it('FOUR SHIELD: flags every 4 it rerolls, value-change or not', () => {
    const base: SymbolType[] = ['four', 'cherry', 'four', 'cherry', 'cherry'];
    // cell0 -> four (same), cell2 -> seven (changed)
    const ctx = {
      previousResult: PREV,
      weights: BASE_WEIGHTS,
      rng: queuedRng([rngPoint('four'), rngPoint('seven')]),
    };
    const frame = beginCascade(base, [RULES_BY_ID['four-shield']], ctx);
    const step = frame.steps.find((s) => s.label === RULES_BY_ID['four-shield'].name);
    expect(step?.rerolled).toEqual([0, 2]);
    expect(step?.result[0]).toBe('four');
    expect(step?.result[2]).toBe('seven');
  });

  it('SELECT REROLL: records the chosen cell as rerolled even if value repeats', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const rules = [RULES_BY_ID['select-reroll']];
    // Reroll cell 0 (cherry) and land on cherry again.
    const ctx = { previousResult: PREV, weights: BASE_WEIGHTS, rng: queuedRng([rngPoint('cherry')]) };
    let frame = beginCascade(base, rules, ctx);
    frame = resolveSelection(frame, rules, ctx, [0]);
    const step = frame.steps[frame.steps.length - 1];
    expect(step.result[0]).toBe('cherry'); // unchanged value
    expect(step.rerolled).toEqual([0]); // still flagged
  });

  it('transforms carry NO rerolled hint (deterministic; diff is sufficient)', () => {
    const base: SymbolType[] = ['zero', 'cherry', 'cherry', 'cherry', 'cherry'];
    const frame = beginCascade(base, [RULES_BY_ID['zero-to-seven']], ctxNoRng);
    const step = frame.steps.find((s) => s.label === RULES_BY_ID['zero-to-seven'].name);
    expect(step?.result[0]).toBe('seven');
    expect(step?.rerolled).toBeUndefined();
  });
});
