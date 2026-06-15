import { describe, it, expect } from 'vitest';
import {
  initialSpireState,
  applyArtifactAcquire,
  bagTotal,
  type SpireRunState,
} from '@/lib/spire/state';
import {
  SPIRE_BAG_TOTAL,
  SPIRE_BASE_RULE_IDS,
  SPIRE_RULE_POOL_MAX,
} from '@/lib/spire/config';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { replaySpireRun, type SpireAction } from '@/lib/spire/replay';

/** A fixed seed used across the determinism assertions in this file. */
const DETERMINISM_SEED = 'onacquire-test-seed';

function makeState(overrides: Partial<SpireRunState>): SpireRunState {
  return { ...initialSpireState(DETERMINISM_SEED), ...overrides };
}

describe('applyArtifactAcquire — watering-can (물뿌리개)', () => {
  const bag = { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 };

  it('keeps total 20, never touches zero, +1 the max, -1 some min', () => {
    const state = makeState({
      symbolBag: { ...bag },
      ownedSetIds: ['number', 'fruit'],
    });
    const after = applyArtifactAcquire(state, 'watering-can');

    expect(bagTotal(after.symbolBag)).toBe(SPIRE_BAG_TOTAL);
    // zero excluded → unchanged.
    expect(after.symbolBag.zero).toBe(9);
    // max non-zero is four:5 → +1 → 6.
    expect(after.symbolBag.four).toBe(6);
    // some min (one of cherry/lemon/grape at count 1) dropped to 0 / removed.
    const minIds = ['cherry', 'lemon', 'grape'];
    const removed = minIds.filter((id) => (after.symbolBag[id] ?? 0) === 0);
    expect(removed.length).toBe(1);
    // input not mutated.
    expect(state.symbolBag.four).toBe(5);
  });

  it('is deterministic across two calls (same result)', () => {
    const state = makeState({ symbolBag: { ...bag }, ownedSetIds: ['number', 'fruit'] });
    const a = applyArtifactAcquire(state, 'watering-can');
    const b = applyArtifactAcquire(state, 'watering-can');
    expect(a.symbolBag).toEqual(b.symbolBag);
  });

  it('is a no-op when only one non-zero symbol type exists', () => {
    const state = makeState({ symbolBag: { zero: 18, four: 2 } });
    const after = applyArtifactAcquire(state, 'watering-can');
    expect(after.symbolBag).toEqual({ zero: 18, four: 2 });
    expect(bagTotal(after.symbolBag)).toBe(SPIRE_BAG_TOTAL);
  });
});

describe('applyArtifactAcquire — slot-machine (슬롯머신)', () => {
  const ownedSetIds = ['number', 'fruit'];

  it('rebuilds a valid bag (total 20, only owned symbols, 0/4/7 ≥1)', () => {
    const state = makeState({
      symbolBag: { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 },
      ownedSetIds,
    });
    const after = applyArtifactAcquire(state, 'slot-machine');

    expect(bagTotal(after.symbolBag)).toBe(SPIRE_BAG_TOTAL);

    const allowed = new Set<string>();
    for (const setId of ownedSetIds) {
      for (const sym of SYMBOL_SETS_BY_ID[setId].symbols) allowed.add(sym.id);
    }
    for (const id of Object.keys(after.symbolBag)) {
      expect(allowed.has(id)).toBe(true);
    }
    // number minimums guaranteed.
    expect(after.symbolBag.zero).toBeGreaterThanOrEqual(1);
    expect(after.symbolBag.four).toBeGreaterThanOrEqual(1);
    expect(after.symbolBag.seven).toBeGreaterThanOrEqual(1);
  });

  it('rebuilds rulePool ≤10 drawn only from base + owned-set rules', () => {
    const state = makeState({
      symbolBag: { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 },
      ownedSetIds,
    });
    const after = applyArtifactAcquire(state, 'slot-machine');

    expect(after.rulePool.length).toBeLessThanOrEqual(SPIRE_RULE_POOL_MAX);

    const candidates = new Set<string>(SPIRE_BASE_RULE_IDS);
    for (const setId of ownedSetIds) {
      for (const id of SYMBOL_SETS_BY_ID[setId].ruleIds) candidates.add(id);
    }
    for (const id of after.rulePool) {
      expect(candidates.has(id)).toBe(true);
    }
    // no duplicates in the pool.
    expect(new Set(after.rulePool).size).toBe(after.rulePool.length);
  });

  it('is deterministic across two calls', () => {
    const state = makeState({
      symbolBag: { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 },
      ownedSetIds,
    });
    const a = applyArtifactAcquire(state, 'slot-machine');
    const b = applyArtifactAcquire(state, 'slot-machine');
    expect(a.symbolBag).toEqual(b.symbolBag);
    expect(a.rulePool).toEqual(b.rulePool);
  });
});

describe('applyArtifactAcquire — no-effect artifact', () => {
  it('returns an equal bag/pool (no-op) for ledger', () => {
    const state = makeState({
      symbolBag: { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 },
      ownedSetIds: ['number', 'fruit'],
    });
    const after = applyArtifactAcquire(state, 'ledger');
    expect(after.symbolBag).toEqual(state.symbolBag);
    expect(after.rulePool).toEqual(state.rulePool);
  });
});

describe('replaySpireRun determinism with choose_artifact watering-can', () => {
  it('yields identical finalState.symbolBag on two runs (same seed + stream)', () => {
    const seed = DETERMINISM_SEED;
    const actions: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'choose_artifact', artifactId: 'watering-can' },
    ];
    const r1 = replaySpireRun(seed, actions);
    const r2 = replaySpireRun(seed, actions);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r1.finalState.symbolBag).toEqual(r2.finalState.symbolBag);
    // watering-can ran: bag still totals 20.
    expect(bagTotal(r1.finalState.symbolBag)).toBe(SPIRE_BAG_TOTAL);
  });
});
