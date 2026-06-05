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

  it('third-mirror: 🍒 0 🍋 💎 4 => cell2 = cell4 => 🍒 0 4 💎 4', () => {
    const base: SymbolType[] = ['cherry', 'zero', 'lemon', 'diamond', 'four'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['third-mirror']], noCtx);
    expect(finalResult).toEqual(['cherry', 'zero', 'four', 'diamond', 'four']);
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

  it('blue-dye: all 💎 => 🔵', () => {
    const base: SymbolType[] = ['diamond', 'cherry', 'diamond', 'zero', 'four'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['blue-dye']], noCtx);
    expect(finalResult).toEqual(['sapphire', 'cherry', 'sapphire', 'zero', 'four']);
  });

  it('safe-convert: leftmost 4 => 🔴 (ruby), only one', () => {
    const base: SymbolType[] = ['cherry', 'four', 'zero', 'four', 'lemon'];
    const { finalResult } = applyRules(base, [RULES_BY_ID['safe-convert']], noCtx);
    expect(finalResult).toEqual(['cherry', 'ruby', 'zero', 'four', 'lemon']);
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

  it('reroll (four-shield) skips a locked cell', () => {
    // last-lock locks cell4 = previous[4] = 'four'; four-shield must NOT reroll it.
    const base: SymbolType[] = ['four', 'cherry', 'cherry', 'cherry', 'cherry'];
    const rules: Rule[] = [RULES_BY_ID['last-lock'], RULES_BY_ID['four-shield']];
    const { finalResult } = applyRules(base, rules, {
      previousResult: ['a', 'a', 'a', 'a', 'four'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'), // any reroll -> lemon
    });
    // cell0 four -> rerolled to lemon; cell4 locked as four (not rerolled)
    expect(finalResult[0]).toBe('lemon');
    expect(finalResult[4]).toBe('four');
  });

  it('gem-fish targets the leftmost non-gem cell (loops until a gem)', () => {
    // cell0 is a gem -> skipped; cell1 (seven) is the leftmost non-gem -> target.
    // Feed a non-gem (lemon) first to force another iteration, then a gem (ruby).
    const base: SymbolType[] = ['diamond', 'seven', 'cherry', 'ruby', 'zero'];
    const rng = queuedRng([rngPoint('lemon'), rngPoint('ruby')]);
    const { finalResult } = applyRules(base, [RULES_BY_ID['gem-fish']], {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng,
    });
    expect(finalResult[0]).toBe('diamond');
    expect(finalResult[1]).toBe('ruby'); // looped past lemon, landed on a gem
    expect(finalResult[2]).toBe('cherry'); // later non-gems untouched
  });

  it('fruit-fish loops until the target cell becomes a fruit', () => {
    // cell0 (seven) is the leftmost non-fruit. Feed a non-fruit (ruby) then a fruit (grape).
    const base: SymbolType[] = ['seven', 'cherry', 'lemon', 'grape', 'zero'];
    const rng = queuedRng([rngPoint('ruby'), rngPoint('grape')]);
    const { finalResult } = applyRules(base, [RULES_BY_ID['fruit-fish']], {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng,
    });
    expect(finalResult[0]).toBe('grape'); // looped past ruby, landed on a fruit
  });

  it('gem-shuffle loops until the target gem cell becomes a non-gem', () => {
    // cell0 (ruby) is the leftmost gem. Feed a gem (sapphire) then a non-gem (lemon).
    const base: SymbolType[] = ['ruby', 'cherry', 'seven', 'lemon', 'zero'];
    const rng = queuedRng([rngPoint('sapphire'), rngPoint('lemon')]);
    const { finalResult } = applyRules(base, [RULES_BY_ID['gem-shuffle']], {
      previousResult: noCtx.previousResult,
      weights: BASE_WEIGHTS,
      rng,
    });
    expect(finalResult[0]).toBe('lemon'); // looped past sapphire, landed on a non-gem
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

  it('copy-above above a weight rule changes no cells but is labeled with the copied rule', () => {
    // The weight duplication happens in computeWeights, not on the board, so the
    // board is unchanged — but the step is labeled with the copied rule's name.
    const base: SymbolType[] = ['cherry', 'zero', 'lemon', 'diamond', 'four'];
    const rules: Rule[] = [RULES_BY_ID['fruit-surge'], RULES_BY_ID['copy-above']];
    const { finalResult, steps } = applyRules(base, rules, noCtx);
    expect(finalResult).toEqual(base);
    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe('COPY ABOVE → FRUIT SURGE');
  });
});

describe('applyRules — pre-roll HOLD (locks are absolute, order-independent)', () => {
  it('lock ABOVE reroll: lock wins and the cell is reported locked', () => {
    // center-lock (slot0) holds cell2 pre-roll; four-shield (slot1) cannot touch it.
    const base: SymbolType[] = ['four', 'cherry', 'four', 'cherry', 'cherry'];
    const rules: Rule[] = [RULES_BY_ID['center-lock'], RULES_BY_ID['four-shield']];
    const { finalResult, locked, steps } = applyRules(base, rules, {
      previousResult: ['a', 'a', 'four', 'a', 'a'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'),
    });
    expect(finalResult[2]).toBe('four'); // held, not rerolled
    expect(finalResult[0]).toBe('lemon'); // other four still rerolled
    expect(locked[2]).toBe(true);
    // locks push no steps; only four-shield does
    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe('FOUR SHIELD');
    // per-step locked snapshot still reflects the held cell for the reveal
    expect(steps[0].locked[2]).toBe(true);
  });

  it('reroll ABOVE lock: the lock STILL wins (pre-roll hold is absolute)', () => {
    // four-shield (slot0) is ABOVE last-lock (slot1). Under pre-roll HOLD the lock
    // is resolved before the cascade, so cell4 is held no matter the order.
    const base: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'four'];
    const rules: Rule[] = [RULES_BY_ID['four-shield'], RULES_BY_ID['last-lock']];
    const { finalResult, locked } = applyRules(base, rules, {
      previousResult: ['a', 'a', 'a', 'a', 'ruby'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: rngForSymbol('lemon'),
    });
    expect(finalResult[4]).toBe('ruby'); // held at previous value, NOT rerolled
    expect(locked[4]).toBe(true); // lock took effect regardless of position
  });

  it('returns baseResult with held cells = previousResult, others = rolled base', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'four'];
    const rules: Rule[] = [RULES_BY_ID['center-lock'], RULES_BY_ID['last-lock']];
    const { baseResult } = applyRules(base, rules, {
      previousResult: ['seven', 'seven', 'ruby', 'seven', 'sapphire'] as SymbolType[],
      weights: BASE_WEIGHTS,
      rng: queuedRng([]),
    });
    // held cells take the previous value
    expect(baseResult[2]).toBe('ruby');
    expect(baseResult[4]).toBe('sapphire');
    // non-held cells keep the rolled base
    expect(baseResult[0]).toBe('cherry');
    expect(baseResult[1]).toBe('lemon');
    expect(baseResult[3]).toBe('diamond');
  });
});
