import { describe, it, expect } from 'vitest';
import {
  initialSpireState,
  settleClear,
  rerollShop,
  type SpireRunState,
} from '@/lib/spire/state';
import { goldBarMoney } from '@/lib/spire/stage';
import { spireInterest } from '@/lib/spire/config';
import type { SymbolType } from '@/types';

const SEED = 'econ-artifacts';

/** A run-state with a chosen money/artifacts, on stage 1 attempt 1. */
function stateWith(partial: Partial<SpireRunState>): SpireRunState {
  return { ...initialSpireState(SEED), ...partial };
}

describe('ledger (가계부) — interest ×2 in settleClear', () => {
  it('doubles interest when owned and reflects it in the breakdown', () => {
    // money 13 → spireInterest(13) = floor(13/5) = 2 normally, 4 with ledger.
    expect(spireInterest(13)).toBe(2);

    const without = settleClear(stateWith({ money: 13 }), 0, 0);
    const withLedger = settleClear(
      stateWith({ money: 13, artifacts: ['ledger'] }),
      0,
      0,
    );
    expect(without.ok && withLedger.ok).toBe(true);
    if (!without.ok || !withLedger.ok) return;

    expect(without.breakdown.interest).toBe(2);
    expect(withLedger.breakdown.interest).toBe(4);
    // ledger money gain over baseline = the extra +2 interest.
    expect(withLedger.state.money - without.state.money).toBe(2);
  });
});

describe('gold-bar (금괴) — goldBarMoney helper', () => {
  const gem = (n: number): SymbolType[] => {
    // n gem-set symbols (diamond/ruby/sapphire) padded to a length-5 board.
    const gems: SymbolType[] = ['diamond', 'ruby', 'sapphire', 'diamond', 'ruby'];
    const board: SymbolType[] = [];
    for (let i = 0; i < 5; i++) board.push(i < n ? gems[i] : ('zero' as SymbolType));
    return board;
  };

  it('counts only spins with ≥4 gems, ignores <4', () => {
    const boards = [gem(5), gem(4), gem(3), gem(0)];
    expect(goldBarMoney(boards, ['gold-bar'])).toBe(2); // 5 and 4 count; 3 and 0 don't
  });

  it('returns 0 without the artifact even with gem-heavy boards', () => {
    expect(goldBarMoney([gem(5), gem(4)], [])).toBe(0);
  });

  it('returns 0 for an empty board list', () => {
    expect(goldBarMoney([], ['gold-bar'])).toBe(0);
  });
});

describe('chime (차임벨) — rerollShop free logic', () => {
  it('a free reroll does NOT change money', () => {
    const s = stateWith({ money: 5 });
    const r = rerollShop(s, true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.money).toBe(5);
  });

  it('a paid reroll deducts the reroll price', () => {
    const s = stateWith({ money: 5 });
    const r = rerollShop(s, false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.money).toBe(4);
  });

  it('first 2 rerolls free, the 3rd paid (chime per-visit derivation)', () => {
    // Mirror the replay/client derivation: free = owns chime && index < 2.
    let s = stateWith({ money: 1, artifacts: ['chime'] });
    for (let i = 0; i < 3; i++) {
      const free = s.artifacts.includes('chime') && i < 2;
      const r = rerollShop(s, free);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    // Two free, one paid (1 → 0). The 3rd would have failed at money 0 only if
    // not free; here money started at 1 so the single paid reroll lands at 0.
    expect(s.money).toBe(0);
  });
});
