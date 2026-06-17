import { describe, it, expect } from 'vitest';
import type { EngineEvent, SymbolType } from '@/types';
import { beginCascade, resolveSelection } from '@/lib/cascade';
import { scoreResult } from '@/lib/score';
import { createGameStore } from '@/store/gameStore';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { PARKING_FEE_PER } from '@/data/scoreTable';
import type { Rng } from '@/lib/rng';

/** Build the symbol_held event list 유료 주차 emits for `count` held cells (so the
 *  score helper sees an EVENT-based fee without driving a full cascade). */
function heldEvents(count: number): EngineEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'symbol_held' as const,
    symbolId: 'car' as SymbolType,
    index: i,
    byRuleId: 'vehicle-parking',
  }));
}

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

describe('vehicle-parking — PLAYER picks 원하는 2칸 vehicle cells; resolveSelection flags nextHold', () => {
  it('pauses for the pick; count = min(2, #vehicles); selectable = vehicle cells only', () => {
    // vehicles at idx0 (plane), idx2 (ship), idx4 (car); others are fruits.
    const base: SymbolType[] = ['plane', 'cherry', 'ship', 'lemon', 'car'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-parking']], ctxFor());

    expect(frame.pending?.kind).toBe('park');
    expect(frame.pending?.count).toBe(2); // min(2, 3 vehicles)
    expect(frame.pending?.selectable).toEqual([true, false, true, false, true]);
    expect(frame.done).toBe(false);
  });

  it('the two chosen cells land in nextHold + emit symbol_held events (no board change)', () => {
    const base: SymbolType[] = ['plane', 'cherry', 'ship', 'lemon', 'car'];
    const rules = [RULES_BY_ID['vehicle-parking']];
    let frame = beginCascade(base, rules, ctxFor());
    frame = resolveSelection(frame, rules, ctxFor(), [0, 4]); // pick plane + car

    expect(frame.done).toBe(true);
    expect(frame.nextHold).toEqual([0, 4]);
    expect(frame.working).toEqual(base); // 유료 주차 makes no board change
    const held = frame.events.filter((e) => e.type === 'symbol_held');
    expect(held).toEqual([
      { type: 'symbol_held', symbolId: 'plane', index: 0, byRuleId: 'vehicle-parking' },
      { type: 'symbol_held', symbolId: 'car', index: 4, byRuleId: 'vehicle-parking' },
    ]);
  });

  it('a single vehicle -> count 1, one held cell', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'ship', 'diamond', 'seven'];
    const rules = [RULES_BY_ID['vehicle-parking']];
    let frame = beginCascade(base, rules, ctxFor());
    expect(frame.pending?.count).toBe(1);
    frame = resolveSelection(frame, rules, ctxFor(), [2]);
    expect(frame.nextHold).toEqual([2]);
    expect(frame.events.filter((e) => e.type === 'symbol_held')).toHaveLength(1);
  });

  it('AUTO-SKIPS (no pause) when no vehicle is on the board', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'grape', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vehicle-parking']], ctxFor());
    expect(frame.pending).toBeNull();
    expect(frame.done).toBe(true);
    expect(frame.nextHold).toEqual([]);
    expect(frame.working).toEqual(base);
    expect(frame.steps.some((s) => s.label.includes('건너뜀'))).toBe(true);
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

describe('scoreResult — 유료 주차 per-held-cell penalty (EVENT-based)', () => {
  it('subtracts PARKING_FEE_PER × symbol_held count', () => {
    // 2 held cells -> 2 symbol_held events -> fee 60. Board content is irrelevant
    // now: the fee tracks the player's pick (events), not the final board.
    const board: SymbolType[] = ['plane', 'cherry', 'lemon', 'car', 'grape'];
    const without = scoreResult(board, [], []);
    const withEvents = scoreResult(board, [], heldEvents(2));

    const fee = 2 * PARKING_FEE_PER; // 60
    expect(fee).toBe(60);
    expect(withEvents.penalty - without.penalty).toBe(fee);
    expect(without.baseRoundScore - withEvents.baseRoundScore).toBe(fee);
  });

  it('no symbol_held events -> no parking penalty (even with vehicles on the board)', () => {
    const board: SymbolType[] = ['plane', 'cherry', 'lemon', 'car', 'grape'];
    const without = scoreResult(board, [], []);
    const withRuleNoHolds = scoreResult(board, [RULES_BY_ID['vehicle-parking']], []);
    expect(withRuleNoHolds.penalty).toBe(without.penalty);
  });
});

describe('store carry — 유료 주차 holds the PLAYER-PICKED cells on the NEXT spin', () => {
  it('all-car board: player picks 2 cells; only those are held at the next first roll', () => {
    // Car-only bag: every roll lands 'car' regardless of rng, so the board is
    // deterministic and the parking rule always offers all 5 cells. The player
    // keeps 원하는 2칸 of them (count = min(2, 5) = 2).
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

    // First spin: all cells are cars -> the select rule PAUSES for the pick.
    s().spin();
    expect(s().status).toBe('awaiting-selection');
    const sel = s().pendingSelection!;
    expect(sel.kind).toBe('park');
    expect(sel.count).toBe(2); // min(2, 5 cars)
    expect(sel.selectable).toEqual([true, true, true, true, true]);

    // Player keeps 원하는 2칸 — cells 1 and 3 carry to the next spin.
    s().selectCells([1, 3]);
    expect(s().status).toBe('spin-result');
    const firstFinal = s().spinLogs[0].finalResult;
    expect(firstFinal.every((c) => c === 'car')).toBe(true);
    expect(s().nextHoldCells).toEqual([1, 3]);
    // EVENT-based fee: 2 held cells -> -60.
    expect(s().spinLogs[0].penalty).toBe(2 * PARKING_FEE_PER);

    // Advance to the next spin and pull the lever again.
    s().next();
    expect(s().status).toBe('ready-to-spin');
    s().spin();
    // 2nd spin also pauses for its own parking pick.
    expect(s().status).toBe('awaiting-selection');

    // Resolve the 2nd spin's parking pick to finish.
    s().selectCells([0, 2]);
    expect(s().status).toBe('spin-result');
    const secondLog = s().spinLogs[1];
    expect(secondLog.baseResult).toEqual(firstFinal); // every cell rolled car anyway
    // Only cells 1 and 3 were held at the first roll of the 2nd spin (the carry
    // from the 1st spin's pick), shown locked in the committed log.
    expect(secondLog.lockedCells).toEqual([false, true, false, true, false]);
    // The carry is replaced by the 2nd spin's own pick (cells 0 and 2).
    expect(s().nextHoldCells).toEqual([0, 2]);
  });
});
