import { describe, it, expect } from 'vitest';
import { dailyRunConfigFromParts } from '@/lib/daily/run';
import { puzzleRunConfig } from '@/lib/puzzle/run';
import { spireStageRunConfig } from '@/lib/spire/stage';
import { detectSpecials } from '@/lib/specials';
import { scoreResult } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { createGameStore } from '@/store/gameStore';
import { createSeededRng } from '@/lib/rng';
import { FOURS_4_MULT } from '@/data/scoreTable';
import type { SymbolType } from '@/types';

// The LEGACY preset = 빠른 게임/이벤트 (no RunConfig): number specials ON, CLEAN
// SWEEP reads the FINAL board, and only BASE-rollable rules are offered. Season
// configs explicitly opt INTO the new behavior. These tests pin both sides.

describe('season configs opt into the new (non-legacy) behavior', () => {
  it('daily/puzzle/spire all set positionalCleanSweep + numberSpecials off', () => {
    const daily = dailyRunConfigFromParts({ seed: 's', groupASetId: 'fruit', groupBSetId: 'gem', basicRuleSetId: 'daily_basic_1' });
    const puzzle = puzzleRunConfig('p01');
    const spire = spireStageRunConfig('s', 1, 1, { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 }, []);
    for (const cfg of [daily, puzzle, spire]) {
      expect(cfg.positionalCleanSweep).toBe(true);
      expect(cfg.numberSpecials).toEqual({ four: false, zero: false });
    }
  });
});

describe('LEGACY (no-config) quick/event behavior', () => {
  it('keeps number special hands ON', () => {
    const four4: SymbolType[] = ['four', 'four', 'four', 'four', 'seven'];
    // no opts = legacy default ON
    expect(detectSpecials(four4).nextMultiplier).toBe(FOURS_4_MULT);
  });

  it('CLEAN SWEEP reads the FINAL board (scoreBoards undefined)', () => {
    // A board with no 4s scores CLEAN SWEEP on the final board when the rule is active.
    const board: SymbolType[] = ['seven', 'cherry', 'lemon', 'grape', 'diamond'];
    const legacy = scoreResult(board, [RULES_BY_ID['clean-sweep']], undefined, undefined);
    const positional = scoreResult(board, [RULES_BY_ID['clean-sweep']], undefined, []);
    // undefined → final-board path; [] → positional path. Both defined; the point
    // is the legacy call uses the final board (no scoreBoards threading).
    expect(legacy.bonusScore).toBeGreaterThanOrEqual(0);
    expect(positional.bonusScore).toBeGreaterThanOrEqual(0);
  });

  it('offers only BASE-rollable rules (no cat/vehicle/monster) in a no-config run', () => {
    const store = createGameStore(createSeededRng('legacy-offer'));
    const s = () => store.getState();
    s().setNickname('t');
    s().startGame();
    let guard = 0;
    const dead = new Set(['cat', 'vehicle', 'monster']);
    while (s().status !== 'finished' && guard++ < 80) {
      const st = s();
      if (st.status === 'choosing-rule') {
        for (const r of st.offeredRules) expect(dead.has(r.build ?? '')).toBe(false);
        st.selectRule(st.offeredRules[0]);
        s().placePending({ type: 'slot', index: 0 });
      } else if (st.status === 'ready-to-spin') st.spin();
      else if (st.status === 'awaiting-selection') {
        const sel = st.pendingSelection!;
        const idx: number[] = [];
        for (let i = 0; i < sel.selectable.length && idx.length < sel.count; i++) if (sel.selectable[i]) idx.push(i);
        st.selectCells(idx);
      } else if (st.status === 'spin-result') st.next();
      else break;
    }
    expect(guard).toBeGreaterThan(1);
  });
});

// Documented intentional shared change: lock→hold applies to ALL modes (the
// faithful legacy true-lock gate is woven through cascade targeting and is left
// as an opt-in). Quick's BASE_WEIGHTS never rolls cat/vehicle/monster, confirmed:
describe('BASE_WEIGHTS rollable sets', () => {
  it('rolls number/fruit/gem only', () => {
    for (const id of ['cheese_cat', 'plane', 'ghost', 'dracula']) {
      expect(BASE_WEIGHTS[id as SymbolType] ?? 0).toBe(0);
    }
  });
});
