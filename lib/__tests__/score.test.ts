import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import {
  computeHand,
  countFours,
  countSevens,
  countZeros,
  sevenScore,
  colorBonuses,
  scoreResult,
} from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';

describe('computeHand', () => {
  it('pair: 🍒🍒 0 0 4 => Pair 10', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'zero', 'zero', 'four'];
    expect(computeHand(r)).toEqual({ hand: 'Pair', handScore: 10 });
  });

  it('two pair beats triple/pair: 🍒🍒🍋🍋0 => Two Pair 90', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'lemon', 'lemon', 'zero'];
    expect(computeHand(r)).toEqual({ hand: 'Two Pair', handScore: 90 });
  });

  it('triple: 💎💎💎0 0 => Triple 30', () => {
    const r: SymbolType[] = ['diamond', 'diamond', 'diamond', 'zero', 'zero'];
    expect(computeHand(r)).toEqual({ hand: 'Triple', handScore: 30 });
  });

  it('full house: 🍒🍒🍒🍋🍋 => Full House 180', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'cherry', 'lemon', 'lemon'];
    expect(computeHand(r)).toEqual({ hand: 'Full House', handScore: 180 });
  });

  it('four of a kind: 💎💎💎💎0 => 300', () => {
    const r: SymbolType[] = ['diamond', 'diamond', 'diamond', 'diamond', 'zero'];
    expect(computeHand(r)).toEqual({ hand: 'Four of a Kind', handScore: 300 });
  });

  it('five of a kind: 🍒🍒🍒🍒🍒 => 700', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'cherry'];
    expect(computeHand(r)).toEqual({ hand: 'Five of a Kind', handScore: 700 });
  });

  it('numbers ignored: 7 7 0 0 4 => No Hand', () => {
    const r: SymbolType[] = ['seven', 'seven', 'zero', 'zero', 'four'];
    expect(computeHand(r)).toEqual({ hand: 'No Hand', handScore: 0 });
  });
});

describe('counts', () => {
  it('countSevens / countZeros / countFours', () => {
    const r: SymbolType[] = ['seven', 'seven', 'zero', 'four', 'four'];
    expect(countSevens(r)).toBe(2);
    expect(countZeros(r)).toBe(1);
    expect(countFours(r)).toBe(2);
  });
});

describe('sevenScore', () => {
  it('maps 1/2/3/4/5 sevens to 10/77/150/500/777', () => {
    const make = (n: number): SymbolType[] => {
      const a: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'cherry'];
      for (let i = 0; i < n; i++) a[i] = 'seven';
      return a;
    };
    expect(sevenScore(make(1))).toBe(10);
    expect(sevenScore(make(2))).toBe(77);
    expect(sevenScore(make(3))).toBe(150);
    expect(sevenScore(make(4))).toBe(500);
    expect(sevenScore(make(5))).toBe(777);
  });

  it('zero sevens => 0', () => {
    expect(sevenScore(['cherry', 'lemon', 'grape', 'zero', 'four'])).toBe(0);
  });

  it('seven-double doubles the seven portion', () => {
    const r: SymbolType[] = ['seven', 'seven', 'zero', 'zero', 'four'];
    expect(sevenScore(r, { sevenDouble: false })).toBe(77);
    expect(sevenScore(r, { sevenDouble: true })).toBe(154);
  });
});

describe('colorBonuses', () => {
  it('all fruit types present => +50', () => {
    expect(colorBonuses(['cherry', 'lemon', 'grape', 'zero', 'four'])).toBe(50);
  });

  it('all gem types present => +80', () => {
    expect(colorBonuses(['diamond', 'ruby', 'sapphire', 'zero', 'four'])).toBe(80);
  });

  it('only fruits (5 fruits) stacks all-fruit-types + only-fruits', () => {
    // cherry lemon grape grape grape: all 3 fruit types + only fruits
    expect(colorBonuses(['cherry', 'lemon', 'grape', 'grape', 'grape'])).toBe(50 + 100);
  });

  it('only gems => +150 (+80 all gem types)', () => {
    expect(colorBonuses(['diamond', 'ruby', 'sapphire', 'diamond', 'ruby'])).toBe(80 + 150);
  });

  it('all blue: 🔵🍇🔵🍇🔵 => +200 (also only-fruits? no — sapphire is gem)', () => {
    // sapphire grape sapphire grape sapphire => all BLUE, not all fruit, not all gem
    expect(colorBonuses(['sapphire', 'grape', 'sapphire', 'grape', 'sapphire'])).toBe(200);
  });

  it('all red: 🔴🍒🔴🍒🔴 => +250', () => {
    expect(colorBonuses(['ruby', 'cherry', 'ruby', 'cherry', 'ruby'])).toBe(250);
  });
});

describe('scoreResult', () => {
  it('pair 🍒🍒0 0 4 => hand Pair 10, penalty 20, base -10', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'zero', 'zero', 'four'];
    const s = scoreResult(r, []);
    expect(s.hand).toBe('Pair');
    expect(s.handScore).toBe(10);
    expect(s.sevenScore).toBe(0);
    expect(s.bonusScore).toBe(0);
    expect(s.penalty).toBe(20);
    expect(s.baseRoundScore).toBe(-10);
  });

  it('five cherries is additive: 700 + only-fruits 100 + all-red 250', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'cherry'];
    const s = scoreResult(r, []);
    expect(s.handScore).toBe(700);
    // cherry is a fruit (only-fruits +100) AND in RED set (all-red +250).
    expect(s.bonusScore).toBe(100 + 250);
    expect(s.penalty).toBe(0);
    expect(s.baseRoundScore).toBe(700 + 350);
  });

  it('five lemons => 700 + only-fruits 100 (lemon is colorless, no red/blue)', () => {
    const r: SymbolType[] = ['lemon', 'lemon', 'lemon', 'lemon', 'lemon'];
    const s = scoreResult(r, []);
    expect(s.handScore).toBe(700);
    expect(s.bonusScore).toBe(100);
    expect(s.baseRoundScore).toBe(800);
  });

  it('four-of-a-kind 💎💎💎💎0 => 300, no penalty (no fours)', () => {
    const r: SymbolType[] = ['diamond', 'diamond', 'diamond', 'diamond', 'zero'];
    const s = scoreResult(r, []);
    expect(s.handScore).toBe(300);
    expect(s.penalty).toBe(0);
    expect(s.baseRoundScore).toBe(300);
  });

  it('seven-double rule doubles seven portion', () => {
    const r: SymbolType[] = ['seven', 'seven', 'seven', 'cherry', 'cherry'];
    const noDouble = scoreResult(r, []);
    const withDouble = scoreResult(r, [RULES_BY_ID['seven-double']]);
    expect(noDouble.sevenScore).toBe(150);
    expect(withDouble.sevenScore).toBe(300);
    // hand pair (cherry cherry) = 10 unaffected
    expect(withDouble.handScore).toBe(10);
  });

  it('bonus-77 adds +77', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'zero', 'zero'];
    const base = scoreResult(r, []);
    const bonus = scoreResult(r, [RULES_BY_ID['bonus-77']]);
    expect(bonus.bonusScore).toBe(base.bonusScore + 77);
  });

  it('clean-bonus adds +100 only when no fours', () => {
    const clean: SymbolType[] = ['cherry', 'lemon', 'grape', 'zero', 'zero'];
    const dirty: SymbolType[] = ['cherry', 'lemon', 'grape', 'zero', 'four'];
    const c = scoreResult(clean, [RULES_BY_ID['clean-bonus']]);
    const d = scoreResult(dirty, [RULES_BY_ID['clean-bonus']]);
    expect(c.bonusScore).toBe(50 + 100); // all fruit types + clean
    expect(d.bonusScore).toBe(50);       // all fruit types only, no clean (has a four)
  });

  it('all-blue 🔵🍇🔵🍇🔵 => +200 bonus and Two Pair... actually triple-ish hand', () => {
    // sapphire grape sapphire grape sapphire: sapphire x3, grape x2 => full house
    const r: SymbolType[] = ['sapphire', 'grape', 'sapphire', 'grape', 'sapphire'];
    const s = scoreResult(r, []);
    expect(s.bonusScore).toBe(200);
    expect(s.hand).toBe('Full House');
    expect(s.handScore).toBe(180);
    expect(s.baseRoundScore).toBe(380);
  });

  it('all-red 🔴🍒🔴🍒🔴 => +250 bonus', () => {
    const r: SymbolType[] = ['ruby', 'cherry', 'ruby', 'cherry', 'ruby'];
    const s = scoreResult(r, []);
    expect(s.bonusScore).toBe(250);
  });

  it('five fours => penalty 100, No Hand, base -100', () => {
    const r: SymbolType[] = ['four', 'four', 'four', 'four', 'four'];
    const s = scoreResult(r, []);
    expect(s.hand).toBe('No Hand');
    expect(s.penalty).toBe(100);
    expect(s.baseRoundScore).toBe(-100);
  });
});
