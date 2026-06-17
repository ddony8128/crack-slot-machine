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
import { SYMBOL_SETS_BY_ID, type SetBonus } from '@/lib/symbols/sets';
import { setBonusKey, type SetBonusUpgrade, type SetBonusUpgradeMap } from '@/lib/score';
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
  // 족보 강화 for owned-set bonuses (keyed by setBonusKey). Empty until bought.
  setBonusUpgrades: SetBonusUpgradeMap;
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

function cloneSetBonusUpgrades(su: SetBonusUpgradeMap): SetBonusUpgradeMap {
  const out: SetBonusUpgradeMap = {};
  for (const [k, v] of Object.entries(su)) {
    out[k] = {
      flatBonusCount: v.flatBonusCount,
      doubleCount: v.doubleCount,
      mitigateCount: v.mitigateCount,
    };
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
    setBonusUpgrades: cloneSetBonusUpgrades(state.setBonusUpgrades),
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
// onAcquire artifact effects (첨탑)
// ---------------------------------------------------------------------------

/** The 'zero' symbol id is never touched by 물뿌리개. */
const ZERO_ID = 'zero';

/** The number set's symbol ids (0/4/7) — guaranteed present after a 슬롯머신 rebuild. */
const NUMBER_SYMBOL_IDS: string[] = (SYMBOL_SETS_BY_ID.number?.symbols ?? []).map(
  (s) => s.id,
);

/**
 * Apply an artifact's one-time onAcquire effect to `state`, returning a NEW
 * state (input is never mutated). Artifacts without an onAcquire effect return a
 * clone unchanged.
 *
 * Determinism: an artifact is acquired AT MOST ONCE per run (no duplicates), so
 * salting the rng with `${state.seed}:acquire:${artifactId}` is both stable and
 * unique. The live client and the server replayer call this at the SAME point
 * (right after the id is appended to state.artifacts), so their states match.
 */
export function applyArtifactAcquire(
  state: SpireRunState,
  artifactId: string,
): SpireRunState {
  switch (artifactId) {
    case 'watering-can':
      return applyWateringCan(state);
    case 'slot-machine':
      return applySlotMachine(state);
    default:
      return cloneState(state);
  }
}

/**
 * 물뿌리개: among the bag's NON-zero symbols with count ≥1, give +1 to one of the
 * highest-count symbols and -1 to one of the lowest-count symbols (each tie
 * broken by the seeded rng). Bag total stays 20; 'zero' is never touched. If only
 * one non-zero symbol type exists the +1/-1 would cancel, so it is a no-op.
 */
function applyWateringCan(state: SpireRunState): SpireRunState {
  const next = cloneState(state);
  const rng = createSeededRng(`${state.seed}:acquire:watering-can`);

  const entries = Object.entries(next.symbolBag).filter(
    ([id, n]) => id !== ZERO_ID && n >= 1,
  );
  // 0 or 1 non-zero symbol types → +1/-1 cancel or nothing to do → no-op.
  if (entries.length < 2) {
    assertBag20(next.symbolBag);
    return next;
  }

  const counts = entries.map(([, n]) => n);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);

  const maxIds = entries.filter(([, n]) => n === maxCount).map(([id]) => id);
  const minIds = entries.filter(([, n]) => n === minCount).map(([id]) => id);

  const incId = maxIds[Math.floor(rng() * maxIds.length)];
  const decId = minIds[Math.floor(rng() * minIds.length)];

  // entries.length ≥ 2 guarantees distinct symbols exist; if the rng happened to
  // pick the same id (only possible when max===min, i.e. all counts equal), pick a
  // distinct min target so the net effect is non-trivial.
  let finalDecId = decId;
  if (finalDecId === incId) {
    const distinct = minIds.filter((id) => id !== incId);
    if (distinct.length === 0) {
      // Every non-zero symbol shares the same id as incId — impossible with
      // length ≥ 2, but stay graceful: no-op.
      assertBag20(next.symbolBag);
      return next;
    }
    finalDecId = distinct[Math.floor(rng() * distinct.length)];
  }

  bagAdd(next.symbolBag, incId, 1);
  bagRemoveOne(next.symbolBag, finalDecId);

  assertBag20(next.symbolBag);
  return next;
}

/**
 * 슬롯머신: fully reconstruct symbolBag + rulePool from the run's OWNED sets.
 *  1. Draw 20 symbols uniformly from every owned set's symbol ids, then guarantee
 *     the number-set minimums (0,4,7 each ≥1) by bumping a missing number and
 *     decrementing the current-highest non-number, keeping total 20.
 *  2. Rebuild rulePool from SPIRE_BASE_RULE_IDS ∪ every owned set's ruleIds,
 *     shuffled, capped at SPIRE_RULE_POOL_MAX.
 * Everything else (artifacts/handUpgrades/money/ownedSetIds/stage/attempt) is kept.
 */
function applySlotMachine(state: SpireRunState): SpireRunState {
  const next = cloneState(state);
  const rng = createSeededRng(`${state.seed}:acquire:slot-machine`);

  // ── 1. rebuild symbolBag ──
  const symbolIds: string[] = [];
  for (const setId of next.ownedSetIds) {
    const set = SYMBOL_SETS_BY_ID[setId];
    if (!set) continue;
    for (const sym of set.symbols) symbolIds.push(sym.id);
  }
  // Defensive: with no owned-set symbols there is nothing to draw; keep the bag.
  if (symbolIds.length === 0) {
    assertBag20(next.symbolBag);
    return next;
  }

  const bag: Record<string, number> = {};
  for (let i = 0; i < SPIRE_BAG_TOTAL; i++) {
    const id = symbolIds[Math.floor(rng() * symbolIds.length)];
    bag[id] = (bag[id] ?? 0) + 1;
  }

  // Guarantee the number-set minimums (0/4/7 each ≥1). For each missing number,
  // bump it to 1 and decrement the current-highest NON-number symbol so the total
  // stays 20.
  const numberIds = new Set<string>(NUMBER_SYMBOL_IDS);
  for (const numId of NUMBER_SYMBOL_IDS) {
    if ((bag[numId] ?? 0) >= 1) continue;
    // Find the highest-count non-number symbol with ≥2 (so removing 1 keeps ≥1),
    // falling back to any non-number with ≥1.
    let donor: string | null = null;
    let donorCount = 0;
    for (const [id, n] of Object.entries(bag)) {
      if (numberIds.has(id)) continue;
      if (n > donorCount) {
        donor = id;
        donorCount = n;
      }
    }
    if (donor === null) {
      // No non-number donor (bag is all numbers already) — pull from the highest
      // OTHER number instead so 0/4/7 can still all reach ≥1 when possible.
      for (const [id, n] of Object.entries(bag)) {
        if (id === numId) continue;
        if (n > donorCount + 1 && n - 1 >= 1) {
          donor = id;
          donorCount = n;
        }
      }
    }
    if (donor === null) continue; // can't satisfy without breaking another min
    bag[donor] -= 1;
    if (bag[donor] <= 0) delete bag[donor];
    bag[numId] = (bag[numId] ?? 0) + 1;
  }

  next.symbolBag = bag;
  assertBag20(next.symbolBag);

  // ── 2. rebuild rulePool ──
  const ruleCandidates: string[] = [];
  const seen = new Set<string>();
  for (const id of SPIRE_BASE_RULE_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      ruleCandidates.push(id);
    }
  }
  for (const setId of next.ownedSetIds) {
    const set = SYMBOL_SETS_BY_ID[setId];
    if (!set) continue;
    for (const id of set.ruleIds) {
      if (!seen.has(id)) {
        seen.add(id);
        ruleCandidates.push(id);
      }
    }
  }
  // Fisher–Yates shuffle, then take up to the pool cap.
  for (let i = ruleCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = ruleCandidates[i];
    ruleCandidates[i] = ruleCandidates[j];
    ruleCandidates[j] = tmp;
  }
  next.rulePool = ruleCandidates.slice(0, SPIRE_RULE_POOL_MAX);

  return next;
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
    setBonusUpgrades: {},
  };
  assertBag20(state.symbolBag);
  return state;
}

/**
 * Every upgradeable set-bonus for the run's OWNED (non-number) sets, in set order.
 * Used by the shop UI and to VALIDATE buySetBonus (anti-tamper). `isPenalty` flags
 * negative bonuses (이웃 고양이) — those allow only the 완화(mitigate) kind.
 */
export function listUpgradeableSetBonuses(ownedSetIds: string[]): Array<{
  key: string;
  setId: string;
  setName: string;
  bonus: SetBonus;
  isPenalty: boolean;
}> {
  const out: Array<{ key: string; setId: string; setName: string; bonus: SetBonus; isPenalty: boolean }> = [];
  for (const setId of ownedSetIds) {
    const set = nonNumberSet(setId);
    if (!set) continue;
    for (const bonus of set.bonuses) {
      out.push({
        key: setBonusKey(setId, bonus),
        setId,
        setName: set.name,
        bonus,
        isPenalty: bonus.points < 0,
      });
    }
  }
  return out;
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
  const cur = state.handUpgrades[handType] ?? { flatBonusCount: 0, doubleCount: 0 };
  // +50 is buyable ONCE per hand (기획).
  if (cur.flatBonusCount >= 1) {
    return { ok: false, error: `hand flat already upgraded: ${handType}` };
  }
  const cost = SPIRE_HAND_FLAT_PRICE;
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }

  const next = cloneState(state);
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
  const cur = state.handUpgrades[handType] ?? { flatBonusCount: 0, doubleCount: 0 };
  // ×2 is buyable ONCE per hand (기획).
  if (cur.doubleCount >= 1) {
    return { ok: false, error: `hand double already upgraded: ${handType}` };
  }
  const cost = SPIRE_HAND_DOUBLE_PRICE;
  if (state.money < cost) {
    return { ok: false, error: `not enough money (need ${cost})` };
  }

  const next = cloneState(state);
  next.handUpgrades[handType] = {
    flatBonusCount: cur.flatBonusCount,
    doubleCount: cur.doubleCount + 1,
  };
  next.money -= cost;
  return { ok: true, state: next };
}

export type SetBonusUpgradeKind = 'flat' | 'double' | 'mitigate';

/**
 * Buy a 족보 강화 for an OWNED set's bonus (shop). `kind`:
 *  - 'flat' (+50) / 'double' (×2): positive bonuses only, each once.
 *  - 'mitigate' (+50 완화): penalty bonuses (이웃 고양이) only, once.
 * The key must belong to an owned set's bonus (validated via listUpgradeableSetBonuses).
 */
export function buySetBonus(
  state: SpireRunState,
  key: string,
  kind: SetBonusUpgradeKind,
): Result {
  const entry = listUpgradeableSetBonuses(state.ownedSetIds).find((e) => e.key === key);
  if (!entry) return { ok: false, error: `set bonus not upgradeable: ${key}` };
  if (entry.isPenalty && kind !== 'mitigate') {
    return { ok: false, error: `penalty bonus allows only 완화: ${key}` };
  }
  if (!entry.isPenalty && kind === 'mitigate') {
    return { ok: false, error: `positive bonus has no 완화: ${key}` };
  }

  const cur: SetBonusUpgrade =
    state.setBonusUpgrades[key] ?? { flatBonusCount: 0, doubleCount: 0, mitigateCount: 0 };
  if (kind === 'flat' && cur.flatBonusCount >= 1) return { ok: false, error: `flat already bought: ${key}` };
  if (kind === 'double' && cur.doubleCount >= 1) return { ok: false, error: `double already bought: ${key}` };
  if (kind === 'mitigate' && cur.mitigateCount >= 1) return { ok: false, error: `mitigate already bought: ${key}` };

  const cost = kind === 'double' ? SPIRE_HAND_DOUBLE_PRICE : SPIRE_HAND_FLAT_PRICE;
  if (state.money < cost) return { ok: false, error: `not enough money (need ${cost})` };

  const next = cloneState(state);
  next.setBonusUpgrades[key] = {
    flatBonusCount: cur.flatBonusCount + (kind === 'flat' ? 1 : 0),
    doubleCount: cur.doubleCount + (kind === 'double' ? 1 : 0),
    mitigateCount: cur.mitigateCount + (kind === 'mitigate' ? 1 : 0),
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
