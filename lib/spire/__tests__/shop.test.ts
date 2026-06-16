import { describe, it, expect } from 'vitest';
import { spireShopOffers, spireRewardArtifacts, spireBuyableRuleIds } from '@/lib/spire/shop';
import { initialSpireState, applyInitialSetChoice } from '@/lib/spire/state';
import { artifactOffered, ARTIFACTS_BY_ID } from '@/lib/spire/artifacts';
import { SPIRE_ARTIFACT_PRICES, SPIRE_SET_PRICE } from '@/lib/spire/config';

function fruitState() {
  const r = applyInitialSetChoice(initialSpireState('shop-seed'), 'fruit');
  if (!r.ok) throw new Error('setup');
  return r.state;
}

describe('spireShopOffers', () => {
  it('is deterministic for the same (visit, reroll), differs across reroll', () => {
    const st = fruitState();
    const a = spireShopOffers(st, 0, 0);
    const b = spireShopOffers(st, 0, 0);
    const c = spireShopOffers(st, 0, 1);
    expect(a).toEqual(b);
    // a reroll re-seeds → at least one random section changes (very high prob)
    const changed =
      JSON.stringify(a.rules) !== JSON.stringify(c.rules) ||
      JSON.stringify(a.sets) !== JSON.stringify(c.sets) ||
      JSON.stringify(a.artifacts) !== JSON.stringify(c.artifacts);
    expect(changed).toBe(true);
  });

  it('artifacts priced 6/5/4, sets priced 3 and exclude owned sets', () => {
    const st = fruitState();
    const o = spireShopOffers(st, 0, 0);
    expect(o.artifacts.map((a) => a.price)).toEqual(
      [...SPIRE_ARTIFACT_PRICES].slice(0, o.artifacts.length),
    );
    expect(o.sets.every((s) => s.price === SPIRE_SET_PRICE)).toBe(true);
    expect(o.sets.some((s) => s.id === 'fruit')).toBe(false); // owned → not offered
    expect(o.sets.some((s) => s.id === 'number')).toBe(false); // number set never offered
  });

  it('rule offers are buyable (base/owned-set, not already in pool)', () => {
    const st = fruitState();
    const buyable = new Set(spireBuyableRuleIds(st));
    const o = spireShopOffers(st, 0, 0);
    for (const r of o.rules) {
      expect(buyable.has(r.id)).toBe(true);
      expect(st.rulePool.includes(r.id)).toBe(false);
      expect(r.price).toBe(1);
    }
  });

  it('symbol offers mirror the bag with escalating price = current count', () => {
    const st = fruitState();
    const o = spireShopOffers(st, 0, 0);
    const zero = o.symbols.find((s) => s.id === 'zero')!;
    expect(zero.count).toBe(9);
    expect(zero.price).toBe(9);
    // every bag symbol present, none with 0
    expect(o.symbols.every((s) => s.count > 0)).toBe(true);
    expect(o.symbols.find((s) => s.id === 'cherry')?.price).toBe(1);
  });
});

describe('spireRewardArtifacts (3/6/9 reward pick)', () => {
  it('is deterministic for the same (seed, stage) and ≤2 eligible artifacts', () => {
    const st = fruitState();
    const a = spireRewardArtifacts(st, 3);
    const b = spireRewardArtifacts(st, 3);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(2);
    for (const o of a) {
      expect(ARTIFACTS_BY_ID[o.id]).toBeTruthy();
      expect(artifactOffered(ARTIFACTS_BY_ID[o.id], st.ownedSetIds, st.artifacts)).toBe(true);
    }
  });

  it('uses a salt INDEPENDENT of the shop seed (does not equal the shop slice)', () => {
    // The bug: reward picks reused spireShopOffers(...).artifacts.slice(0,2), so
    // reward + the following shop shared a seed and overlapped. The reward offer
    // must be salted distinctly (`:reward:` vs `:shop:`), so it differs from the
    // shop's first 2 artifacts for at least one stage among the reward stages.
    const st = fruitState();
    const differsSomewhere = [3, 6, 9].some((stage) => {
      const reward = spireRewardArtifacts(st, stage).map((o) => o.id).join('|');
      // Compare against the shop opened right after that stage's reward.
      const shop = spireShopOffers(st, stage, 0).artifacts.slice(0, 2).map((o) => o.id).join('|');
      return reward !== shop;
    });
    expect(differsSomewhere).toBe(true);
  });

  it('differs across reward stages (distinct per-stage salt)', () => {
    const st = fruitState();
    const r3 = spireRewardArtifacts(st, 3).map((o) => o.id).join('|');
    const r6 = spireRewardArtifacts(st, 6).map((o) => o.id).join('|');
    expect(r3 === r6 && r3.length > 0).toBe(false);
  });
});
