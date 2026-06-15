import { describe, it, expect } from 'vitest';
import type { Rule } from '@/types';
import { createSeededRng } from '@/lib/rng';
import {
  createGameStore,
  effectiveSlots,
  type GameStore,
  type RecordedAction,
  type RunConfig,
} from '@/store/gameStore';
import { RULES_BY_ID } from '@/data/rules';
import type { StoreApi } from 'zustand/vanilla';

type S = StoreApi<GameStore>;

const r = (id: string): Rule => {
  const rule = RULES_BY_ID[id];
  if (!rule) throw new Error(`missing rule ${id}`);
  return rule;
};

describe('effectiveSlots (콩의 가호 helper)', () => {
  const slot0 = r('seven-fever');
  const slot1 = r('seven-double');
  const slot2 = r('first-cherry');

  it('with bean-blessing + slot1 set → 6 elements, slot1 duplicated at index 1 & 2', () => {
    const slots = [slot0, slot1, slot2, null, null];
    const out = effectiveSlots(slots, ['bean-blessing']);
    expect(out).toHaveLength(6);
    expect(out[0]).toBe(slot0);
    expect(out[1]).toBe(slot1);
    expect(out[2]).toBe(slot1); // duplicated right after itself
    expect(out[3]).toBe(slot2);
    expect(out[4]).toBeNull();
    expect(out[5]).toBeNull();
  });

  it('without the artifact → unchanged (same array reference, 5 elements)', () => {
    const slots = [slot0, slot1, slot2, null, null];
    const out = effectiveSlots(slots, ['time-capsule']);
    expect(out).toBe(slots);
    expect(out).toHaveLength(5);
  });

  it('no artifacts arg → unchanged', () => {
    const slots = [slot0, slot1, slot2, null, null];
    expect(effectiveSlots(slots)).toBe(slots);
  });

  it('slot1 null → unchanged even with the artifact (no-op)', () => {
    const slots = [slot0, null, slot2, null, null];
    const out = effectiveSlots(slots, ['bean-blessing']);
    expect(out).toBe(slots);
    expect(out).toHaveLength(5);
  });
});

/**
 * Drive the real store: pick offered rules into specific slots, then spin, taking
 * the first selectable cell on any pause. Records nothing extra — uses the public
 * store API exactly like a player would, so the action log replays faithfully.
 */
function arrangeAndSpin(store: S, slotPlan: (string | null)[]): void {
  const s = () => store.getState();
  // Place each desired rule into its slot. We over-pick from offers each turn is
  // not possible (1 pick/turn), so instead we exploit fixed provisioning below.
  // (Callers use a 'fixed' config so all rules are pre-bagged.)
  for (let i = 0; i < slotPlan.length; i++) {
    const id = slotPlan[i];
    if (id == null) continue;
    const bagIdx = s().bag.findIndex((rule) => rule.id === id);
    expect(bagIdx, `rule ${id} must be in the bag`).toBeGreaterThanOrEqual(0);
    s().moveRule({ zone: 'bag', index: bagIdx }, { zone: 'slot', index: i });
  }
  expect(s().status).toBe('ready-to-spin');
  s().spin();
  // Resolve any select pauses by taking the first `count` selectable cells.
  let guard = 0;
  while (s().status === 'awaiting-selection' && guard++ < 20) {
    const sel = s().pendingSelection!;
    const picks: number[] = [];
    for (let i = 0; i < sel.selectable.length && picks.length < sel.count; i++) {
      if (sel.selectable[i]) picks.push(i);
    }
    s().selectCells(picks);
  }
  expect(s().status).toBe('spin-result');
}

/** A fixed-provisioning run so we control which rules sit in which slot. */
function fixedConfig(ruleIds: string[], artifacts?: string[]): RunConfig {
  return {
    provisioning: 'fixed',
    rulePoolIds: ruleIds,
    // numberSpecials OFF so the 4×/0-extra specials don't perturb the delta.
    numberSpecials: { four: false, zero: false },
    ...(artifacts ? { artifacts } : {}),
  };
}

function startFixed(seed: string, config: RunConfig): S {
  const store = createGameStore(createSeededRng(seed));
  store.getState().setNickname('bean');
  store.getState().configureRun(config);
  store.getState().startGame();
  return store;
}

describe('콩의 가호 store run — slot 1 is applied twice', () => {
  const SEED = 'bean-blessing-seed';
  // SEVEN FEVER (weight, slot 0) tilts the bag heavily toward 7 so the board
  // reliably lands at least one 7 → SEVEN DOUBLE in slot 1 has something to double.
  const RULE_IDS = ['seven-fever', 'seven-double'];

  it('doubles SEVEN DOUBLE\'s effect (×4 sevens vs ×2 without the artifact)', () => {
    const without = startFixed(SEED, fixedConfig(RULE_IDS));
    arrangeAndSpin(without, ['seven-fever', 'seven-double']);
    const logWithout = without.getState().spinLogs[0];

    const withArt = startFixed(SEED, fixedConfig(RULE_IDS, ['bean-blessing']));
    arrangeAndSpin(withArt, ['seven-fever', 'seven-double']);
    const logWith = withArt.getState().spinLogs[0];

    // Same seed + same slot layout → identical roll/board (the duplicated slot 1
    // is a SCORE rule, so it consumes no rng and the board is byte-identical).
    expect(logWith.finalResult).toEqual(logWithout.finalResult);

    // The board must actually contain a 7 for the doubling to be observable.
    const sevens = logWithout.finalResult.filter((s) => s === 'seven').length;
    expect(sevens).toBeGreaterThanOrEqual(1);

    // Without: one seven-double → seven portion ×2. With bean-blessing: slot 1 is
    // duplicated → two seven-double occurrences → seven portion ×4. So the WITH
    // sevenScore is exactly double the WITHOUT sevenScore.
    expect(logWithout.sevenScore).toBeGreaterThan(0);
    expect(logWith.sevenScore).toBe(logWithout.sevenScore * 2);
    // And the extra seven points flow straight into the round score.
    expect(logWith.roundScore - logWithout.roundScore).toBe(logWithout.sevenScore);
  });

  it('a board rule in slot 1 records its STEP twice (first-cherry)', () => {
    // FIRST CHERRY (transform) in slot 1: applying twice is idempotent on the
    // board, but the cascade records TWO steps for it under bean-blessing.
    const cfg = fixedConfig(['first-cherry'], ['bean-blessing']);
    const store = startFixed('bean-cherry-seed', cfg);
    arrangeAndSpin(store, [null, 'first-cherry']);
    const log = store.getState().spinLogs[0];
    const cherrySteps = log.steps.filter((st) => st.label === r('first-cherry').name);
    expect(cherrySteps).toHaveLength(2);
    expect(log.finalResult[0]).toBe('cherry');
  });
});

describe('콩의 가호 determinism', () => {
  it('two identical runs (seed + config + actions) produce identical totalScore', () => {
    const cfg = fixedConfig(['seven-fever', 'seven-double'], ['bean-blessing']);
    const a = startFixed('det-seed', cfg);
    arrangeAndSpin(a, ['seven-fever', 'seven-double']);
    const b = startFixed('det-seed', cfg);
    arrangeAndSpin(b, ['seven-fever', 'seven-double']);
    expect(a.getState().totalScore).toBe(b.getState().totalScore);
    expect(a.getState().spinLogs[0].finalResult).toEqual(
      b.getState().spinLogs[0].finalResult,
    );

    // Replay-style determinism: the same recorded actions on the same seed+config
    // reproduce the live totalScore byte-for-byte.
    const actions: RecordedAction[] = a.getState().getActions();
    const replay = createGameStore(createSeededRng('det-seed'));
    replay.getState().setNickname('bean');
    replay.getState().configureRun(cfg);
    replay.getState().startGame();
    for (const action of actions) {
      const st = replay.getState();
      switch (action.type) {
        case 'moveRule':
          st.moveRule(action.from, action.to);
          break;
        case 'spin':
          st.spin();
          break;
        case 'selectCells':
          st.selectCells(action.indices);
          break;
        case 'next':
          st.next();
          break;
        case 'selectRule':
          st.selectRule(r(action.ruleId));
          break;
        case 'cancelSelection':
          st.cancelSelection();
          break;
        case 'placePending':
          st.placePending(action.target);
          break;
      }
    }
    expect(replay.getState().totalScore).toBe(a.getState().totalScore);
  });
});

describe('콩의 가호 regression — no artifact scores identically to before', () => {
  it('a run WITHOUT bean-blessing is a strict no-op (effectiveSlots returns input)', () => {
    const cfg = fixedConfig(['seven-fever', 'seven-double']);
    // The effectiveSlots no-op means a non-artifact run is unchanged: same seed +
    // layout twice yields the identical score, and the slot list is untouched.
    const a = startFixed('regress-seed', cfg);
    arrangeAndSpin(a, ['seven-fever', 'seven-double']);
    const b = startFixed('regress-seed', cfg);
    arrangeAndSpin(b, ['seven-fever', 'seven-double']);
    expect(a.getState().totalScore).toBe(b.getState().totalScore);
    expect(a.getState().spinLogs[0]).toEqual(b.getState().spinLogs[0]);
    // ruleSlots stays the canonical 5-slot array (no duplication leaked into UI).
    expect(a.getState().ruleSlots).toHaveLength(5);
  });
});
