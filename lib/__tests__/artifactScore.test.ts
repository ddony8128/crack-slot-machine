import { describe, it, expect } from 'vitest';
import type { EngineEvent, SymbolType } from '@/types';
import { scoreResult, scoreItems, computeHand } from '@/lib/score';

const sum = (items: { points: number }[]) => items.reduce((a, it) => a + it.points, 0);

// Helper engine events.
const moved = (symbolId: SymbolType, byRuleId = 'x'): EngineEvent => ({
  type: 'symbol_moved',
  symbolId,
  fromIndex: 0,
  toIndex: 1,
  byRuleId,
});
const rerolled = (symbolId: SymbolType, byRuleId = 'x'): EngineEvent => ({
  type: 'symbol_rerolled',
  symbolId,
  index: 0,
  byRuleId,
});
const copied = (symbolId: SymbolType, byRuleId = 'x'): EngineEvent => ({
  type: 'symbol_copied',
  symbolId,
  fromIndex: 0,
  toIndex: 1,
  byRuleId,
});

describe('artifacts=[] is a strict no-op (back-compat)', () => {
  const cases: { name: string; r: SymbolType[]; events?: EngineEvent[]; rules?: (null)[] }[] = [
    { name: 'all fruit', r: ['cherry', 'cherry', 'lemon', 'grape', 'cherry'] },
    { name: 'all gems', r: ['diamond', 'ruby', 'sapphire', 'diamond', 'ruby'] },
    { name: 'adjacent cats', r: ['cheese_cat', 'tuxedo_cat', 'zero', 'calico_cat', 'seven'] },
    {
      name: 'vehicle/monster events',
      r: ['plane', 'ship', 'car', 'dracula', 'zombie'],
      events: [moved('car'), copied('ship'), rerolled('dracula')],
    },
  ];
  for (const c of cases) {
    it(`${c.name}: scoreResult identical with [] vs default`, () => {
      const rules = c.rules ?? [null, null];
      const withDefault = scoreResult(c.r, rules, c.events, undefined, undefined, undefined);
      const withEmpty = scoreResult(c.r, rules, c.events, undefined, undefined, undefined, []);
      expect(withEmpty).toEqual(withDefault);

      const itemsDefault = scoreItems(c.r, rules, c.events, undefined, undefined, undefined);
      const itemsEmpty = scoreItems(c.r, rules, c.events, undefined, undefined, undefined, []);
      expect(itemsEmpty).toEqual(itemsDefault);
    });
  }
});

describe('1. cherry-charm (체리): hand counts one extra cherry', () => {
  it('computeHand opts: a single cherry becomes a pair', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'seven', 'zero'];
    expect(computeHand(r).hand).toBe('No Hand');
    expect(computeHand(r, undefined, { extraCherry: true }).hand).toBe('Pair');
  });

  it('upgrades pair → triple in scoreResult', () => {
    // Two cherries (a pair). Charm makes three (a triple).
    const r: SymbolType[] = ['cherry', 'cherry', 'lemon', 'grape', 'seven'];
    const without = scoreResult(r, [], undefined, undefined, undefined, undefined, []);
    const withCharm = scoreResult(r, [], undefined, undefined, undefined, undefined, ['cherry-charm']);
    expect(without.hand).toBe('Pair');
    expect(withCharm.hand).toBe('Triple');
    expect(withCharm.handScore).toBeGreaterThan(without.handScore);
  });
});

describe('2. receipt (영수증): +300 when board is all fruit', () => {
  it('adds +300 on an all-fruit board, stacking with 올 과일', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'cherry', 'lemon'];
    const base = scoreResult(r, [], undefined, undefined, undefined, undefined, []);
    const withR = scoreResult(r, [], undefined, undefined, undefined, undefined, ['receipt']);
    expect(withR.baseRoundScore - base.baseRoundScore).toBe(300);
    expect(scoreItems(r, [], undefined, undefined, undefined, undefined, ['receipt'])).toContainEqual({
      label: '영수증 +300',
      points: 300,
    });
  });

  it('does NOT add when a non-fruit cell is present', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'cherry', 'seven'];
    const base = scoreResult(r, [], undefined, undefined, undefined, undefined, []);
    const withR = scoreResult(r, [], undefined, undefined, undefined, undefined, ['receipt']);
    expect(withR.baseRoundScore).toBe(base.baseRoundScore);
  });
});

describe('3. vault (금고): +200 when all 3 gem types present', () => {
  it('adds +200 when diamond/ruby/sapphire all present', () => {
    const r: SymbolType[] = ['diamond', 'ruby', 'sapphire', 'seven', 'zero'];
    const base = scoreResult(r, [], undefined, undefined, undefined, undefined, []);
    const withV = scoreResult(r, [], undefined, undefined, undefined, undefined, ['vault']);
    expect(withV.baseRoundScore - base.baseRoundScore).toBe(200);
  });

  it('does NOT add when a gem type is missing', () => {
    const r: SymbolType[] = ['diamond', 'ruby', 'diamond', 'seven', 'zero'];
    const base = scoreResult(r, [], undefined, undefined, undefined, undefined, []);
    const withV = scoreResult(r, [], undefined, undefined, undefined, undefined, ['vault']);
    expect(withV.baseRoundScore).toBe(base.baseRoundScore);
  });
});

describe('4. cat-tower (캣 타워): +60 per adjacent-cat cell, cancels the penalty', () => {
  it('exactly cancels the cat adjacent-penalty', () => {
    // cheese(0)+tuxedo(1) adjacent => 2 qualifying cells => -120 penalty.
    const r: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'calico_cat', 'seven'];
    const base = scoreResult(r, [], undefined, undefined, undefined, undefined, []);
    const withT = scoreResult(r, [], undefined, undefined, undefined, undefined, ['cat-tower']);
    expect(withT.baseRoundScore - base.baseRoundScore).toBe(120);
    expect(scoreItems(r, [], undefined, undefined, undefined, undefined, ['cat-tower'])).toContainEqual({
      label: '캣 타워',
      points: 120,
    });
  });
});

describe('5. blank-canvas (새하얀 도화지): +50 per NULL active slot', () => {
  it('counts only null entries in activeSlotRules', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'seven', 'zero'];
    const rules = [null, null, null]; // 3 empty
    const base = scoreResult(r, rules, undefined, undefined, undefined, undefined, []);
    const withC = scoreResult(r, rules, undefined, undefined, undefined, undefined, ['blank-canvas']);
    expect(withC.baseRoundScore - base.baseRoundScore).toBe(150);
    expect(scoreItems(r, rules, undefined, undefined, undefined, undefined, ['blank-canvas'])).toContainEqual({
      label: '새하얀 도화지 (3칸)',
      points: 150,
    });
  });
});

describe('6. spooky-cruise (으스스한 유람선): +40 per vehicle copied event', () => {
  it('counts symbol_copied events with vehicle symbolId', () => {
    const r: SymbolType[] = ['plane', 'ship', 'car', 'seven', 'zero'];
    const events = [copied('plane'), copied('car'), copied('dracula')]; // 2 vehicle copies
    const base = scoreResult(r, [], events, undefined, undefined, undefined, []);
    const withS = scoreResult(r, [], events, undefined, undefined, undefined, ['spooky-cruise']);
    expect(withS.baseRoundScore - base.baseRoundScore).toBe(80);
  });
});

describe('7. monster-truck (괴물 자동차): +20 per monster moved/rerolled event', () => {
  it('counts symbol_moved + symbol_rerolled with monster symbolId', () => {
    const r: SymbolType[] = ['dracula', 'zombie', 'ghost', 'seven', 'zero'];
    const events = [moved('dracula'), rerolled('zombie'), copied('ghost'), moved('car')];
    // 1 moved + 1 rerolled monster = 2 -> +40 (copied ghost and moved car don't count).
    const base = scoreResult(r, [], events, undefined, undefined, undefined, []);
    const withM = scoreResult(r, [], events, undefined, undefined, undefined, ['monster-truck']);
    expect(withM.baseRoundScore - base.baseRoundScore).toBe(40);
  });
});

describe('8. crowbar (빠루): ≥3 monster rerolls → spin ×2', () => {
  it('doubles baseRoundScore', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'cherry', 'lemon'];
    const events = [rerolled('dracula'), rerolled('zombie'), rerolled('ghost')];
    const base = scoreResult(r, [], events, undefined, undefined, undefined, []);
    const withC = scoreResult(r, [], events, undefined, undefined, undefined, ['crowbar']);
    expect(withC.baseRoundScore).toBe(base.baseRoundScore * 2);
  });

  it('does NOT trigger with only 2 monster rerolls', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'cherry', 'lemon'];
    const events = [rerolled('dracula'), rerolled('zombie')];
    const base = scoreResult(r, [], events, undefined, undefined, undefined, []);
    const withC = scoreResult(r, [], events, undefined, undefined, undefined, ['crowbar']);
    expect(withC.baseRoundScore).toBe(base.baseRoundScore);
  });
});

describe('9. private-jet (전용기): ≥6 vehicle moves → spin ×2', () => {
  it('doubles baseRoundScore', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'cherry', 'lemon'];
    const events = Array.from({ length: 6 }, () => moved('car'));
    const base = scoreResult(r, [], events, undefined, undefined, undefined, []);
    const withJ = scoreResult(r, [], events, undefined, undefined, undefined, ['private-jet']);
    expect(withJ.baseRoundScore).toBe(base.baseRoundScore * 2);
  });
});

describe('crowbar + private-jet stack to ×4', () => {
  it('multiplies baseRoundScore by 4', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'cherry', 'lemon'];
    const events: EngineEvent[] = [
      rerolled('dracula'),
      rerolled('zombie'),
      rerolled('ghost'),
      ...Array.from({ length: 6 }, () => moved('car')),
    ];
    const base = scoreResult(r, [], events, undefined, undefined, undefined, []);
    const both = scoreResult(r, [], events, undefined, undefined, undefined, ['crowbar', 'private-jet']);
    expect(both.baseRoundScore).toBe(base.baseRoundScore * 4);
  });
});

describe('scoreItems points sum to scoreResult.baseRoundScore (artifact-active)', () => {
  it('additive + multiplier case', () => {
    // all-fruit board (receipt + 올 과일) with a crowbar ×2 multiplier.
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'cherry', 'lemon'];
    const rules = [null]; // blank-canvas 1칸
    const events = [rerolled('dracula'), rerolled('zombie'), rerolled('ghost')];
    const artifacts = ['receipt', 'blank-canvas', 'crowbar'];
    const score = scoreResult(r, rules, events, undefined, undefined, undefined, artifacts);
    const items = scoreItems(r, rules, events, undefined, undefined, undefined, artifacts);
    expect(sum(items)).toBe(score.baseRoundScore);
    expect(score.baseRoundScore).toBeGreaterThan(0);
  });
});
