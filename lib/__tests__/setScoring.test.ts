import { describe, it, expect } from 'vitest';
import type { EngineEvent, SymbolType } from '@/types';
import { setBonuses, scoreResult, scoreItems } from '@/lib/score';

// New Season-1 set symbols are in the SymbolType union, so no casts are needed.
const sum = (items: { points: number }[]) => items.reduce((a, it) => a + it.points, 0);

describe('cat set (board-based bonuses)', () => {
  it('per-symbol: each cat on the board is +30', () => {
    // 2 cats, not adjacent (separated by a number), only 2 distinct types.
    const r: SymbolType[] = ['cheese_cat', 'zero', 'tuxedo_cat', 'four', 'seven'];
    const { items } = setBonuses(r);
    expect(items).toContainEqual({ label: '고양이 2개', points: 60 });
    // 2 distinct types only -> no 3종; not adjacent -> no penalty.
    expect(items).not.toContainEqual(expect.objectContaining({ label: '이웃 고양이' }));
    expect(setBonuses(r).sum).toBe(60);
  });

  it('adjacency: -60 per cell that has a same-set neighbor', () => {
    // cheese(0)+tuxedo(1) are mutually adjacent => 2 qualifying cells => -120.
    // calico(3) is isolated (neighbors are numbers) => not counted.
    const r: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'calico_cat', 'seven'];
    const { items } = setBonuses(r);
    expect(items).toContainEqual({ label: '이웃 고양이', points: -120 });
  });

  it('3종: all three cat types present => +200', () => {
    const r: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'calico_cat', 'seven'];
    const { items } = setBonuses(r);
    expect(items).toContainEqual({ label: '고양이 3종', points: 200 });
  });

  it('spec example nets +170 (3 cats +90, 2 adjacent -120, 3종 +200)', () => {
    const r: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'calico_cat', 'seven'];
    const { sum: setSum, items } = setBonuses(r);
    expect(items).toContainEqual({ label: '고양이 3개', points: 90 });
    expect(items).toContainEqual({ label: '이웃 고양이', points: -120 });
    expect(items).toContainEqual({ label: '고양이 3종', points: 200 });
    expect(setSum).toBe(170);
  });

  it('three cats in a row => 3 adjacent cells (-180)', () => {
    // cheese(0),tuxedo(1),calico(2) all have a same-set neighbor.
    const r: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'calico_cat', 'zero', 'seven'];
    const { items } = setBonuses(r);
    expect(items).toContainEqual({ label: '이웃 고양이', points: -180 });
    expect(items).toContainEqual({ label: '고양이 3개', points: 90 });
    expect(items).toContainEqual({ label: '고양이 3종', points: 200 });
  });
});

describe('vehicle set (event-based bonuses)', () => {
  it('moved: +20 per moved vehicle (via events)', () => {
    const r: SymbolType[] = ['plane', 'ship', 'zero', 'four', 'seven'];
    const events: EngineEvent[] = [
      { type: 'symbol_moved', symbolId: 'plane', fromIndex: 0, toIndex: 1, byRuleId: 'x' },
      { type: 'symbol_moved', symbolId: 'ship', fromIndex: 1, toIndex: 0, byRuleId: 'x' },
    ];
    const { items } = setBonuses(r, events);
    expect(items).toContainEqual({ label: '교통수단 이동', points: 40 });
  });

  it('rerolled: +20 per rerolled vehicle (via events)', () => {
    const r: SymbolType[] = ['car', 'zero', 'four', 'seven', 'zero'];
    const events: EngineEvent[] = [
      { type: 'symbol_rerolled', symbolId: 'car', index: 0, byRuleId: 'x' },
    ];
    const { items } = setBonuses(r, events);
    expect(items).toContainEqual({ label: '교통수단 재굴림', points: 20 });
  });

  it('moved + rerolled combine; non-vehicle events ignored', () => {
    const r: SymbolType[] = ['plane', 'car', 'zero', 'four', 'seven'];
    const events: EngineEvent[] = [
      { type: 'symbol_moved', symbolId: 'plane', fromIndex: 0, toIndex: 1, byRuleId: 'x' },
      { type: 'symbol_rerolled', symbolId: 'car', index: 1, byRuleId: 'x' },
      // cherry is not a vehicle -> ignored by the vehicle set.
      { type: 'symbol_moved', symbolId: 'cherry', fromIndex: 2, toIndex: 3, byRuleId: 'x' },
    ];
    const { sum: setSum } = setBonuses(r, events);
    expect(setSum).toBe(20 + 20);
  });

  it('no events => no event bonus (vehicles on board alone score 0)', () => {
    const r: SymbolType[] = ['plane', 'ship', 'car', 'zero', 'seven'];
    expect(setBonuses(r).sum).toBe(0);
  });
});

describe('monster set (copied events)', () => {
  it('copied: +40 per copied monster (via events)', () => {
    const r: SymbolType[] = ['dracula', 'zombie', 'zero', 'four', 'seven'];
    const events: EngineEvent[] = [
      { type: 'symbol_copied', symbolId: 'dracula', fromIndex: 0, toIndex: 1, byRuleId: 'x' },
      { type: 'symbol_copied', symbolId: 'ghost', fromIndex: 2, toIndex: 3, byRuleId: 'x' },
    ];
    const { items } = setBonuses(r, events);
    // dracula + ghost are both monsters -> 2 copies * 40 = 80.
    expect(items).toContainEqual({ label: '괴물 복사', points: 80 });
  });

  it('a moved monster does NOT trigger the copied bonus', () => {
    const r: SymbolType[] = ['dracula', 'zero', 'four', 'seven', 'zero'];
    const events: EngineEvent[] = [
      { type: 'symbol_moved', symbolId: 'dracula', fromIndex: 0, toIndex: 1, byRuleId: 'x' },
    ];
    expect(setBonuses(r, events).sum).toBe(0);
  });
});

describe('generalized integration with scoreResult / scoreItems', () => {
  it('a board with no set symbols => 0 set bonus', () => {
    const r: SymbolType[] = ['seven', 'zero', 'four', 'zero', 'seven'];
    expect(setBonuses(r).sum).toBe(0);
    // scoreResult bonusScore is just set bonuses (no score rules here).
    expect(scoreResult(r, []).bonusScore).toBe(0);
  });

  it('scoreResult threads events into bonusScore (vehicle moved)', () => {
    const r: SymbolType[] = ['plane', 'ship', 'zero', 'zero', 'zero'];
    const events: EngineEvent[] = [
      { type: 'symbol_moved', symbolId: 'plane', fromIndex: 0, toIndex: 1, byRuleId: 'x' },
    ];
    const without = scoreResult(r, [], []);
    const withEv = scoreResult(r, [], events);
    expect(withEv.bonusScore).toBe(without.bonusScore + 20);
  });

  it('scoreItems sum equals scoreResult.baseRoundScore (with events)', () => {
    const r: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'zero', 'calico_cat', 'four'];
    const events: EngineEvent[] = [
      { type: 'symbol_rerolled', symbolId: 'car', index: 4, byRuleId: 'x' },
    ];
    expect(sum(scoreItems(r, [], events))).toBe(scoreResult(r, [], events).baseRoundScore);
  });

  it('non-number symbols form poker hands (cats can pair/triple)', () => {
    const r: SymbolType[] = ['cheese_cat', 'cheese_cat', 'cheese_cat', 'zero', 'seven'];
    const s = scoreResult(r, []);
    expect(s.hand).toBe('Triple');
    expect(s.handScore).toBe(30);
  });
});
