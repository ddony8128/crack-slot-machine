import { describe, it, expect } from 'vitest';
import type { Rule, SymbolType } from '@/types';
import { applyRules } from '@/lib/applyRules';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import type { Rng } from '@/lib/rng';

// An rng that yields a queued sequence of values.
function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

// Build an rng that, against the full BASE_WEIGHTS, lands inside `target`'s band.
function rngForSymbol(target: SymbolType): Rng {
  const entries = Object.entries(BASE_WEIGHTS) as Array<[SymbolType, number]>;
  const total = entries.reduce((s, [, w]) => s + (w > 0 ? w : 0), 0);
  let acc = 0;
  for (const [sym, w] of entries) {
    if (sym === target) break;
    acc += w;
  }
  const point = (acc + 0.5) / total;
  return () => point;
}

const noCtx = {
  previousResult: ['zero', 'zero', 'zero', 'zero', 'zero'] as SymbolType[],
  weights: BASE_WEIGHTS,
  rng: queuedRng([]),
};

describe('applyRules — transforms', () => {
  it('left-pair: 7 0 🍒 💎 4 => 7 7 🍒 💎 4', () => {
    const base: SymbolType[] = ['seven', 'zero', 'cherry', 'diamond', 'four'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['left-pair']], noCtx);
    expect(finalResult).toEqual(['seven', 'seven', 'cherry', 'diamond', 'four']);
  });

  it('third-first: 🍒 0 🍋 💎 4 => 🍒 0 🍒 💎 4', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'lemon', 'diamond', 'four'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['third-first']], noCtx);
    expect(finalResult).toEqual(['cherry', 'zero', 'cherry', 'diamond', 'four']);
  });

  it('first-cherry: 0 0 0 0 0 => 🍒 0 0 0 0', () => {
    const base: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['first-cherry']], noCtx);
    expect(finalResult).toEqual(['cherry', 'zero', 'zero', 'zero', 'zero']);
  });

  it('zero-to-seven: all zeros become sevens', () => {
    const base: SymbolType[] = ['zero', 'cherry', 'zero', 'four', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['zero-to-seven']], noCtx);
    expect(finalResult).toEqual(['seven', 'cherry', 'seven', 'four', 'seven']);
  });

  it('diamond-to-lemon: all 💎 => 🍋', () => {
    const base: SymbolType[] = ['diamond', 'diamond', 'cherry', 'diamond', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['diamond-to-lemon']], noCtx);
    expect(finalResult).toEqual(['lemon', 'lemon', 'cherry', 'lemon', 'zero']);
  });

  it('grape-to-sapphire: all 🍇 => 🔵', () => {
    const base: SymbolType[] = ['grape', 'cherry', 'grape', 'zero', 'four'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['grape-to-sapphire']], noCtx);
    expect(finalResult).toEqual(['sapphire', 'cherry', 'sapphire', 'zero', 'four']);
  });

  it('red-dye: all 🔴 => 🍒', () => {
    const base: SymbolType[] = ['ruby', 'cherry', 'ruby', 'zero', 'four'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['red-dye']], noCtx);
    expect(finalResult).toEqual(['cherry', 'cherry', 'cherry', 'zero', 'four']);
  });

  it('weight & score rules are skipped (no steps)', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'four', 'diamond', 'zero'];
    const { finalResult, steps } = applyRules(
      base,
      [RULES_BY_ID['fruit-surge'], RULES_BY_ID['bonus-77']],
      noCtx,
    );
    expect(steps).toHaveLength(0);
    expect(finalResult).toEqual(base);
    expect(finalResult).not.toBe(base);
  });
});

describe('applyRules — locks & rerolls', () => {
  it('last-lock carries previousResult cell4', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'four', 'diamond', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['last-lock']], {
      previousResult: ['seven', 'seven', 'ruby', 'seven', 'lemon'],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(finalResult[4]).toBe('lemon');
  });

  it('fourth-lock carries previousResult cell3', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'four', 'diamond', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['fourth-lock']], {
      previousResult: ['x', 'x', 'x', 'grape', 'x'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    expect(finalResult[3]).toBe('grape');
  });

  it('reroll (zero-break) skips a locked cell', () => {
    // last-lock locks cell4 = previous[4] = 'zero'; zero-break must NOT reroll it.
    const base: SymbolType[] = ['zero', 'cherry', 'cherry', 'cherry', 'cherry'];
    const rules: Rule[] = [RULES_BY_ID['last-lock'], RULES_BY_ID['zero-break']];
    const { finalResult } = applyRules(base, rules, {
      previousResult: ['a', 'a', 'a', 'a', 'zero'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'), // any reroll -> lemon
    });
    // cell0 zero -> rerolled to lemon; cell4 locked as zero (not rerolled)
    expect(finalResult[0]).toBe('lemon');
    expect(finalResult[4]).toBe('zero');
  });

  it('number-spin keeps numbers: a 4 becomes a 7 (restricted reroll)', () => {
    const base: SymbolType[] = ['four', 'cherry', 'four', 'diamond', 'lemon'];
    // restricted order is [seven, zero, four]; target 'seven' is first band.
    const { finalResult } = applyRules(base, [RULES_BY_ID['number-spin']], {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng: () => 0.01, // tiny -> first restricted symbol = seven
    });
    expect(finalResult[0]).toBe('seven');
    expect(finalResult[2]).toBe('seven');
    // non-number cells untouched
    expect(finalResult[1]).toBe('cherry');
    expect(finalResult[3]).toBe('diamond');
    expect(finalResult[4]).toBe('lemon');
  });

  it('four-parry rerolls only the leftmost four', () => {
    const base: SymbolType[] = ['cherry', 'four', 'four', 'diamond', 'zero'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['four-parry']], {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'),
    });
    expect(finalResult[1]).toBe('lemon');
    expect(finalResult[2]).toBe('four'); // second four untouched
  });

  it('unique-second loops until cell1 is unique', () => {
    // base cell1 = cherry, which duplicates cell0. Feed a duplicate (cherry) then a unique (sapphire).
    const base: SymbolType[] = ['cherry', 'cherry', 'lemon', 'grape', 'diamond'];
    const rng = queuedRng([
      rngPoint('cherry'), // still duplicate -> loop again
      rngPoint('sapphire'), // unique now
    ]);
    const { finalResult } = applyRules(base, [RULES_BY_ID['unique-second']], {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng,
    });
    expect(finalResult[1]).toBe('sapphire');
  });
});

// helper: a single rng draw value landing in `target` band of BASE_WEIGHTS
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

describe('applyRules — copy-above', () => {
  it('copy-above of four-shield is a no-op (cells already claimed by first pass)', () => {
    // Upper-wins/first-claim: four-shield rerolls both fours and CLAIMS those cells.
    // copy-above re-runs four-shield but the cells are claimed -> no second reroll.
    const base: SymbolType[] = ['four', 'cherry', 'four', 'diamond', 'lemon'];
    const rng = queuedRng([rngPoint('grape'), rngPoint('grape')]); // first pass only
    const rules: Rule[] = [RULES_BY_ID['four-shield'], RULES_BY_ID['copy-above']];
    const { finalResult, steps } = applyRules(base, rules, {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng,
    });
    expect(steps).toHaveLength(2);
    expect(steps[1].label).toBe('COPY ABOVE → FOUR SHIELD');
    expect(finalResult[0]).toBe('grape');
    expect(finalResult[2]).toBe('grape');
    // exactly two draws were consumed (no second pass) — value is stable
  });

  it('copy-above of four-parry extends to the NEXT leftmost four', () => {
    // four-parry claims only the leftmost four; copy-above re-runs it on the next one.
    const base: SymbolType[] = ['cherry', 'four', 'four', 'diamond', 'zero'];
    const rng = queuedRng([rngPoint('lemon'), rngPoint('grape')]);
    const rules: Rule[] = [RULES_BY_ID['four-parry'], RULES_BY_ID['copy-above']];
    const { finalResult } = applyRules(base, rules, {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng,
    });
    expect(finalResult[1]).toBe('lemon'); // first four-parry
    expect(finalResult[2]).toBe('grape'); // copy-above hits the next four
  });

  it('copy-above with left-pair above is a no-op second application', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'lemon', 'diamond', 'four'];
    const rules: Rule[] = [RULES_BY_ID['left-pair'], RULES_BY_ID['copy-above']];
    const { finalResult, steps } = applyRules(base, rules, noCtx);
    // left-pair: cell1 = cell0 = cherry; copy-above re-applies => same
    expect(finalResult).toEqual(['cherry', 'cherry', 'lemon', 'diamond', 'four']);
    expect(steps[1].label).toBe('COPY ABOVE → LEFT PAIR');
  });

  it('copy-above with nothing above is a no-op', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'lemon', 'diamond', 'four'];
    const { finalResult, steps } = applyRules(base, [RULES_BY_ID['copy-above']], noCtx);
    expect(finalResult).toEqual(base);
    expect(steps[0].label).toBe('COPY ABOVE → (none)');
  });

  it('copy-above with a weight rule above is a no-op', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'lemon', 'diamond', 'four'];
    const rules: Rule[] = [RULES_BY_ID['fruit-surge'], RULES_BY_ID['copy-above']];
    const { finalResult, steps } = applyRules(base, rules, noCtx);
    expect(finalResult).toEqual(base);
    // weight rule produced no step; copy-above is the only step.
    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe('COPY ABOVE → (none)');
  });
});

describe('applyRules — upper-wins ordering (lock must be ABOVE to win)', () => {
  it('lock ABOVE reroll: lock wins and the cell is reported locked', () => {
    // center-lock (slot0) freezes cell2; zero-break (slot1) cannot touch it.
    const base: SymbolType[] = ['zero', 'cherry', 'zero', 'cherry', 'cherry'];
    const rules: Rule[] = [RULES_BY_ID['center-lock'], RULES_BY_ID['zero-break']];
    const { finalResult, locked, steps } = applyRules(base, rules, {
      previousResult: ['a', 'a', 'zero', 'a', 'a'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'),
    });
    expect(finalResult[2]).toBe('zero'); // locked, not rerolled
    expect(finalResult[0]).toBe('lemon'); // other zero still rerolled
    expect(locked[2]).toBe(true);
    // per-step locked snapshot is present for the reveal
    expect(steps[0].locked[2]).toBe(true);
  });

  it('reroll ABOVE lock: reroll wins, the lock FAILS (cell not locked)', () => {
    // four-shield (slot0) rerolls + claims cell of the four; last-lock (slot1) is below
    // and finds the cell already claimed -> it cannot freeze it.
    const base: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'four'];
    const rules: Rule[] = [RULES_BY_ID['four-shield'], RULES_BY_ID['last-lock']];
    const { finalResult, locked } = applyRules(base, rules, {
      previousResult: ['a', 'a', 'a', 'a', 'ruby'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'),
    });
    expect(finalResult[4]).toBe('lemon'); // reroll won (lock was below)
    expect(locked[4]).toBe(false); // lock did not take effect
  });
});
