import { describe, it, expect } from 'vitest';
import type { Rng } from '@/lib/rng';
import { createGameStore } from '@/store/gameStore';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';

/**
 * Deterministic rng: returns values from a queue, looping forever once exhausted.
 */
function loopingRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

const TOTAL = Object.values(BASE_WEIGHTS).reduce((a, b) => a + b, 0); // 90

// rng value that lands on a given cumulative band midpoint, under BASE_WEIGHTS.
// cherry band: [0,10) -> 0 yields cherry.
// seven band:  [54,58) -> (54+0.5)/90 yields seven.
const RNG_CHERRY = 0;
const RNG_SEVEN = (54 + 0.5) / TOTAL;

describe('startGame', () => {
  it('requires a non-empty nickname', () => {
    const store = createGameStore(loopingRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    store.getState().startGame();
    // nickname still empty -> startGame is a no-op, status stays 'start'.
    expect(store.getState().status).toBe('start');

    store.getState().setNickname('alice');
    store.getState().startGame();
    expect(store.getState().status).toBe('choosing-rule');
  });

  it('offers 4 rules, none equipped', () => {
    const store = createGameStore(loopingRng([0.1, 0.37, 0.62, 0.88, 0.05]));
    store.getState().setNickname('bob');
    store.getState().startGame();

    const { offeredRules, ruleSlots } = store.getState();
    expect(offeredRules).toHaveLength(4);
    // distinct
    const ids = new Set(offeredRules.map((r) => r.id));
    expect(ids.size).toBe(4);
    // none equipped
    expect(ruleSlots).toEqual([null, null, null]);
  });
});

describe('happy path select -> equip -> spin', () => {
  it('produces a spin-result with a SpinLog and updates totals', () => {
    const store = createGameStore(loopingRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    const s = store.getState();
    s.setNickname('carol');
    s.startGame();

    const rule = store.getState().offeredRules[0];
    store.getState().selectRule(rule);
    expect(store.getState().status).toBe('choosing-slot');
    expect(store.getState().pendingRule?.id).toBe(rule.id);

    store.getState().equipToSlot(0);
    expect(store.getState().status).toBe('ready-to-spin');
    expect(store.getState().ruleSlots[0]?.id).toBe(rule.id);
    expect(store.getState().pendingRule).toBeNull();

    store.getState().spin();
    const after = store.getState();
    expect(after.status).toBe('spin-result');
    expect(after.spinLogs).toHaveLength(1);
    expect(after.currentResult).toHaveLength(5);
    expect(after.totalScore).toBe(after.spinLogs[0].roundScore);
  });
});

describe('equipToSlot', () => {
  it('replaces an occupied slot', () => {
    const store = createGameStore(loopingRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    store.getState().setNickname('dave');
    store.getState().startGame();

    const first = store.getState().offeredRules[0];
    const second = store.getState().offeredRules[1];

    store.getState().selectRule(first);
    store.getState().equipToSlot(1);
    expect(store.getState().ruleSlots[1]?.id).toBe(first.id);

    // back to choosing-rule via next() not available here; force a new selection.
    // selectRule requires 'choosing-rule'; we are in 'ready-to-spin'.
    // Simulate the player re-choosing by setting status back.
    store.setState({ status: 'choosing-rule' });
    store.getState().selectRule(second);
    store.getState().equipToSlot(1);
    expect(store.getState().ruleSlots[1]?.id).toBe(second.id);
    expect(store.getState().ruleSlots[1]?.id).not.toBe(first.id);
  });
});

describe('full 5-spin run', () => {
  it('reaches finished with 5 spin logs', () => {
    // rng values chosen to avoid RULE DRAW (two-sevens) so spinIndex advances
    // cleanly each round. All cherries -> Five of a Kind, no rule draw.
    const store = createGameStore(loopingRng([RNG_CHERRY]));
    store.getState().setNickname('erin');
    store.getState().startGame();

    for (let i = 0; i < 5; i++) {
      expect(store.getState().status).toBe('choosing-rule');
      const rule = store.getState().offeredRules[0];
      store.getState().selectRule(rule);
      store.getState().equipToSlot(0);
      store.getState().spin();
      expect(store.getState().status).toBe('spin-result');
      store.getState().next();
    }

    expect(store.getState().status).toBe('finished');
    expect(store.getState().spinLogs).toHaveLength(5);
    expect(store.getState().spinIndex).toBe(5);
  });
});

describe('RULE DRAW', () => {
  // APPROACH: seed the rng so baseSpin yields exactly [seven, seven, cherry,
  // cherry, cherry] under BASE_WEIGHTS (two sevens, zero fours) -> isRuleDraw
  // is true. We equip 'lucky-convert', a transform rule that converts the
  // leftmost zero to seven; with no zeros present it is a no-op AND consumes no
  // rng, so the final result is unchanged and remains a RULE DRAW.
  function seedRuleDrawStore() {
    const rng = loopingRng([RNG_SEVEN, RNG_SEVEN, RNG_CHERRY, RNG_CHERRY, RNG_CHERRY]);
    const store = createGameStore(rng);
    store.getState().setNickname('frank');
    store.getState().startGame();
    store.getState().selectRule(RULES_BY_ID['lucky-convert']);
    store.getState().equipToSlot(0);
    return store;
  }

  it('mid-game RULE DRAW grants an extra rule pick (no spinIndex advance)', () => {
    const store = seedRuleDrawStore();
    // spinIndex 0 of 5 -> not the last spin.
    store.getState().spin();
    const afterSpin = store.getState();
    expect(afterSpin.spinLogs[0].ruleDraw).toBe(true);
    expect(afterSpin.spinLogs[0].finalResult.filter((s) => s === 'seven')).toHaveLength(2);
    expect(afterSpin.extraRulePickCount).toBe(1);

    const spinIndexBefore = afterSpin.spinIndex;
    store.getState().next();
    const afterNext = store.getState();
    // extra pick consumed, spinIndex unchanged, back to choosing-rule.
    expect(afterNext.extraRulePickCount).toBe(0);
    expect(afterNext.spinIndex).toBe(spinIndexBefore);
    expect(afterNext.status).toBe('choosing-rule');
  });

  it('last-spin RULE DRAW adds +150 bonus to roundScore', () => {
    const store = seedRuleDrawStore();
    // Force this to be the final spin.
    store.setState({ spinIndex: store.getState().maxSpins - 1 });
    store.getState().spin();
    const after = store.getState();
    const log = after.spinLogs[after.spinLogs.length - 1];
    expect(log.ruleDraw).toBe(true);
    // handScore for [seven,seven,cherry,cherry,cherry]: positives include both
    // sevens (pair=2) and three cherries (3-of-a-kind) -> Three of a Kind (220).
    // No fours -> penalty 0. roundScore base 220, +150 bonus = 370.
    expect(log.roundScore).toBe(log.handScore - log.penalty + 150);
    expect(after.extraRulePickCount).toBe(0);
  });
});

describe('reset', () => {
  it('preserves nickname and clears spinLogs', () => {
    const store = createGameStore(loopingRng([RNG_CHERRY]));
    store.getState().setNickname('grace');
    store.getState().startGame();
    store.getState().selectRule(store.getState().offeredRules[0]);
    store.getState().equipToSlot(0);
    store.getState().spin();
    expect(store.getState().spinLogs.length).toBeGreaterThan(0);

    store.getState().reset();
    const after = store.getState();
    expect(after.nickname).toBe('grace');
    expect(after.spinLogs).toHaveLength(0);
    expect(after.status).toBe('start');
    expect(after.totalScore).toBe(0);
    expect(after.ruleSlots).toEqual([null, null, null]);
  });
});
