import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import {
  computeHand,
  countFours,
  countSevens,
  countZeros,
  sevenScore,
  setBonuses,
  scoreResult,
  scoreItems,
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

describe('setBonuses (fruit/gem, config-driven)', () => {
  const sum = (r: SymbolType[]) => setBonuses(r).sum;

  it('all fruit types present => +50', () => {
    expect(sum(['cherry', 'lemon', 'grape', 'zero', 'four'])).toBe(50);
  });

  it('all gem types present => +80', () => {
    expect(sum(['diamond', 'ruby', 'sapphire', 'zero', 'four'])).toBe(80);
  });

  it('only fruits (5 fruits) stacks all-fruit-types + only-fruits', () => {
    // cherry lemon grape grape grape: all 3 fruit types + only fruits
    expect(sum(['cherry', 'lemon', 'grape', 'grape', 'grape'])).toBe(50 + 100);
  });

  it('only gems => +150 (+80 all gem types)', () => {
    expect(sum(['diamond', 'ruby', 'sapphire', 'diamond', 'ruby'])).toBe(80 + 150);
  });

  it('no set symbols (numbers only) => 0', () => {
    expect(sum(['seven', 'zero', 'four', 'zero', 'seven'])).toBe(0);
  });
});

describe('scoreResult', () => {
  it('pair 🍒🍒0 0 4 => hand Pair 10, penalty 30, base -20', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'zero', 'zero', 'four'];
    const s = scoreResult(r, []);
    expect(s.hand).toBe('Pair');
    expect(s.handScore).toBe(10);
    expect(s.sevenScore).toBe(0);
    expect(s.bonusScore).toBe(0);
    expect(s.penalty).toBe(30);
    expect(s.baseRoundScore).toBe(-20);
  });

  it('five cherries: 700 + only-fruits 100 (cherry is fruit; no red/blue)', () => {
    const r: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'cherry'];
    const s = scoreResult(r, []);
    expect(s.handScore).toBe(700);
    // cherry is a fruit (올 과일 +100). The legacy all-red bonus is gone.
    expect(s.bonusScore).toBe(100);
    expect(s.penalty).toBe(0);
    expect(s.baseRoundScore).toBe(700 + 100);
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

  it('clean-bonus adds +120 only when no fours', () => {
    const clean: SymbolType[] = ['cherry', 'lemon', 'grape', 'zero', 'zero'];
    const dirty: SymbolType[] = ['cherry', 'lemon', 'grape', 'zero', 'four'];
    const c = scoreResult(clean, [RULES_BY_ID['clean-bonus']]);
    const d = scoreResult(dirty, [RULES_BY_ID['clean-bonus']]);
    expect(c.bonusScore).toBe(50 + 120); // all fruit types + clean
    expect(d.bonusScore).toBe(50);       // all fruit types only, no clean (has a four)
  });

  it('🔵🍇🔵🍇🔵 => Full House, no cross-color bonus (blue removed)', () => {
    // sapphire x3 (gem) + grape x2 (fruit): mixed set => no all-types/all-symbols.
    const r: SymbolType[] = ['sapphire', 'grape', 'sapphire', 'grape', 'sapphire'];
    const s = scoreResult(r, []);
    expect(s.bonusScore).toBe(0);
    expect(s.hand).toBe('Full House');
    expect(s.handScore).toBe(180);
    expect(s.baseRoundScore).toBe(180);
  });

  it('🔴🍒🔴🍒🔴 => Full House, no cross-color bonus (red removed)', () => {
    // ruby x3 (gem) + cherry x2 (fruit): mixed => no set bonus.
    const r: SymbolType[] = ['ruby', 'cherry', 'ruby', 'cherry', 'ruby'];
    const s = scoreResult(r, []);
    expect(s.bonusScore).toBe(0);
    expect(s.hand).toBe('Full House');
  });

  it('five fours => penalty 150, No Hand, base -150', () => {
    const r: SymbolType[] = ['four', 'four', 'four', 'four', 'four'];
    const s = scoreResult(r, []);
    expect(s.hand).toBe('No Hand');
    expect(s.penalty).toBe(150);
    expect(s.baseRoundScore).toBe(-150);
  });
});

describe('scoreItems (breakdown)', () => {
  const sum = (items: { points: number }[]) =>
    items.reduce((a, it) => a + it.points, 0);

  it('item points always sum to baseRoundScore', () => {
    const cases: SymbolType[][] = [
      ['cherry', 'cherry', 'zero', 'zero', 'four'],
      ['seven', 'seven', 'seven', 'cherry', 'cherry'],
      ['cherry', 'lemon', 'grape', 'grape', 'grape'],
      ['ruby', 'cherry', 'ruby', 'cherry', 'ruby'],
      ['four', 'four', 'four', 'four', 'four'],
    ];
    for (const r of cases) {
      expect(sum(scoreItems(r, []))).toBe(scoreResult(r, []).baseRoundScore);
    }
  });

  it('itemizes hand, color bonus, seven and penalty separately', () => {
    // 🍒🍒 0 0 4 -> Pair + 4 penalty
    const items = scoreItems(['cherry', 'cherry', 'zero', 'zero', 'four'], []);
    expect(items).toContainEqual({ label: '족보: 페어', points: 10 });
    expect(items).toContainEqual({ label: '4 페널티 (1개)', points: -30 });
  });

  it('reflects active score rules incl copy-above duplication in the sum', () => {
    const r: SymbolType[] = ['seven', 'seven', 'seven', 'cherry', 'cherry'];
    const rules = [RULES_BY_ID['seven-double'], RULES_BY_ID['copy-above']];
    expect(sum(scoreItems(r, rules))).toBe(scoreResult(r, rules).baseRoundScore);
  });
});

describe('copy-above duplicates score rules', () => {
  it('copy-above above bonus-77 applies +77 twice', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'zero', 'zero'];
    const base = scoreResult(r, []);
    const dup = scoreResult(r, [RULES_BY_ID['bonus-77'], RULES_BY_ID['copy-above']]);
    expect(dup.bonusScore).toBe(base.bonusScore + 77 * 2);
  });

  it('copy-above above clean-bonus applies +120 twice (no fours)', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'zero', 'zero'];
    const dup = scoreResult(r, [RULES_BY_ID['clean-bonus'], RULES_BY_ID['copy-above']]);
    // all-fruit-types 50 + clean 120*2
    expect(dup.bonusScore).toBe(50 + 240);
  });

  it('copy-above above seven-double quadruples the seven portion', () => {
    const r: SymbolType[] = ['seven', 'seven', 'seven', 'cherry', 'cherry'];
    const dup = scoreResult(r, [RULES_BY_ID['seven-double'], RULES_BY_ID['copy-above']]);
    expect(dup.sevenScore).toBe(150 * 4); // 150 -> x2 -> x2
  });
});

describe('four-fortune (4 weight x4 + each 4 = +20)', () => {
  const sum = (items: { points: number }[]) =>
    items.reduce((a, it) => a + it.points, 0);

  it('each 4 scores +20 and the penalty is removed', () => {
    const r: SymbolType[] = ['four', 'four', 'cherry', 'cherry', 'zero'];
    const base = scoreResult(r, []);
    const ff = scoreResult(r, [RULES_BY_ID['four-fortune']]);
    expect(base.penalty).toBe(60); // 2 fours * 30
    expect(ff.penalty).toBe(0);
    // remove the -60 penalty AND add +40 bonus (FORTUNE +20 each).
    expect(ff.baseRoundScore).toBe(base.baseRoundScore + 60 + 40);
  });

  it('scoreItems shows a positive "4 보너스" and sums to baseRoundScore', () => {
    const r: SymbolType[] = ['four', 'four', 'cherry', 'cherry', 'zero'];
    const items = scoreItems(r, [RULES_BY_ID['four-fortune']]);
    expect(items).toContainEqual({ label: '4 보너스 (2개)', points: 40 });
    expect(sum(items)).toBe(scoreResult(r, [RULES_BY_ID['four-fortune']]).baseRoundScore);
  });
});
