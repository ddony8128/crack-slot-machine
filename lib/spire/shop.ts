/**
 * 첨탑 오르기 v0 — seeded shop-offer generator (SP-H1).
 *
 * What the shop OFFERS is deterministic from the run seed + how many times the
 * shop has opened (`shopVisitIndex`) + how many times it's been rerolled this
 * visit (`rerollCount`). Random sections (artifacts / new sets / buyable rules)
 * are seeded; state-derived sections (symbol increments = the current bag, hand
 * upgrades = fixed) are not. Same inputs → same offers, so the client display
 * and any future server-side offer validation agree.
 */

import { createSeededRng, type Rng } from '@/lib/rng';
import { SYMBOL_SETS, SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { ARTIFACTS, artifactOffered } from '@/lib/spire/artifacts';
import { GENERAL_RULE_IDS } from '@/lib/rules/sets';
import {
  SPIRE_ARTIFACT_PRICES,
  SPIRE_SET_PRICE,
  SPIRE_RULE_PRICE,
  SPIRE_REROLL_PRICE,
  SPIRE_HAND_FLAT_PRICE,
  SPIRE_HAND_DOUBLE_PRICE,
  SPIRE_BASE_RULE_IDS,
  spireBuySymbolPrice,
} from '@/lib/spire/config';
import { includedSymbolIds, type SpireRunState } from '@/lib/spire/state';

export type ShopOffer = { id: string; price: number };
export type ShopSymbolOffer = { id: string; count: number; price: number };

export type SpireShopOffers = {
  artifacts: ShopOffer[];  // up to 3, prices 6/5/4
  sets: ShopOffer[];       // up to 2 non-owned sets, price 3
  rules: ShopOffer[];      // up to 3 buyable rules (base/owned-set, not in pool), price 1
  symbols: ShopSymbolOffer[]; // every bag symbol (count≥1), escalating price = count
  rerollPrice: number;
  handFlatPrice: number;
  handDoublePrice: number;
};

const SHOP_SET_SLOTS = 2;
const SHOP_RULE_SLOTS = 3;

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(rng() * (i + 1)), i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The buyable-rule candidate pool: base rules + the '일반' general rules + every
 *  owned set's rules, minus whatever is already in the run's pool (deduped via
 *  the Set). General rules stay buyable regardless of the symbol pool. */
export function spireBuyableRuleIds(state: SpireRunState): string[] {
  const candidates = new Set<string>([...SPIRE_BASE_RULE_IDS, ...GENERAL_RULE_IDS]);
  for (const setId of state.ownedSetIds) {
    const set = SYMBOL_SETS_BY_ID[setId];
    if (set) for (const id of set.ruleIds) candidates.add(id);
  }
  for (const id of state.rulePool) candidates.delete(id);
  return [...candidates];
}

/**
 * The seeded ARTIFACT-REWARD offer shown after clearing an artifact stage
 * (3/6/9). This is independent of the shop generator: it uses a distinct salt
 * (`${seed}:reward:${stage}`) so the ≤2 reward artifacts do NOT share the shop's
 * `${seed}:shop:…` RNG and therefore can't overlap with the following shop's
 * artifact offers.
 *
 * Determinism: `stage` is the artifact stage just cleared (3/6/9). The same
 * (seed, stage, ownedSetIds, ownedArtifacts) always yields the same ≤2 ids, so
 * the live client display and the server replayer (lib/spire/replay.ts
 * `choose_artifact`) agree exactly — the replayer recomputes THIS offer to
 * validate that the chosen id was actually presented.
 */
export const SPIRE_REWARD_ARTIFACT_SLOTS = 2;

export function spireRewardArtifacts(state: SpireRunState, stage: number): ShopOffer[] {
  const rng = createSeededRng(`${state.seed}:reward:${stage}`);
  return shuffle(
    ARTIFACTS.filter((a) => artifactOffered(a, state.ownedSetIds, state.artifacts)),
    rng,
  )
    .slice(0, SPIRE_REWARD_ARTIFACT_SLOTS)
    // Reward picks are FREE (no price), but reuse ShopOffer for a uniform shape.
    .map((a) => ({ id: a.id, price: 0 }));
}

export function spireShopOffers(
  state: SpireRunState,
  shopVisitIndex: number,
  rerollCount: number,
): SpireShopOffers {
  const rng = createSeededRng(`${state.seed}:shop:${shopVisitIndex}:${rerollCount}`);

  const artifacts = shuffle(
    ARTIFACTS.filter((a) => artifactOffered(a, state.ownedSetIds, state.artifacts)),
    rng,
  )
    .slice(0, SPIRE_ARTIFACT_PRICES.length)
    .map((a, i) => ({ id: a.id, price: SPIRE_ARTIFACT_PRICES[i] }));

  const sets = shuffle(
    SYMBOL_SETS.filter((s) => !s.isNumberSet && !state.ownedSetIds.includes(s.id)),
    rng,
  )
    .slice(0, SHOP_SET_SLOTS)
    .map((s) => ({ id: s.id, price: SPIRE_SET_PRICE }));

  const rules = shuffle(spireBuyableRuleIds(state), rng)
    .slice(0, SHOP_RULE_SLOTS)
    .map((id) => ({ id, price: SPIRE_RULE_PRICE }));

  // Every symbol currently in the bag, PLUS any included-set symbol that has been
  // reduced to 0 — so a 0'd-out owned-set symbol stays restorable (0 → 1).
  const included = includedSymbolIds(state);
  const restorable = [...included]
    .filter((id) => (state.symbolBag[id] ?? 0) === 0)
    .map((id) => ({ id, count: 0, price: spireBuySymbolPrice(0) }));
  const symbols = [
    ...Object.entries(state.symbolBag)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, count, price: spireBuySymbolPrice(count) })),
    ...restorable,
  ];

  return {
    artifacts,
    sets,
    rules,
    symbols,
    rerollPrice: SPIRE_REROLL_PRICE,
    handFlatPrice: SPIRE_HAND_FLAT_PRICE,
    handDoublePrice: SPIRE_HAND_DOUBLE_PRICE,
  };
}
