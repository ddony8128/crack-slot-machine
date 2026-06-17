import { describe, it, expect } from 'vitest';
import {
  initialSpireState,
  applyInitialSetChoice,
  buySymbolIncrement,
  buySymbolSet,
  buyRule,
  buyHandFlat,
  buyHandDouble,
  buySetBonus,
  listUpgradeableSetBonuses,
  rerollShop,
  settleClear,
  settleFail,
  pickSetRules,
  addRulesToPool,
  assertBag20,
  bagTotal,
  SPIRE_UPGRADEABLE_HANDS,
  type SpireRunState,
} from '@/lib/spire/state';
import {
  SPIRE_BAG_TOTAL,
  SPIRE_BASE_RULE_IDS,
  SPIRE_RULE_POOL_MAX,
  SPIRE_FAIL_SUPPORT,
} from '@/lib/spire/config';

const SEED = 'seed-1';

/** Deep snapshot used to assert reducers never mutate their input. */
function snapshot(state: SpireRunState): string {
  return JSON.stringify(state);
}

/** A state whose rule pool is already at the cap, for overflow tests. */
function poolAtCap(): SpireRunState {
  const s = initialSpireState(SEED);
  // base 8 + 2 filler = 10
  return { ...s, rulePool: [...s.rulePool, 'filler-a', 'filler-b'] };
}

describe('initialSpireState', () => {
  it('has the spec starting shape (bag 20, pool 8, money 0)', () => {
    const s = initialSpireState(SEED);
    expect(s.seed).toBe(SEED);
    expect(s.currentStage).toBe(1);
    expect(s.currentStageAttempt).toBe(1);
    expect(s.failures).toBe(0);
    expect(s.money).toBe(0);
    expect(s.totalRunScore).toBe(0);
    expect(s.ownedSetIds).toEqual(['number']);
    expect(s.rulePool).toEqual([...SPIRE_BASE_RULE_IDS]);
    expect(s.rulePool).toHaveLength(8);
    expect(s.artifacts).toEqual([]);
    expect(s.handUpgrades).toEqual({});
    expect(bagTotal(s.symbolBag)).toBe(SPIRE_BAG_TOTAL);
    expect(s.symbolBag).toEqual({ zero: 12, four: 5, seven: 3 });
  });

  it('returns independent bag/pool objects per call', () => {
    const a = initialSpireState(SEED);
    const b = initialSpireState(SEED);
    a.symbolBag.zero = 99;
    a.rulePool.push('x');
    expect(b.symbolBag.zero).toBe(12);
    expect(b.rulePool).toHaveLength(8);
  });
});

describe('helpers', () => {
  it('bagTotal / assertBag20', () => {
    expect(bagTotal({ zero: 12, four: 5, seven: 3 })).toBe(20);
    expect(() => assertBag20({ zero: 12, four: 5, seven: 3 })).not.toThrow();
    expect(() => assertBag20({ zero: 1 })).toThrow();
  });

  it('pickSetRules is deterministic for a fixed seed/salt and excludes pool ids', () => {
    const gained = pickSetRules('fruit', SPIRE_BASE_RULE_IDS, SEED, 'set-rules:fruit');
    expect(gained).toEqual(['fruit-vitamin', 'fruit-freeze']);
    // exclude already-owned: pool already has fruit-vitamin → only 3 candidates,
    // still returns 2 distinct, none equal to the excluded id.
    const gained2 = pickSetRules(
      'fruit',
      [...SPIRE_BASE_RULE_IDS, 'fruit-vitamin'],
      SEED,
      'set-rules:fruit',
    );
    expect(gained2).toHaveLength(2);
    expect(gained2).not.toContain('fruit-vitamin');
  });

  it('pickSetRules returns fewer than 2 when candidates are scarce', () => {
    const allFruit = ['fruit-surge', 'first-cherry', 'fruit-freeze', 'fruit-fish', 'fruit-vitamin'];
    expect(pickSetRules('fruit', allFruit, SEED, 'x')).toEqual([]);
    expect(
      pickSetRules('fruit', allFruit.slice(0, 4), SEED, 'x'),
    ).toEqual(['fruit-vitamin']);
    expect(pickSetRules('does-not-exist', [], SEED, 'x')).toEqual([]);
  });

  it('addRulesToPool appends, dedups, and enforces the cap', () => {
    const r = addRulesToPool(['a', 'b'], ['c', 'b'], []);
    expect(r.ok && r.pool).toEqual(['a', 'b', 'c']); // 'b' dup skipped

    // overflow without removal → error
    const cap = Array.from({ length: SPIRE_RULE_POOL_MAX }, (_, i) => `r${i}`);
    const over = addRulesToPool(cap, ['new'], []);
    expect(over.ok).toBe(false);

    // overflow WITH removal of an existing id → ok at exactly 10
    const ok = addRulesToPool(cap, ['new'], ['r0']);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.pool).toHaveLength(SPIRE_RULE_POOL_MAX);
      expect(ok.pool).not.toContain('r0');
      expect(ok.pool).toContain('new');
    }
  });

  it('addRulesToPool rejects removing a non-existent or just-added rule', () => {
    expect(addRulesToPool(['a'], ['b'], ['nope']).ok).toBe(false);
    expect(addRulesToPool(['a'], ['b'], ['b']).ok).toBe(false); // removing the new one
  });
});

describe('applyInitialSetChoice', () => {
  it('fruit: bag.zero 9, +3 fruit symbols, pool 10, gained deterministic, bag 20', () => {
    const s = initialSpireState(SEED);
    const before = snapshot(s);
    const r = applyInitialSetChoice(s, 'fruit');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.symbolBag.zero).toBe(9);
    expect(r.state.symbolBag.cherry).toBe(1);
    expect(r.state.symbolBag.lemon).toBe(1);
    expect(r.state.symbolBag.grape).toBe(1);
    expect(bagTotal(r.state.symbolBag)).toBe(20);
    expect(r.state.rulePool).toHaveLength(10);
    expect(r.breakdown.gainedRuleIds).toEqual(['fruit-vitamin', 'fruit-freeze']);
    expect(r.state.rulePool.slice(-2)).toEqual(['fruit-vitamin', 'fruit-freeze']);
    expect(r.state.ownedSetIds).toEqual(['number', 'fruit']);
    expect(snapshot(s)).toBe(before); // input untouched
  });

  it('rejects the number set, already-owned set, and <3 zeros', () => {
    const s = initialSpireState(SEED);
    expect(applyInitialSetChoice(s, 'number').ok).toBe(false);
    expect(applyInitialSetChoice(s, 'nope').ok).toBe(false);
    const owned = { ...s, ownedSetIds: ['number', 'fruit'] };
    expect(applyInitialSetChoice(owned, 'fruit').ok).toBe(false);
    const lowZero = { ...s, symbolBag: { zero: 2, four: 15, seven: 3 } };
    const r = applyInitialSetChoice(lowZero, 'fruit');
    expect(r.ok).toBe(false);
  });
});

describe('buySymbolIncrement', () => {
  it('cost = current count of target, bag stays 20, money deducted', () => {
    const s = { ...initialSpireState(SEED), money: 10 };
    const before = snapshot(s);
    // four currently 5 → cost 5; replace a zero
    const r = buySymbolIncrement(s, 'four', 'zero');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.symbolBag.four).toBe(6);
    expect(r.state.symbolBag.zero).toBe(11);
    expect(r.state.money).toBe(5);
    expect(bagTotal(r.state.symbolBag)).toBe(20);
    expect(snapshot(s)).toBe(before);
  });

  it('deletes the replaced key when it hits 0', () => {
    // zero count 19 → cost 19, so fund it
    const s = { ...initialSpireState(SEED), money: 20, symbolBag: { zero: 19, seven: 1 } };
    const r = buySymbolIncrement(s, 'zero', 'seven');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.symbolBag.seven).toBeUndefined();
    expect(r.state.symbolBag.zero).toBe(20);
    expect(bagTotal(r.state.symbolBag)).toBe(20);
  });

  it('rejects insufficient money, target==replaced, and replaced count 0', () => {
    const broke = { ...initialSpireState(SEED), money: 0 }; // four cost 5
    expect(buySymbolIncrement(broke, 'four', 'zero').ok).toBe(false);
    const rich = { ...initialSpireState(SEED), money: 99 };
    expect(buySymbolIncrement(rich, 'four', 'four').ok).toBe(false);
    expect(buySymbolIncrement(rich, 'four', 'cherry').ok).toBe(false); // not in bag
  });

  it('restores a 0-count symbol that belongs to an included set (number always owned)', () => {
    // seven at 0; the number set is always included → restorable for cost 0.
    const s = { ...initialSpireState(SEED), money: 5, symbolBag: { zero: 16, four: 4 } };
    const r = buySymbolIncrement(s, 'seven', 'zero');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.symbolBag.seven).toBe(1);
    expect(bagTotal(r.state.symbolBag)).toBe(20);
  });

  it('rejects restoring a 0-count symbol that is NOT in any owned set', () => {
    // ownedSetIds = ['number'] only → cherry (fruit) is off-set, so a 0→1 buy is blocked.
    const s = { ...initialSpireState(SEED), money: 5, symbolBag: { zero: 16, four: 4 } };
    expect(buySymbolIncrement(s, 'cherry', 'zero').ok).toBe(false);
  });

  it('allows restoring a set symbol once that set is owned', () => {
    const chosen = applyInitialSetChoice(initialSpireState(SEED), 'fruit');
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    // Drain cherry to 0 (move its count into zero) to test the 0-restore path.
    const bag = { ...chosen.state.symbolBag };
    const cherryN = bag.cherry ?? 0;
    bag.zero = (bag.zero ?? 0) + cherryN;
    delete bag.cherry;
    const s = { ...chosen.state, money: 5, symbolBag: bag };
    const r = buySymbolIncrement(s, 'cherry', 'zero');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.symbolBag.cherry).toBe(1);
    expect(bagTotal(r.state.symbolBag)).toBe(20);
  });
});

describe('buySymbolSet', () => {
  it('replaces exactly 3 (incl duplicate replaced ids), bag 20, breakdown', () => {
    const s = { ...initialSpireState(SEED), money: 5 };
    const before = snapshot(s);
    // replace two zeros + one four with fruit's 3 symbols
    const r = buySymbolSet(s, 'fruit', ['zero', 'zero', 'four']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.symbolBag.zero).toBe(10);
    expect(r.state.symbolBag.four).toBe(4);
    expect(r.state.symbolBag.cherry).toBe(1);
    expect(bagTotal(r.state.symbolBag)).toBe(20);
    expect(r.state.money).toBe(2); // SPIRE_SET_PRICE = 3
    expect(r.breakdown.addedSymbolIds).toEqual(['cherry', 'lemon', 'grape']);
    expect(r.breakdown.gainedRuleIds).toHaveLength(2);
    expect(r.state.ownedSetIds).toContain('fruit');
    expect(snapshot(s)).toBe(before);
  });

  it('pool overflow requires removedRuleIds (error when missing, ok when provided)', () => {
    const capped = { ...poolAtCap(), money: 5 }; // pool already 10
    const missing = buySymbolSet(capped, 'fruit', ['zero', 'zero', 'four']);
    expect(missing.ok).toBe(false); // gained 2 → would be 12

    const removeIds = ['filler-a', 'filler-b'];
    const ok = buySymbolSet(capped, 'fruit', ['zero', 'zero', 'four'], removeIds);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.state.rulePool).toHaveLength(10);
    expect(ok.state.rulePool).not.toContain('filler-a');
    expect(bagTotal(ok.state.symbolBag)).toBe(20);
  });

  it('rejects owned set, wrong replaced count, and insufficient symbols', () => {
    const s = { ...initialSpireState(SEED), money: 5 };
    expect(buySymbolSet(s, 'number', ['zero', 'zero', 'four']).ok).toBe(false);
    const owned = { ...s, ownedSetIds: ['number', 'fruit'] };
    expect(buySymbolSet(owned, 'fruit', ['zero', 'zero', 'four']).ok).toBe(false);
    expect(buySymbolSet(s, 'fruit', ['zero', 'zero']).ok).toBe(false); // not 3
    expect(buySymbolSet(s, 'fruit', ['seven', 'seven', 'seven', 'seven']).ok).toBe(false); // not 3
    expect(buySymbolSet(s, 'fruit', ['seven', 'seven', 'seven', 'seven'].slice(0, 4)).ok).toBe(false);
    expect(buySymbolSet(s, 'fruit', ['four', 'four', 'four', 'four', 'four', 'four']).ok).toBe(false); // 6 ≠ 3
    const broke = { ...s, money: 0 };
    expect(buySymbolSet(broke, 'fruit', ['zero', 'zero', 'four']).ok).toBe(false);
  });

  it('requires enough of a duplicated replaced symbol (counting duplicates)', () => {
    // only 3 sevens; replacing four sevens is impossible (already covered), but
    // replacing 3 sevens IS possible — assert it succeeds and empties the key.
    const s = { ...initialSpireState(SEED), money: 5 };
    const r = buySymbolSet(s, 'fruit', ['seven', 'seven', 'seven']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.symbolBag.seven).toBeUndefined();
    expect(bagTotal(r.state.symbolBag)).toBe(20);
  });
});

describe('buyRule', () => {
  it('cap-10 removal logic: error without removal at 10, ok with', () => {
    const capped = { ...poolAtCap(), money: 5 };
    expect(buyRule(capped, 'brand-new').ok).toBe(false);
    const ok = buyRule(capped, 'brand-new', 'filler-a');
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.state.rulePool).toHaveLength(10);
    expect(ok.state.rulePool).toContain('brand-new');
    expect(ok.state.rulePool).not.toContain('filler-a');
    expect(ok.state.money).toBe(4);
  });

  it('rejects a duplicate rule and insufficient money', () => {
    const s = { ...initialSpireState(SEED), money: 5 };
    expect(buyRule(s, SPIRE_BASE_RULE_IDS[0]).ok).toBe(false); // dup
    const broke = { ...initialSpireState(SEED), money: 0 };
    expect(buyRule(broke, 'whatever').ok).toBe(false);
  });

  it('adds a rule below the cap without any removal', () => {
    const s = { ...initialSpireState(SEED), money: 5 };
    const before = snapshot(s);
    const r = buyRule(s, 'extra');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.rulePool).toHaveLength(9);
    expect(r.state.money).toBe(4);
    expect(snapshot(s)).toBe(before);
  });
});

describe('hand upgrades', () => {
  it('buyHandFlat sets flatBonusCount to 1 and deducts money; only once per hand', () => {
    const s = { ...initialSpireState(SEED), money: 5 };
    const before = snapshot(s);
    const r = buyHandFlat(s, 'Pair');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.handUpgrades.Pair).toEqual({ flatBonusCount: 1, doubleCount: 0 });
    expect(r.state.money).toBe(4);
    expect(snapshot(s)).toBe(before);
    // +50 is buyable ONCE per hand (기획) — a second purchase is rejected.
    const r2 = buyHandFlat(r.state, 'Pair');
    expect(r2.ok).toBe(false);
  });

  it('buyHandDouble sets doubleCount to 1 and deducts money; only once per hand', () => {
    const s = { ...initialSpireState(SEED), money: 5 };
    const r = buyHandDouble(s, 'Triple');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.handUpgrades.Triple).toEqual({ flatBonusCount: 0, doubleCount: 1 });
    expect(r.state.money).toBe(2); // SPIRE_HAND_DOUBLE_PRICE = 3
    // ×2 is buyable ONCE per hand (기획) — a second purchase is rejected.
    expect(buyHandDouble(r.state, 'Triple').ok).toBe(false);
  });

  it('rejects unknown hand and insufficient money', () => {
    const s = { ...initialSpireState(SEED), money: 5 };
    expect(buyHandFlat(s, 'Nonsense').ok).toBe(false);
    expect(buyHandDouble(s, 'Nonsense').ok).toBe(false);
    const broke = { ...initialSpireState(SEED), money: 0 };
    expect(buyHandFlat(broke, 'Pair').ok).toBe(false);
    expect(buyHandDouble(broke, 'Pair').ok).toBe(false);
  });

  it('SPIRE_UPGRADEABLE_HANDS covers the six poker-style hands', () => {
    expect(SPIRE_UPGRADEABLE_HANDS).toContain('Five of a Kind');
    expect(SPIRE_UPGRADEABLE_HANDS).toHaveLength(6);
  });
});

describe('rerollShop', () => {
  it('deducts the reroll price', () => {
    const s = { ...initialSpireState(SEED), money: 2 };
    const r = rerollShop(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.money).toBe(1);
  });

  it('rejects when broke', () => {
    const broke = { ...initialSpireState(SEED), money: 0 };
    expect(rerollShop(broke).ok).toBe(false);
  });
});

describe('settleClear', () => {
  it('interest on PRE-payout balance: money 13, remaining 2, stage 4 → +12 → 25', () => {
    const s = { ...initialSpireState(SEED), money: 13, currentStage: 4, totalRunScore: 100 };
    const before = snapshot(s);
    const r = settleClear(s, 2, 777);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // interest floor(13/5)=2, spinBonus 2*2=4, payout(stage4)=6 → +12
    expect(r.breakdown).toEqual({ interest: 2, spinBonus: 4, payout: 6, stageScore: 777 });
    expect(r.state.money).toBe(25);
    expect(r.state.totalRunScore).toBe(877);
    expect(r.state.currentStage).toBe(5);
    expect(r.state.currentStageAttempt).toBe(1);
    // bag/pool unchanged
    expect(r.state.symbolBag).toEqual(s.symbolBag);
    expect(r.state.rulePool).toEqual(s.rulePool);
    expect(snapshot(s)).toBe(before);
  });

  it('final stage (10) pays interest + spin bonus but 0 payout', () => {
    const s = { ...initialSpireState(SEED), money: 5, currentStage: 10 };
    const r = settleClear(s, 0, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.breakdown.payout).toBe(0);
    expect(r.breakdown.interest).toBe(1); // floor(5/5)
    expect(r.state.money).toBe(6);
  });
});

describe('settleFail', () => {
  it('fail 1 → support 5, attempt 2, same stage', () => {
    const s = { ...initialSpireState(SEED), money: 3, currentStage: 4, currentStageAttempt: 1 };
    const before = snapshot(s);
    const r = settleFail(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.breakdown).toEqual({ ended: false, support: SPIRE_FAIL_SUPPORT });
    expect(r.state.failures).toBe(1);
    expect(r.state.money).toBe(8);
    expect(r.state.currentStage).toBe(4);
    expect(r.state.currentStageAttempt).toBe(2);
    expect(snapshot(s)).toBe(before);
  });

  it('fail 3 → ended true, no money, no attempt bump', () => {
    const s = { ...initialSpireState(SEED), money: 10, failures: 2, currentStageAttempt: 3 };
    const r = settleFail(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.breakdown).toEqual({ ended: true, support: 0 });
    expect(r.state.failures).toBe(3);
    expect(r.state.money).toBe(10); // unchanged
    expect(r.state.currentStageAttempt).toBe(3); // unchanged
  });
});

describe('replay determinism', () => {
  it('same seed + same action sequence yields identical state', () => {
    const run = () => {
      let s = initialSpireState(SEED);
      const a = applyInitialSetChoice(s, 'fruit');
      if (!a.ok) throw new Error('a');
      s = { ...a.state, money: 50 };
      // pool is at 10 after the fruit choice; gem unlocks 2 → free 2 base slots
      const b = buySymbolSet(s, 'gem', ['zero', 'zero', 'four'], ['center-lock', 'last-lock']);
      if (!b.ok) throw new Error(b.error);
      return b.state;
    };
    expect(snapshot(run())).toBe(snapshot(run()));
  });
});

describe('buySetBonus — owned-set 족보 강화', () => {
  // Own fruit (positive bonuses) + cat (has an adjacent penalty) for these tests.
  function withSets(money: number): SpireRunState {
    let s = initialSpireState(SEED);
    const f = applyInitialSetChoice(s, 'fruit');
    if (!f.ok) throw new Error(f.error);
    s = f.state;
    const c = applyInitialSetChoice(s, 'cat');
    if (!c.ok) throw new Error(c.error);
    return { ...c.state, money };
  }

  it('lists only owned non-number sets bonuses; number set contributes none', () => {
    const keys = listUpgradeableSetBonuses(withSets(0).ownedSetIds).map((e) => e.key);
    expect(keys).toContain('fruit:all-types');
    expect(keys).toContain('fruit:all-symbols');
    expect(keys).toContain('cat:adjacent-penalty');
    expect(keys.some((k) => k.startsWith('number:'))).toBe(false);
  });

  it('flat (+50) on a positive bonus is buyable ONCE; double allowed, mitigate rejected', () => {
    const s = withSets(20);
    const r = buySetBonus(s, 'fruit:all-types', 'flat');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.setBonusUpgrades['fruit:all-types']).toEqual({
      flatBonusCount: 1,
      doubleCount: 0,
      mitigateCount: 0,
    });
    // second flat rejected; double still allowed; mitigate invalid for a positive bonus.
    expect(buySetBonus(r.state, 'fruit:all-types', 'flat').ok).toBe(false);
    expect(buySetBonus(r.state, 'fruit:all-types', 'double').ok).toBe(true);
    expect(buySetBonus(s, 'fruit:all-types', 'mitigate').ok).toBe(false);
  });

  it('penalty bonus (이웃 고양이) allows ONLY 완화, once; flat/double rejected', () => {
    const s = withSets(20);
    expect(buySetBonus(s, 'cat:adjacent-penalty', 'flat').ok).toBe(false);
    expect(buySetBonus(s, 'cat:adjacent-penalty', 'double').ok).toBe(false);
    const r = buySetBonus(s, 'cat:adjacent-penalty', 'mitigate');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.setBonusUpgrades['cat:adjacent-penalty'].mitigateCount).toBe(1);
    expect(buySetBonus(r.state, 'cat:adjacent-penalty', 'mitigate').ok).toBe(false);
  });

  it('rejects a bonus key for an unowned set, and when broke', () => {
    expect(buySetBonus(withSets(20), 'gem:all-types', 'flat').ok).toBe(false); // gem not owned
    expect(buySetBonus(withSets(0), 'fruit:all-types', 'flat').ok).toBe(false); // no money
  });
});
