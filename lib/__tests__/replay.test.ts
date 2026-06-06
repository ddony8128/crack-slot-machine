import { describe, it, expect } from 'vitest';
import { createSeededRng } from '@/lib/rng';
import { createGameStore } from '@/store/gameStore';
import { replayRun } from '@/lib/replay';

/**
 * Drive a seeded store to completion making deterministic choices (always the
 * first offered rule into slot 0; first selectable cell(s) for select rules).
 * Returns the finished store so the test can read its action log + results.
 */
function playToFinish(seed: string) {
  const store = createGameStore(createSeededRng(seed));
  const s = () => store.getState();
  s().setNickname('tester');
  s().startGame();

  let guard = 0;
  while (s().status !== 'finished' && guard < 1000) {
    guard += 1;
    const st = s();
    switch (st.status) {
      case 'choosing-rule': {
        const offer = st.offeredRules[0];
        st.selectRule(offer);
        s().placePending({ type: 'slot', index: 0 });
        break;
      }
      case 'ready-to-spin':
        st.spin();
        break;
      case 'awaiting-selection': {
        const sel = st.pendingSelection!;
        const picks: number[] = [];
        for (let i = 0; i < sel.selectable.length && picks.length < sel.count; i++) {
          if (sel.selectable[i]) picks.push(i);
        }
        st.selectCells(picks);
        break;
      }
      case 'spin-result':
        st.next();
        break;
      default:
        // 'placing' shouldn't linger; nudge by placing.
        if (st.pendingRule) s().placePending({ type: 'slot', index: 0 });
        break;
    }
  }
  expect(s().status).toBe('finished');
  return store;
}

describe('replayRun', () => {
  it('reproduces the exact spins, finalScore and bestSpinScore of a played run', () => {
    const seed = 'seed-alpha';
    const store = playToFinish(seed);
    const actions = store.getState().getActions();
    const logs = store.getState().spinLogs;
    const liveTotal = store.getState().totalScore;
    const liveBest = Math.max(0, ...logs.map((l) => l.roundScore));

    const result = replayRun(seed, actions);

    expect(result.ok).toBe(true);
    expect(result.finalScore).toBe(liveTotal);
    expect(result.bestSpinScore).toBe(liveBest);
    expect(result.spins).toHaveLength(logs.length);
    result.spins.forEach((spin, i) => {
      expect(spin.spinIndex).toBe(logs[i].spinIndex);
      expect(spin.finalBoard).toEqual(logs[i].finalResult);
      expect(spin.spinScore).toBe(logs[i].roundScore);
    });
  });

  it('is deterministic: same seed + actions yields identical results across calls', () => {
    const seed = 'seed-bravo';
    const store = playToFinish(seed);
    const actions = store.getState().getActions();

    const a = replayRun(seed, actions);
    const b = replayRun(seed, actions);
    expect(a).toEqual(b);
  });

  it('different seeds generally diverge (different rule offers / rolls)', () => {
    const s1 = playToFinish('seed-charlie');
    const r1 = replayRun('seed-charlie', s1.getState().getActions());
    // Replaying charlie's actions under a different seed produces different
    // offers/rolls, so the boards (and almost always the score) differ.
    const r2 = replayRun('seed-delta', s1.getState().getActions());
    expect(r2.ok).toBe(true);
    const boards1 = r1.spins.map((s) => s.finalBoard.join());
    const boards2 = r2.spins.map((s) => s.finalBoard.join());
    expect(boards2).not.toEqual(boards1);
  });

  it('rejects an action referencing an unknown rule id', () => {
    const result = replayRun('seed-echo', [
      { type: 'selectRule', ruleId: 'does-not-exist' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.rejectReason).toContain('does-not-exist');
  });

  it('rejects a non-array actions payload', () => {
    // @ts-expect-error intentional bad input
    const result = replayRun('seed-foxtrot', null);
    expect(result.ok).toBe(false);
  });
});

describe('createSeededRng', () => {
  it('is deterministic and stays within [0,1)', () => {
    const a = createSeededRng('x');
    const b = createSeededRng('x');
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds produce different streams', () => {
    const a = createSeededRng('one');
    const b = createSeededRng('two');
    const sa = Array.from({ length: 10 }, () => a());
    const sb = Array.from({ length: 10 }, () => b());
    expect(sa).not.toEqual(sb);
  });
});
