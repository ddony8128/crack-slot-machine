/**
 * PURE state + deterministic reducers for RULE SLOT 첨탑 오르기 (Spire) v0.
 *
 * This module is the single source of truth for the spire run STATE machine.
 * It is intentionally side-effect-free and framework-agnostic:
 *  - Every reducer has the shape `(state, params) => Result` and NEVER mutates
 *    its input (bag / pool / handUpgrades / ownedSetIds are always cloned).
 *  - The only randomness comes from `createSeededRng(...)` with STABLE salts, so
 *    a run can be replayed verbatim from its seed + the sequence of actions.
 *  - No Date.now / Math.random / I/O.
 *
 * Store/UI/routes/score.ts wiring lives elsewhere — this file knows nothing of
 * them.
 */

import { createSeededRng } from '@/lib/rng';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { ARTIFACTS_BY_ID, artifactOffered } from '@/lib/spire/artifacts';
import {
  SPIRE_ARTIFACT_PRICES,
  SPIRE_START_BAG,
  SPIRE_BASE_RULE_IDS,
  SPIRE_BAG_TOTAL,
  SPIRE_RULE_POOL_MAX,
  SPIRE_START_MONEY,
  SPIRE_MAX_FAILURES,
  SPIRE_FAIL_SUPPORT,
  SPIRE_SET_PRICE,
  SPIRE_RULE_PRICE,
  SPIRE_HAND_FLAT_PRICE,
  SPIRE_HAND_DOUBLE_PRICE,
  SPIRE_REROLL_PRICE,
  spireClearPayout,
  spireInterest,
  spireSpinBonus,
  spireBuySymbolPrice,
} from '@/lib/spire/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HandUpgrade = { flatBonusCount: number; doubleCount: number };

export type SpireRunState = {
  seed: string;
  currentStage: number; // 1-based
  currentStageAttempt: number; // 1-based attempt of currentStage
  failures: number; // 0..3
  money: number;
  totalRunScore: number;
  symbolBag: Record<string, number>; // ALWAYS sums to 20
  ownedSetIds: string[]; // ['number', ...chosen]
  rulePool: string[]; // ≤10
  artifacts: string[];
  handUpgrades: Record<string, HandUpgrade>;
};

/** The hands the v0 shop allows the player to upgrade (flat bonus / ×2). */
export const SPIRE_UPGRADEABLE_HANDS = [
  'Pair',
  'Two Pair',
  'Triple',
  'Full House',
  'Four of a Kind',
  'Five of a Kind',
];

export type Result<B = undefined> =
  | (B extends undefined
      ? { ok: true; state: SpireRunState; breakdown?: undefined }
      : { ok: true; state: SpireRunState; breakdown: B })
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Cloning helpers (defensive — input state is NEVER mutated)
// ---------------------------------------------------------------------------

function cloneBag(bag: Record<string, number>): Record<string, number> {
  return { ...bag };
}

function cloneHandUpgrades(
  hu: Record<string, HandUpgrade>,
): Record<string, HandUpgrade> {
  const out: Record<string, HandUpgrade> = {};
  for (const [k, v] of Object.entries(hu)) {
    out[k] = { flatBonusCount: v.flatBonusCount, doubleCount: v.doubleCount };
  }
  return out;
}

/** Shallow-clone the whole state with deep copies of every mutable container. */
function cloneState(state: SpireRunState): SpireRunState {
  return {
    ...state,
    symbolBag: cloneBag(state.symbolBag),
    ownedSetIds: [...state.ownedSetIds],
    rulePool: [...state.rulePool],
    artifacts: [...state.artifacts],
    handUpgrades: cloneHandUpgrades(state.handUpgrades),
  };
}

// ---------------------------------------------------------------------------
// Bag helpers
// ---------------------------------------------------------------------------

export function bagTotal(bag: Record<string, number>): number {
  return Object.values(bag).reduce((a, b) => a + b, 0);
}

/**
 * Internal invariant guard: the symbol bag MUST always total exactly 20.
 * Called at the end of every bag-mutating reducer before returning ok. Throwing
 * here means a reducer has a bug, not that the user did something invalid.
 */
export function assertBag20(bag: Record<string, number>): void {
  const total = bagTotal(bag);
  if (total !== SPIRE_BAG_TOTAL) {
    throw new Error(
      `spire bag invariant violated: expected ${SPIRE_BAG_TOTAL}, got ${total}`,
    );
  }
}

/** Add `n` of `symbolId` to a (already-cloned) bag. */
function bagAdd(bag: Record<string, number>, symbolId: string, n: number): void {
  bag[symbolId] = (bag[symbolId] ?? 0) + n;
}

/** Remove one of `symbolId` from a (already-cloned) bag; delete key at 0. */
function bagRemoveOne(bag: Record<string, number>, symbolId: string): void {
  bag[symbolId] = (bag[symbolId] ?? 0) - 1;
  if (bag[symbolId] <= 0) delete bag[symbolId];
}

// ---------------------------------------------------------------------------
// Rule-pool helpers
// ---------------------------------------------------------------------------

/**
 * Deterministically draw up to 2 NEW rule ids unlocked by owning `setId`.
 *
 * Source = SYMBOL_SETS_BY_ID[setId].ruleIds, EXCLUDING any id already present in
 * `currentPool`. Draws are Fisher–Yates over a copy, using
 * `createSeededRng(`${seed}:${salt}`)`. Fewer than 2 candidates → returns what
 * is available (possibly 0). Stable for a fixed (seed, salt).
 */
export function pickSetRules(
  setId: string,
  currentPool: string[],
  seed: string,
  salt: string,
): string[] {
  const set = SYMBOL_SETS_BY_ID[setId];
  if (!set) return [];

  const have = new Set(currentPool);
  const candidates = set.ruleIds.filter((id) => !have.has(id));

  const rng = createSeededRng(`${seed}:${salt}`);
  const out: string[] = [];
  const want = Math.min(2, candidates.length);
  for (let i = 0; i < want; i++) {
    const idx = Math.floor(rng() * candidates.length);
    out.push(candidates.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * Append `newRuleIds` to `pool` (skipping any already present), then enforce the
 * ≤10 cap. If the post-append length exceeds SPIRE_RULE_POOL_MAX, the caller MUST
 * supply `removedRuleIds` that remove exactly enough EXISTING (pre-add) rules to
 * land at ≤10. Each removed id must already be in the pool and must NOT be one of
 * the just-added newRuleIds. Returns the new pool, or an error.
 */
export function addRulesToPool(
  pool: string[],
  newRuleIds: string[],
  removedRuleIds: string[],
):
  | { ok: true; pool: string[] }
  | { ok: false; error: string } {
  const prePresent = new Set(pool);
  const newSet = new Set(newRuleIds);

  // Validate removals against the PRE-add pool.
  for (const id of removedRuleIds) {
    if (!prePresent.has(id)) {
      return { ok: false, error: `cannot remove rule not in pool: ${id}` };
    }
    if (newSet.has(id)) {
      return { ok: false, error: `cannot remove a just-added rule: ${id}` };
    }
  }

  // Apply removals first (against the existing pool), then append new (dedup).
  const removed = new Set(removedRuleIds);
  const next = pool.filter((id) => !removed.has(id));
  const nextPresent = new Set(next);
  for (const id of newRuleIds) {
    if (!nextPresent.has(id)) {
      next.push(id);
      nextPresent.add(id);
    }
  }

  if (next.length > SPIRE_RULE_POOL_MAX) {
    return {
      ok: false,
      error: `rule pool over cap (${next.length} > ${SPIRE_RULE_POOL_MAX}); supply enough removedRuleIds`,
    };
  }

  return { ok: true, pool: next };
}

// ---------------------------------------------------------------------------
// Set lookup helper
// ---------------------------------------------------------------------------

/** A known, non-number symbol set, or null. */
function nonNumberSet(setId: string) {
  const set = SYMBOL_SETS_BY_ID[setId];
  if (!set || set.isNumberSet) return null;
  return set;
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * The starting state for a fresh spire run. Returns the state DIRECTLY (this is
 * the only non-Result entry point — there is nothing for the caller to do wrong).
 */
export function initialSpireState(seed: string): SpireRunState {
  const state: SpireRunState = {
    seed,
    currentStage: 1,
    currentStageAttempt: 1,
    failures: 0,
    money: SPIRE_START_MONEY,
    totalRunScore: 0,
    symbolBag: { ...SPIRE_START_BAG },
    ownedSetIds: ['number'],
    rulePool: [...SPIRE_BASE_RULE_IDS],
    artifacts: [],
    handUpgrades: {},
  };
  assertBag20(state.symbolBag);
  return state;
}

/**
 * Pre-stage-1 set choice. Removes 3 zeros, adds the chosen set's 3 symbols ×1,
 * and unlocks up to 2 of that set's rules (base 8 + 2 = 10, so no removal). The
 * breakdown reports the unlocked rule ids.
 */
export function applyInitialSetChoice(
  state: SpireRunState,
  chosenSetId: string,
): Result<{ gainedRuleIds: string[] }> {
  const set = nonNumberSet(chosenSetId);
  if (!set) {
    return { ok: false, error: `unknown or number set: ${chosenSetId}` };
  }
  if (state.ownedSetIds.includes(chosenSetId)) {
    return { ok: false, error: `set already owned: ${chosenSetId}` };
  }

  const next = cloneState(state);
  if ((next.symbolBag.zero ?? 0) < 3) {
    return { ok: false, error: 'not enough zeros to remove (need 3)' };
  }

  next.symbolBag.zero -= 3;
  if (next.symbolBag.zero <= 0) delete next.symbolBag.zero;
  for (const sym of set.symbols) bagAdd(next.symbolBag, sym.id, 1);

  const gainedRuleIds = pickSetRules(
    chosenSetId,
    next.rulePool,
    state.seed,
    `set-rules:${chosenSetId}`,
  );
  // base 8 + up to 2 = ≤10, never overflows.
  next.rulePool = [...next.rulePool, ...gainedRuleIds];
  next.ownedSetIds = [...next.ownedSetIds, chosenSetId];

  assertBag20(next.symbolBag);
  return { ok: true, state: next, breakdown: { gainedRuleIds } };
}

/**
 * Buy +1 of `targetSymbolId` by replacing one `replacedSymbolId`. Price escalates
 * with the target's CURRENT count. Bag stays at 20 (one added, one removed).
 */
export function buySymbolIncrement(
  state: SpireRunState,
  targetSymbolId: string,
  replacedSymbolId: string,
): Result {
  if (targetSymbolId === replacedSymbolId) {
    return { ok: false, error: 'target and replaced symbol must differ' };
  }
  const cost = spireBuySymbolPrice(state.symbolBag[targetSymbolId] ?? 0);
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }
  if ((state.symbolBag[targetSymbolId] ?? 0) < 1) {
    return { ok: false, error: `target symbol not in bag: ${targetSymbolId}` };
  }
  if ((state.symbolBag[replacedSymbolId] ?? 0) < 1) {
    return { ok: false, error: `replaced symbol not in bag: ${replacedSymbolId}` };
  }

  const next = cloneState(state);
  bagAdd(next.symbolBag, targetSymbolId, 1);
  bagRemoveOne(next.symbolBag, replacedSymbolId);
  next.money -= cost;

  assertBag20(next.symbolBag);
  return { ok: true, state: next };
}

/**
 * Buy a whole symbol set: pay SPIRE_SET_PRICE, replace 3 existing symbols (by id,
 * counting duplicates) with the set's 3 symbols, and unlock up to 2 of its rules
 * (may overflow the pool → `removedRuleIds` required).
 */
export function buySymbolSet(
  state: SpireRunState,
  setId: string,
  replacedSymbolIds: string[],
  removedRuleIds: string[] = [],
): Result<{ addedSymbolIds: string[]; gainedRuleIds: string[] }> {
  const set = nonNumberSet(setId);
  if (!set) {
    return { ok: false, error: `unknown or number set: ${setId}` };
  }
  if (state.ownedSetIds.includes(setId)) {
    return { ok: false, error: `set already owned: ${setId}` };
  }
  const cost = SPIRE_SET_PRICE;
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }
  if (replacedSymbolIds.length !== 3) {
    return { ok: false, error: 'must replace exactly 3 symbols' };
  }

  // Validate the bag has enough of each replaced id, counting duplicates.
  const needed: Record<string, number> = {};
  for (const id of replacedSymbolIds) needed[id] = (needed[id] ?? 0) + 1;
  for (const [id, n] of Object.entries(needed)) {
    if ((state.symbolBag[id] ?? 0) < n) {
      return { ok: false, error: `not enough '${id}' to replace (need ${n})` };
    }
  }

  const next = cloneState(state);
  const addedSymbolIds = set.symbols.map((s) => s.id);
  for (const id of addedSymbolIds) bagAdd(next.symbolBag, id, 1);
  for (const id of replacedSymbolIds) bagRemoveOne(next.symbolBag, id);

  const gainedRuleIds = pickSetRules(
    setId,
    next.rulePool,
    state.seed,
    `buy-set:${setId}:${state.currentStage}:${state.currentStageAttempt}`,
  );
  const poolResult = addRulesToPool(next.rulePool, gainedRuleIds, removedRuleIds);
  if (!poolResult.ok) return { ok: false, error: poolResult.error };

  next.rulePool = poolResult.pool;
  next.ownedSetIds = [...next.ownedSetIds, setId];
  next.money -= cost;

  assertBag20(next.symbolBag);
  return { ok: true, state: next, breakdown: { addedSymbolIds, gainedRuleIds } };
}

/**
 * Buy a single rule into the pool (SPIRE_RULE_PRICE). At the cap, an optional
 * `removedRuleId` must free a slot.
 */
export function buyRule(
  state: SpireRunState,
  ruleId: string,
  removedRuleId?: string,
): Result {
  const cost = SPIRE_RULE_PRICE;
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }
  if (state.rulePool.includes(ruleId)) {
    return { ok: false, error: `rule already in pool: ${ruleId}` };
  }

  const poolResult = addRulesToPool(
    state.rulePool,
    [ruleId],
    removedRuleId ? [removedRuleId] : [],
  );
  if (!poolResult.ok) return { ok: false, error: poolResult.error };

  const next = cloneState(state);
  next.rulePool = poolResult.pool;
  next.money -= cost;
  return { ok: true, state: next };
}

/**
 * Buy an artifact from the shop. Validation (all must hold):
 *  - `cost` is one of the seeded artifact-slot prices (4/5/6),
 *  - the run has enough money,
 *  - the artifact is not already owned,
 *  - `artifactOffered(...)` is satisfied (the id exists, is not owned, and any
 *    required set is in ownedSetIds).
 *
 * On ok: push the artifact, money -= cost. (Offer-slot/price exactness vs the
 * seeded shop is a known v0 gap — bounding cost to {4,5,6} + eligibility is
 * enough for v0.)
 */
export function buyArtifact(
  state: SpireRunState,
  artifactId: string,
  cost: number,
): Result {
  if (!(SPIRE_ARTIFACT_PRICES as readonly number[]).includes(cost)) {
    return { ok: false, error: `invalid artifact price: ${cost}` };
  }
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }
  if (state.artifacts.includes(artifactId)) {
    return { ok: false, error: `artifact already owned: ${artifactId}` };
  }
  const def = ARTIFACTS_BY_ID[artifactId];
  if (!def || !artifactOffered(def, state.ownedSetIds, state.artifacts)) {
    return { ok: false, error: `artifact not eligible: ${artifactId}` };
  }

  const next = cloneState(state);
  next.artifacts = [...next.artifacts, artifactId];
  next.money -= cost;
  return { ok: true, state: next };
}

/** Buy a flat (+points) hand upgrade for an upgradeable hand. */
export function buyHandFlat(state: SpireRunState, handType: string): Result {
  if (!SPIRE_UPGRADEABLE_HANDS.includes(handType)) {
    return { ok: false, error: `hand not upgradeable: ${handType}` };
  }
  const cost = SPIRE_HAND_FLAT_PRICE;
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }

  const next = cloneState(state);
  const cur = next.handUpgrades[handType] ?? { flatBonusCount: 0, doubleCount: 0 };
  next.handUpgrades[handType] = {
    flatBonusCount: cur.flatBonusCount + 1,
    doubleCount: cur.doubleCount,
  };
  next.money -= cost;
  return { ok: true, state: next };
}

/** Buy a ×2 (double) hand upgrade for an upgradeable hand. */
export function buyHandDouble(state: SpireRunState, handType: string): Result {
  if (!SPIRE_UPGRADEABLE_HANDS.includes(handType)) {
    return { ok: false, error: `hand not upgradeable: ${handType}` };
  }
  const cost = SPIRE_HAND_DOUBLE_PRICE;
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }

  const next = cloneState(state);
  const cur = next.handUpgrades[handType] ?? { flatBonusCount: 0, doubleCount: 0 };
  next.handUpgrades[handType] = {
    flatBonusCount: cur.flatBonusCount,
    doubleCount: cur.doubleCount + 1,
  };
  next.money -= cost;
  return { ok: true, state: next };
}

/**
 * Reroll the shop offer (SPIRE_REROLL_PRICE). This reducer ONLY deducts money;
 * regenerating the offer is the controller's responsibility.
 *
 * chime (차임벨): the first 2 rerolls of each shop visit are FREE. The caller
 * decides freeness (it owns the per-visit counter) and passes `free`; a free
 * reroll deducts NOTHING and never fails for affordability. Whether a reroll is
 * free is DERIVED identically by the live client and the server replayer from
 * the artifact + the per-visit reroll index, so it is not stored on the action.
 */
export function rerollShop(state: SpireRunState, free = false): Result {
  const cost = SPIRE_REROLL_PRICE;
  if (free) {
    return { ok: true, state: cloneState(state) };
  }
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }
  const next = cloneState(state);
  next.money -= cost;
  return { ok: true, state: next };
}

/**
 * Settle a CLEARED stage. Interest is computed from the PRE-payout balance, then
 * interest + remaining-spin bonus + stage payout are added. The run advances to
 * the next stage (attempt reset to 1). No bag/pool change.
 */
export function settleClear(
  state: SpireRunState,
  remainingSpins: number,
  stageScore: number,
): Result<{
  interest: number;
  spinBonus: number;
  payout: number;
  stageScore: number;
}> {
  const stage = state.currentStage;
  // ledger (가계부): interest is doubled when owned. Reads state.artifacts only,
  // so the reducer stays pure + deterministic under replay.
  const interest =
    spireInterest(state.money) * (state.artifacts.includes('ledger') ? 2 : 1); // PRE-payout balance
  const spinBonus = spireSpinBonus(remainingSpins);
  const payout = spireClearPayout(stage);

  const next = cloneState(state);
  next.money += interest + spinBonus + payout;
  next.totalRunScore += stageScore;
  next.currentStage += 1;
  next.currentStageAttempt = 1;

  return {
    ok: true,
    state: next,
    breakdown: { interest, spinBonus, payout, stageScore },
  };
}

/**
 * Settle a FAILED stage attempt. Non-final failures grant SPIRE_FAIL_SUPPORT and
 * bump the attempt counter (same stage). The SPIRE_MAX_FAILURES-th failure ends
 * the run (no money, no attempt bump).
 */
export function settleFail(
  state: SpireRunState,
): Result<{ ended: boolean; support: number }> {
  const next = cloneState(state);
  next.failures += 1;

  if (next.failures < SPIRE_MAX_FAILURES) {
    next.money += SPIRE_FAIL_SUPPORT;
    next.currentStageAttempt += 1;
    return {
      ok: true,
      state: next,
      breakdown: { ended: false, support: SPIRE_FAIL_SUPPORT },
    };
  }

  return { ok: true, state: next, breakdown: { ended: true, support: 0 } };
}
