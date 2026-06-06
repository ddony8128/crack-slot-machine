import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { baseSpin, computeWeights, rollBoard } from '@/lib/spin';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS, FRUITS } from '@/data/symbols';
import { rollSymbol, type Rng } from '@/lib/rng';

const NUMBER_SET = new Set<SymbolType>(['seven', 'zero', 'four']);

function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

describe('computeWeights', () => {
  it('fruit-surge triples fruit weights', () => {
    const w = computeWeights([RULES_BY_ID['fruit-surge']], BASE_WEIGHTS);
    for (const f of FRUITS) {
      expect(w[f]).toBe(BASE_WEIGHTS[f] * 3);
    }
    expect(w.seven).toBe(BASE_WEIGHTS.seven);
    expect(w.zero).toBe(BASE_WEIGHTS.zero);
  });

  it('gem-surge triples gem weights', () => {
    const w = computeWeights([RULES_BY_ID['gem-surge']], BASE_WEIGHTS);
    expect(w.diamond).toBe(BASE_WEIGHTS.diamond * 3);
    expect(w.ruby).toBe(BASE_WEIGHTS.ruby * 3);
    expect(w.sapphire).toBe(BASE_WEIGHTS.sapphire * 3);
  });

  it('seven-fever triples seven', () => {
    const sf = computeWeights([RULES_BY_ID['seven-fever']], BASE_WEIGHTS);
    expect(sf.seven).toBe(BASE_WEIGHTS.seven * 3);
  });

  it('no-zero sets zero weight to 0', () => {
    const w = computeWeights([RULES_BY_ID['no-zero']], BASE_WEIGHTS);
    expect(w.zero).toBe(0);
  });

  it('four-fortune quadruples the four weight (score rule, weight side-effect)', () => {
    const w = computeWeights([RULES_BY_ID['four-fortune']], BASE_WEIGHTS);
    expect(w.four).toBe(BASE_WEIGHTS.four * 4);
    expect(w.zero).toBe(BASE_WEIGHTS.zero);
  });

  it('diamond-cut sets diamond and sapphire weights to 0 (other weights untouched)', () => {
    const w = computeWeights([RULES_BY_ID['diamond-cut']], BASE_WEIGHTS);
    expect(w.diamond).toBe(0);
    expect(w.sapphire).toBe(0);
    // fruit and other symbols untouched
    for (const f of FRUITS) {
      expect(w[f]).toBe(BASE_WEIGHTS[f]);
    }
    expect(w.ruby).toBe(BASE_WEIGHTS.ruby);
    expect(w.seven).toBe(BASE_WEIGHTS.seven);
    expect(w.zero).toBe(BASE_WEIGHTS.zero);
  });

  it('four-shield multiplies the zero weight by 2 (even though it is a reroll rule)', () => {
    const w = computeWeights([RULES_BY_ID['four-shield']], BASE_WEIGHTS);
    expect(w.zero).toBe(BASE_WEIGHTS.zero * 2);
    // other weights untouched
    expect(w.four).toBe(BASE_WEIGHTS.four);
    expect(w.seven).toBe(BASE_WEIGHTS.seven);
  });

  it('four-shield zero×2 stacks multiplicatively with no-zero (=> 0)', () => {
    const w = computeWeights(
      [RULES_BY_ID['four-shield'], RULES_BY_ID['no-zero']],
      BASE_WEIGHTS,
    );
    expect(w.zero).toBe(0);
  });

  it('stacking weight rules multiplies', () => {
    const w = computeWeights(
      [RULES_BY_ID['seven-fever'], RULES_BY_ID['seven-fever']],
      BASE_WEIGHTS,
    );
    expect(w.seven).toBe(BASE_WEIGHTS.seven * 3 * 3);
  });

  it('copy-above above a weight rule duplicates its effect (fruit ×3 twice = ×9)', () => {
    const w = computeWeights(
      [RULES_BY_ID['fruit-surge'], RULES_BY_ID['copy-above']],
      BASE_WEIGHTS,
    );
    for (const f of FRUITS) expect(w[f]).toBe(BASE_WEIGHTS[f] * 9);
  });

  it('copy-above duplicates four-fortune (4 weight ×4 twice = ×16)', () => {
    const w = computeWeights(
      [RULES_BY_ID['four-fortune'], RULES_BY_ID['copy-above']],
      BASE_WEIGHTS,
    );
    expect(w.four).toBe(BASE_WEIGHTS.four * 16);
    // other symbols untouched
    expect(w.seven).toBe(BASE_WEIGHTS.seven);
  });

  it('copy-above duplicates seven-fever (7 weight ×3 twice = ×9)', () => {
    const w = computeWeights(
      [RULES_BY_ID['seven-fever'], RULES_BY_ID['copy-above']],
      BASE_WEIGHTS,
    );
    expect(w.seven).toBe(BASE_WEIGHTS.seven * 9);
  });

  it('number-spin changes NO weights (it only restricts the first roll, never rerolls)', () => {
    // number-spin is a first-roll pool restriction in rollBoard, not a weight
    // change. Reroll rules (four-shield/parry, fish, shuffle, select-reroll) roll
    // via rollSymbol(weights), so leaving weights untouched proves they are never
    // number-restricted by number-spin.
    const w = computeWeights([RULES_BY_ID['number-spin']], BASE_WEIGHTS);
    expect(w).toEqual(BASE_WEIGHTS);
  });

  it('does not mutate the base weights', () => {
    const before = BASE_WEIGHTS.cherry;
    computeWeights([RULES_BY_ID['fruit-surge']], BASE_WEIGHTS);
    expect(BASE_WEIGHTS.cherry).toBe(before);
  });
});

describe('baseSpin', () => {
  it('returns n deterministic symbols with a fixed rng', () => {
    // first entry in BASE_WEIGHTS is 'cherry'; rng -> 0 targets first symbol.
    const rng = queuedRng([0, 0, 0, 0, 0]);
    const result = baseSpin(BASE_WEIGHTS, rng, 5);
    expect(result).toHaveLength(5);
    expect(result.every((s) => s === 'cherry')).toBe(true);
  });

  it('rollSymbol respects uniform weighted boundaries', () => {
    // uniform weights total = 9, 9 symbols each band width 1.
    // 'seven' is index 6 -> band [6,7).
    const point = (6 + 0.5) / 9;
    const sym: SymbolType = rollSymbol(BASE_WEIGHTS, () => point);
    expect(sym).toBe('seven');
  });
});

describe('rollBoard — number-spin pre-roll restriction', () => {
  // rng that always lands on the first symbol of whatever weight map it's given.
  const firstBand: Rng = () => 0.001;

  it('without number-spin rolls normally (equivalent to baseSpin)', () => {
    const prev: SymbolType[] = ['seven', 'cherry', 'zero', 'lemon', 'four'];
    // firstBand against full BASE_WEIGHTS -> first symbol = 'cherry' for every cell.
    const board = rollBoard([], BASE_WEIGHTS, prev, firstBand, 5);
    expect(board).toEqual(['cherry', 'cherry', 'cherry', 'cherry', 'cherry']);
  });

  it('cells that started as a number land on a number (7/0/4); others roll normally', () => {
    const prev: SymbolType[] = ['seven', 'cherry', 'zero', 'lemon', 'four'];
    // firstBand on restricted {seven,zero,four} -> 'seven'; on full weights -> 'cherry'.
    const board = rollBoard(
      [RULES_BY_ID['number-spin']],
      BASE_WEIGHTS,
      prev,
      firstBand,
      5,
    );
    // number-prev cells (0,2,4) restricted to numbers {seven, zero, four}
    expect(NUMBER_SET.has(board[0])).toBe(true);
    expect(NUMBER_SET.has(board[2])).toBe(true);
    expect(NUMBER_SET.has(board[4])).toBe(true);
    expect(board[0]).toBe('seven');
    // non-number-prev cells (1,3) roll normally -> cherry (not forced to a number)
    expect(board[1]).toBe('cherry');
    expect(board[3]).toBe('cherry');
  });

  it('a non-number previous cell is never forced to a number under number-spin', () => {
    const prev: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'cherry'];
    const board = rollBoard(
      [RULES_BY_ID['number-spin']],
      BASE_WEIGHTS,
      prev,
      firstBand,
      5,
    );
    expect(board.every((s) => s === 'cherry')).toBe(true);
  });
});
