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

// Symbol bands under BASE_WEIGHTS (all weight 1, total 9), in insertion order:
// cherry[0,1) lemon[1,2) grape[2,3) diamond[3,4) ruby[4,5) sapphire[5,6)
// seven[6,7) zero[7,8) four[8,9). rng*9 picks the band.
const TOTAL = Object.values(BASE_WEIGHTS).reduce((a, b) => a + b, 0); // 9
const RNG_CHERRY = 0;
const RNG_SEVEN = (6 + 0.5) / TOTAL;
const RNG_ZERO = (7 + 0.5) / TOTAL;

describe('startGame', () => {
  it('requires a non-empty nickname', () => {
    const store = createGameStore(loopingRng([0.1, 0.2, 0.3]));
    store.getState().startGame();
    expect(store.getState().status).toBe('start');

    store.getState().setNickname('alice');
    store.getState().startGame();
    expect(store.getState().status).toBe('choosing-rule');
  });

  it('inits 5 empty slots, empty bag, 3 distinct offers, maxSpins 7', () => {
    const store = createGameStore(loopingRng([0.1, 0.37, 0.62, 0.88, 0.05]));
    store.getState().setNickname('bob');
    store.getState().startGame();

    const s = store.getState();
    expect(s.ruleSlots).toEqual([null, null, null, null, null]);
    expect(s.bag).toEqual([]);
    expect(s.maxSpins).toBe(7);
    expect(s.nextMultiplier).toBe(1);
    expect(s.offeredRules).toHaveLength(3);
    expect(new Set(s.offeredRules.map((r) => r.id)).size).toBe(3);
  });
});

describe('selectRule / placePending', () => {
  function started() {
    const store = createGameStore(loopingRng([0.1, 0.2, 0.3]));
    store.getState().setNickname('carol');
    store.getState().startGame();
    return store;
  }

  it('selectRule moves to placing with pendingRule set', () => {
    const store = started();
    const rule = store.getState().offeredRules[0];
    store.getState().selectRule(rule);
    expect(store.getState().status).toBe('placing');
    expect(store.getState().pendingRule?.id).toBe(rule.id);
  });

  it('placePending into a slot lands the rule and clears pending', () => {
    const store = started();
    const rule = store.getState().offeredRules[0];
    store.getState().selectRule(rule);
    store.getState().placePending({ type: 'slot', index: 2 });
    const s = store.getState();
    expect(s.ruleSlots[2]?.id).toBe(rule.id);
    expect(s.pendingRule).toBeNull();
    expect(s.status).toBe('ready-to-spin');
  });

  it('placePending into the bag appends and clears pending', () => {
    const store = started();
    const rule = store.getState().offeredRules[0];
    store.getState().selectRule(rule);
    store.getState().placePending({ type: 'bag' });
    const s = store.getState();
    expect(s.bag.map((r) => r.id)).toEqual([rule.id]);
    expect(s.ruleSlots).toEqual([null, null, null, null, null]);
    expect(s.status).toBe('ready-to-spin');
  });

  it('placePending into an occupied slot displaces occupant to bag', () => {
    const store = started();
    const first = store.getState().offeredRules[0];
    store.getState().selectRule(first);
    store.getState().placePending({ type: 'slot', index: 1 });

    store.setState({ status: 'choosing-rule' });
    const second = store.getState().offeredRules[1];
    store.getState().selectRule(second);
    store.getState().placePending({ type: 'slot', index: 1 });

    const s = store.getState();
    expect(s.ruleSlots[1]?.id).toBe(second.id);
    expect(s.bag.map((r) => r.id)).toEqual([first.id]);
  });

  it('cancelSelection returns to choosing-rule', () => {
    const store = started();
    store.getState().selectRule(store.getState().offeredRules[0]);
    store.getState().cancelSelection();
    expect(store.getState().status).toBe('choosing-rule');
    expect(store.getState().pendingRule).toBeNull();
  });
});

describe('moveRule', () => {
  function withTwoSlotted() {
    const store = createGameStore(loopingRng([0.1, 0.2, 0.3]));
    store.getState().setNickname('dave');
    store.getState().startGame();
    const a = store.getState().offeredRules[0];
    store.getState().selectRule(a);
    store.getState().placePending({ type: 'slot', index: 0 });
    store.setState({ status: 'choosing-rule' });
    const b = store.getState().offeredRules[1];
    store.getState().selectRule(b);
    store.getState().placePending({ type: 'slot', index: 1 });
    return { store, a, b };
  }

  it('slot <-> slot swaps', () => {
    const { store, a, b } = withTwoSlotted();
    store.getState().moveRule({ zone: 'slot', index: 0 }, { zone: 'slot', index: 1 });
    const s = store.getState();
    expect(s.ruleSlots[0]?.id).toBe(b.id);
    expect(s.ruleSlots[1]?.id).toBe(a.id);
  });

  it('slot -> bag clears the slot and inserts into bag', () => {
    const { store, a } = withTwoSlotted();
    store.getState().moveRule({ zone: 'slot', index: 0 }, { zone: 'bag', index: 0 });
    const s = store.getState();
    expect(s.ruleSlots[0]).toBeNull();
    expect(s.bag.map((r) => r.id)).toEqual([a.id]);
  });

  it('bag -> slot places (occupant -> bag if occupied)', () => {
    const { store, a, b } = withTwoSlotted();
    // move slot 0 (a) into bag first
    store.getState().moveRule({ zone: 'slot', index: 0 }, { zone: 'bag', index: 0 });
    // now bag = [a], slot1 = b. Move bag[0]=a into slot 1 -> b displaced to bag.
    store.getState().moveRule({ zone: 'bag', index: 0 }, { zone: 'slot', index: 1 });
    const s = store.getState();
    expect(s.ruleSlots[1]?.id).toBe(a.id);
    expect(s.bag.map((r) => r.id)).toEqual([b.id]);
  });
});

describe('spin', () => {
  it('produces a SpinLog and applies nextMultiplier to roundScore', () => {
    const store = createGameStore(loopingRng([RNG_CHERRY]));
    store.getState().setNickname('erin');
    store.getState().startGame();
    const rule = store.getState().offeredRules[0];
    store.getState().selectRule(rule);
    store.getState().placePending({ type: 'bag' }); // keep slots empty (deterministic)

    // Force a x3 multiplier for this spin.
    store.setState({ nextMultiplier: 3, status: 'ready-to-spin' });
    store.getState().spin();

    const s = store.getState();
    expect(s.status).toBe('spin-result');
    expect(s.spinLogs).toHaveLength(1);
    const log = s.spinLogs[0];
    expect(log.multiplier).toBe(3);
    expect(log.roundScore).toBe(log.baseRoundScore * 3);
    expect(s.totalScore).toBe(log.roundScore);
    expect(s.currentResult).toHaveLength(5);
    // all cherries -> Five of a Kind
    expect(log.finalResult.every((c) => c === 'cherry')).toBe(true);
  });

  it('SpinLog.baseResult reflects pre-roll held cells (last-lock holds cell4)', () => {
    // All rolls are cherry; last-lock holds cell4 at the previous spin value.
    const store = createGameStore(loopingRng([RNG_CHERRY]));
    store.getState().setNickname('liz');
    store.getState().startGame();
    store.getState().selectRule(RULES_BY_ID['last-lock']);
    store.getState().placePending({ type: 'slot', index: 0 });

    // Seed a distinct previous value on cell4 to observe the hold.
    store.setState({
      previousResult: ['lemon', 'lemon', 'lemon', 'lemon', 'sapphire'],
      status: 'ready-to-spin',
    });
    store.getState().spin();

    const log = store.getState().spinLogs[0];
    // Held cell4 = previousResult[4]; others = the rolled base (cherry).
    expect(log.baseResult[4]).toBe('sapphire');
    expect(log.finalResult[4]).toBe('sapphire');
    expect(log.baseResult[0]).toBe('cherry');
    expect(log.lockedCells[4]).toBe(true);
  });

  it('detects zeros>=3 -> extraRulePickCount, consumed by next() w/o advancing spinIndex', () => {
    // Empty slots: spin draws 5 zeros, no post-roll rules -> zeroDraw, mult 1.
    const store = createGameStore(loopingRng([RNG_ZERO]));
    store.getState().setNickname('frank');
    store.getState().startGame();
    const rule = store.getState().offeredRules[0];
    store.getState().selectRule(rule);
    store.getState().placePending({ type: 'bag' });

    store.getState().spin();
    const afterSpin = store.getState();
    const log = afterSpin.spinLogs[0];
    expect(log.finalResult.filter((c) => c === 'zero')).toHaveLength(5);
    expect(log.zeroDraw).toBe(true);
    expect(afterSpin.extraRulePickCount).toBe(1);
    expect(afterSpin.nextMultiplier).toBe(1);

    const spinIndexBefore = afterSpin.spinIndex;
    store.getState().next();
    const afterNext = store.getState();
    expect(afterNext.extraRulePickCount).toBe(0);
    expect(afterNext.spinIndex).toBe(spinIndexBefore);
    expect(afterNext.status).toBe('choosing-rule');
  });
});

describe('full 7-spin run', () => {
  it('reaches finished with 7 spin logs', () => {
    // All cherries (RNG_CHERRY), no zeros special -> spinIndex advances cleanly.
    const store = createGameStore(loopingRng([RNG_CHERRY]));
    store.getState().setNickname('grace');
    store.getState().startGame();

    for (let i = 0; i < 7; i++) {
      expect(store.getState().status).toBe('choosing-rule');
      const rule = store.getState().offeredRules[0];
      store.getState().selectRule(rule);
      store.getState().placePending({ type: 'bag' });
      store.getState().spin();
      expect(store.getState().status).toBe('spin-result');
      store.getState().next();
    }

    const s = store.getState();
    expect(s.status).toBe('finished');
    expect(s.spinLogs).toHaveLength(7);
    expect(s.spinIndex).toBe(7);
  });
});

describe('multiplier carry-over', () => {
  it('uses RULES_BY_ID seven-double without crashing and resets next multiplier to 1', () => {
    const store = createGameStore(loopingRng([RNG_SEVEN]));
    store.getState().setNickname('heidi');
    store.getState().startGame();
    store.getState().selectRule(RULES_BY_ID['seven-double']);
    store.getState().placePending({ type: 'slot', index: 0 });
    store.getState().spin();
    const log = store.getState().spinLogs[0];
    // five sevens -> sevenScore 777, doubled = 1554.
    expect(log.sevenScore).toBe(1554);
    // no fours -> next multiplier resets to 1.
    expect(store.getState().nextMultiplier).toBe(1);
  });
});

describe('interactive select rules', () => {
  function readyWithRule(ruleId: string, rng: Rng) {
    const store = createGameStore(rng);
    store.getState().setNickname('select');
    store.getState().startGame();
    store.getState().selectRule(RULES_BY_ID[ruleId]);
    store.getState().placePending({ type: 'slot', index: 0 });
    return store;
  }

  it('spin() pauses at a select rule with the right pendingSelection', () => {
    const store = readyWithRule('select-swap', loopingRng([RNG_CHERRY]));
    store.getState().spin();
    const s = store.getState();
    expect(s.status).toBe('awaiting-selection');
    expect(s.pendingSelection?.kind).toBe('swap');
    expect(s.pendingSelection?.count).toBe(2);
    // all cells unclaimed -> all selectable.
    expect(s.pendingSelection?.selectable).toEqual([true, true, true, true, true]);
    // partial board shown.
    expect(s.currentResult).toHaveLength(5);
    // no log yet.
    expect(s.spinLogs).toHaveLength(0);
  });

  it('select-copy: count 1, cell0 not selectable, selectCells resolves to spin-result', () => {
    // seed previous so we can verify; all rolls cherry except we want distinct.
    const store = readyWithRule('select-copy', loopingRng([RNG_CHERRY]));
    store.getState().spin();
    let s = store.getState();
    expect(s.status).toBe('awaiting-selection');
    expect(s.pendingSelection?.kind).toBe('copy');
    expect(s.pendingSelection?.count).toBe(1);
    expect(s.pendingSelection?.selectable[0]).toBe(false);

    store.getState().selectCells([3]);
    s = store.getState();
    expect(s.status).toBe('spin-result');
    expect(s.spinLogs).toHaveLength(1);
    // all cherries -> cell3 = cell2 = cherry (still cherry).
    expect(s.spinLogs[0].finalResult[3]).toBe('cherry');
    expect(s.spinLogs[0].interactive).toBe(true);
  });

  it('select-swap swaps the two chosen cells and finalizes', () => {
    // Distinct, deterministic board via per-reel bands. The exact symbols depend
    // on rng phase (offer shuffle + roll both draw), so we assert the SWAP
    // RELATION against the pre-swap board rather than hard-coded symbols.
    const TOT = TOTAL;
    const band = (k: number) => (k + 0.5) / TOT;
    const rng: Rng = loopingRng([band(0), band(1), band(2), band(3), band(4)]);
    const store = readyWithRule('select-swap', rng);
    store.getState().spin();
    expect(store.getState().status).toBe('awaiting-selection');
    const before = [...store.getState().currentResult];

    store.getState().selectCells([0, 4]);
    const s = store.getState();
    expect(s.status).toBe('spin-result');
    const fr = s.spinLogs[0].finalResult;
    // cells 0 and 4 swapped; the middle three unchanged.
    expect(fr[0]).toBe(before[4]);
    expect(fr[4]).toBe(before[0]);
    expect(fr.slice(1, 4)).toEqual(before.slice(1, 4));
    expect(s.spinLogs[0].interactive).toBe(true);
  });

  it('rejects invalid selectCells (wrong count / non-selectable)', () => {
    const store = readyWithRule('select-copy', loopingRng([RNG_CHERRY]));
    store.getState().spin();
    // wrong count
    store.getState().selectCells([1, 2]);
    expect(store.getState().status).toBe('awaiting-selection');
    // non-selectable (cell0 not allowed for copy)
    store.getState().selectCells([0]);
    expect(store.getState().status).toBe('awaiting-selection');
    // valid
    store.getState().selectCells([2]);
    expect(store.getState().status).toBe('spin-result');
  });

  it('a normal spin (no select rule) sets log.interactive === false', () => {
    const store = createGameStore(loopingRng([RNG_CHERRY]));
    store.getState().setNickname('plain');
    store.getState().startGame();
    store.getState().selectRule(store.getState().offeredRules[0]);
    store.getState().placePending({ type: 'bag' });
    store.getState().spin();
    const s = store.getState();
    expect(s.status).toBe('spin-result');
    expect(s.spinLogs[0].interactive).toBe(false);
  });
});

describe('reset', () => {
  it('preserves nickname and clears state', () => {
    const store = createGameStore(loopingRng([RNG_CHERRY]));
    store.getState().setNickname('ivan');
    store.getState().startGame();
    store.getState().selectRule(store.getState().offeredRules[0]);
    store.getState().placePending({ type: 'bag' });
    store.getState().spin();
    expect(store.getState().spinLogs.length).toBeGreaterThan(0);

    store.getState().reset();
    const after = store.getState();
    expect(after.nickname).toBe('ivan');
    expect(after.spinLogs).toHaveLength(0);
    expect(after.status).toBe('start');
    expect(after.totalScore).toBe(0);
    expect(after.bag).toEqual([]);
    expect(after.ruleSlots).toEqual([null, null, null, null, null]);
  });
});
