import { describe, it, expect } from 'vitest';
import { initialSpireState, buyArtifact, type SpireRunState } from '@/lib/spire/state';
import { SPIRE_ARTIFACT_PRICES } from '@/lib/spire/config';

const SEED = 'buy-artifact';

/** A run-state with chosen money/owned-sets/artifacts, on stage 1 attempt 1. */
function stateWith(partial: Partial<SpireRunState>): SpireRunState {
  return { ...initialSpireState(SEED), ...partial };
}

describe('buyArtifact', () => {
  it('ok: eligible + affordable → owned, money -= cost', () => {
    const before = stateWith({ money: 10 });
    const r = buyArtifact(before, 'ledger', 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.artifacts).toEqual(['ledger']);
    expect(r.state.money).toBe(5);
    // input untouched (reducers never mutate).
    expect(before.artifacts).toEqual([]);
    expect(before.money).toBe(10);
  });

  it('accepts every seeded artifact price (4/5/6)', () => {
    for (const price of SPIRE_ARTIFACT_PRICES) {
      const r = buyArtifact(stateWith({ money: 6 }), 'ledger', price);
      expect(r.ok, `price ${price} should be accepted`).toBe(true);
    }
  });

  it('rejects an already-owned artifact', () => {
    const r = buyArtifact(stateWith({ money: 10, artifacts: ['ledger'] }), 'ledger', 5);
    expect(r.ok).toBe(false);
  });

  it('rejects when unaffordable', () => {
    const r = buyArtifact(stateWith({ money: 3 }), 'ledger', 5);
    expect(r.ok).toBe(false);
  });

  it('rejects a set-required artifact whose set is not owned', () => {
    // receipt requires the 'fruit' set; a fresh run owns only 'number'.
    const r = buyArtifact(stateWith({ money: 10 }), 'receipt', 5);
    expect(r.ok).toBe(false);
  });

  it('accepts a set-required artifact once its set is owned', () => {
    const r = buyArtifact(
      stateWith({ money: 10, ownedSetIds: ['number', 'fruit'] }),
      'receipt',
      5,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.artifacts).toEqual(['receipt']);
  });

  it('rejects a bad cost (e.g. 3, not a seeded slot price)', () => {
    const r = buyArtifact(stateWith({ money: 10 }), 'ledger', 3);
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown artifact id', () => {
    const r = buyArtifact(stateWith({ money: 10 }), 'no-such-artifact', 5);
    expect(r.ok).toBe(false);
  });
});
