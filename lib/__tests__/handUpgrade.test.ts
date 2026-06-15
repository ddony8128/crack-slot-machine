import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { scoreResult, scoreItems, upgradedHandScore, type HandUpgradeMap } from '@/lib/score';
import { HAND_PAIR } from '@/data/scoreTable';

// two cherries → Pair; lemon/grape distinct; seven is a number (ignored for hands).
const PAIR_BOARD: SymbolType[] = ['cherry', 'cherry', 'lemon', 'grape', 'seven'];

describe('upgradedHandScore', () => {
  it('(base + 50×flat) × 2^double', () => {
    expect(upgradedHandScore('Pair', 10, { Pair: { flatBonusCount: 3, doubleCount: 2 } })).toBe(640);
    expect(upgradedHandScore('Pair', 10, { Pair: { flatBonusCount: 0, doubleCount: 1 } })).toBe(20);
    expect(upgradedHandScore('Pair', 10, { Pair: { flatBonusCount: 2, doubleCount: 0 } })).toBe(110);
  });
  it('no-op without an upgrade entry or on a 0 base', () => {
    expect(upgradedHandScore('Pair', 10, { Triple: { flatBonusCount: 5, doubleCount: 5 } })).toBe(10);
    expect(upgradedHandScore('Pair', 10, undefined)).toBe(10);
    expect(upgradedHandScore('No Hand', 0, { 'No Hand': { flatBonusCount: 9, doubleCount: 9 } })).toBe(0);
  });
});

describe('scoreResult/scoreItems with hand upgrades', () => {
  const ups: HandUpgradeMap = { Pair: { flatBonusCount: 3, doubleCount: 2 } };

  it('upgrades the hand portion only', () => {
    const base = scoreResult(PAIR_BOARD);
    const up = scoreResult(PAIR_BOARD, [], undefined, undefined, undefined, ups);
    expect(base.handScore).toBe(HAND_PAIR); // 10
    expect(up.handScore).toBe(640); // (10 + 150) × 4
    // only the hand portion moved; everything else identical
    expect(up.baseRoundScore - base.baseRoundScore).toBe(640 - HAND_PAIR);
    expect(up.sevenScore).toBe(base.sevenScore);
    expect(up.bonusScore).toBe(base.bonusScore);
  });

  it('scoreItems shows the upgraded points + (강화) tag', () => {
    const items = scoreItems(PAIR_BOARD, [], undefined, undefined, undefined, ups);
    const handItem = items.find((i) => i.label.startsWith('족보:'));
    expect(handItem?.points).toBe(640);
    expect(handItem?.label).toContain('(강화)');
  });

  it('no upgrades → no (강화) tag, base points', () => {
    const items = scoreItems(PAIR_BOARD);
    const handItem = items.find((i) => i.label.startsWith('족보:'));
    expect(handItem?.points).toBe(HAND_PAIR);
    expect(handItem?.label).not.toContain('강화');
  });
});
