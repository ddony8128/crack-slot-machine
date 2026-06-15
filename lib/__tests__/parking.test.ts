import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { scoreResult } from '@/lib/score';
import { createGameStore } from '@/store/gameStore';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { PARKING_FEE_PER } from '@/data/scoreTable';
import type { Rng } from '@/lib/rng';

function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

function loopingRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

const PREV_ZEROS: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];

const ctxFor = (previousResult: SymbolType[] = PREV_ZEROS, rng: Rng = queuedRng([])) => ({
  previousResult,
  weights: BASE_WEIGHTS,
  rng,
});

describe('vehicle-parking — applyOne flags every vehicle cell into frame.nextHold', () => {
  it('pushes the vehicle indices (no board change, no rng, no events)', () => {
    // vehicles at idx0 (plane), idx2 (ship), idx4 (car); others are fruits.
    const base: SymbolType[] = ['plane', 'cherry', 'ship', 'lemon', 'car'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-parking']], ctxFor());

    expect(frame.nextHold).toEqual([0, 2, 4]);
    // No board change, no rng consumed, no events emitted by the rule itself.
    expect(frame.working).toEqual(base);
    expect(frame.events).toHaveLength(0);
  });

  it('no vehicle on the board -> nextHold stays empty', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-parking']], ctxFor());
    expect(frame.nextHold).toEqual([]);
    expect(frame.working).toEqual(base);
  });
});

describe('beginCascade preHeld — cross-spin hold pass', () => {
  it('holds preHeld cells to previousResult and locks them', () => {
    const prev: SymbolType[] = ['cherry', 'lemon', 'ship', 'grape', 'diamond'];
    // base roll is all sevens; preHeld=[2] holds cell2 to prev[2]='ship'.
    const base: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const frame = beginCascade(base, [], ctxFor(prev), { preHeld: [2] });

    expect(frame.working[2]).toBe(prev[2]); // 'ship'
    expect(frame.locked[2]).toBe(true);
    // Other cells untouched (still the raw roll).
    expect(frame.working[0]).toBe('seven');
    expect(frame.locked[0]).toBe(false);
    // The hold emits a symbol_locked event tagged with 'next-hold'.
    const locks = frame.events.filter((e) => e.type === 'symbol_locked');
    expect(locks).toEqual([
      { type: 'symbol_locked', symbolId: 'ship', index: 2, byRuleId: 'next-hold' },
    ]);
  });
});

describe('scoreResult — 유료 주차 per-vehicle penalty', () => {
  it('subtracts PARKING_FEE_PER × vehicle count when the rule is active', () => {
    // 2 vehicles on the final board (plane + car).
    const board: SymbolType[] = ['plane', 'cherry', 'lemon', 'car', 'grape'];
    const without = scoreResult(board, []);
    const withRule = scoreResult(board, [RULES_BY_ID['vehicle-parking']]);

    const fee = 2 * PARKING_FEE_PER; // 60
    expect(fee).toBe(60);
    expect(withRule.penalty - without.penalty).toBe(fee);
    expect(without.baseRoundScore - withRule.baseRoundScore).toBe(fee);
  });

  it('no vehicles -> no parking penalty even with the rule active', () => {
    const board: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'ruby'];
    const without = scoreResult(board, []);
    const withRule = scoreResult(board, [RULES_BY_ID['vehicle-parking']]);
    expect(withRule.penalty).toBe(without.penalty);
  });
});

describe('store carry — 유료 주차 holds the flagged cells on the NEXT spin', () => {
  it('all-car board flags all 5 cells; next spin holds them at the first roll', () => {
    // Car-only bag: every roll lands 'car' regardless of rng, so the board is
    // deterministic and the parking rule always flags all 5 cells.
    const carOnly = Object.fromEntries(
      (Object.keys(BASE_WEIGHTS) as SymbolType[]).map((k) => [k, k === 'car' ? 1 : 0]),
    ) as Record<SymbolType, number>;

    const store = createGameStore(loopingRng([0]));
    const s = () => store.getState();
    s().setNickname('parking');
    s().configureRun({
      baseWeights: carOnly,
      provisioning: 'fixed',
      rulePoolIds: ['vehicle-parking'],
      maxSpins: 2,
    });
    s().startGame();

    // fixed provisioning -> straight to ready-to-spin with the rule in the bag.
    expect(s().status).toBe('ready-to-spin');
    expect(s().bag.map((r) => r.id)).toEqual(['vehicle-parking']);

    // Drag vehicle-parking into slot 0 so it runs this spin.
    s().moveRule({ zone: 'bag', index: 0 }, { zone: 'slot', index: 0 });
    expect(s().ruleSlots[0]?.id).toBe('vehicle-parking');

    // First spin: all cells are cars -> nextHold flags all 5 cells.
    s().spin();
    expect(s().status).toBe('spin-result');
    const firstFinal = s().spinLogs[0].finalResult;
    expect(firstFinal.every((c) => c === 'car')).toBe(true);
    expect(s().nextHoldCells).toEqual([0, 1, 2, 3, 4]);

    // Advance to the next spin and pull the lever again.
    s().next();
    expect(s().status).toBe('ready-to-spin');
    s().spin();
    expect(s().status).toBe('spin-result');

    // The held cells are locked at the first roll of the 2nd spin: its baseResult
    // is fully held (every cell = previousResult = the 1st final board = cars),
    // and all 5 cells show as locked in the reveal's first step.
    const secondLog = s().spinLogs[1];
    expect(secondLog.baseResult).toEqual(firstFinal);
    expect(secondLog.lockedCells).toEqual([true, true, true, true, true]);

    // The carry is consumed/replaced: the 2nd spin re-flags all 5 cars again.
    expect(s().nextHoldCells).toEqual([0, 1, 2, 3, 4]);
  });
});
