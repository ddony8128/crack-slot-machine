import { describe, it, expect } from 'vitest';
import { createSeededRng } from '@/lib/rng';
import {
  createGameStore,
  type GameStore,
  type RuleLocation,
} from '@/store/gameStore';
import { replayRun } from '@/lib/replay';
import type { StoreApi } from 'zustand/vanilla';

/**
 * Fuzz: drive the REAL store like a human would — including the awkward paths
 * (pick a rule, cancel, pick another; drop into random slots/bag; drag-reorder
 * before spinning; random select-cell picks; extra picks on zero-draw) — then
 * replay the recorded actions through the server verifier and assert the result
 * is identical. This is the contract the anti-cheat depends on: an honest run
 * must always reproduce, byte-for-byte.
 *
 * Decisions use a SEPARATE seeded rng so each case is deterministic/reproducible
 * and never touches the game rng.
 */

type S = StoreApi<GameStore>;

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
}

function randomMove(store: S, r: () => number): void {
  const st = store.getState();
  const slotIdxs = st.ruleSlots.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  const bagIdxs = st.bag.map((_, i) => i);
  const sources: RuleLocation[] = [
    ...slotIdxs.map((i) => ({ zone: 'slot', index: i }) as RuleLocation),
    ...bagIdxs.map((i) => ({ zone: 'bag', index: i }) as RuleLocation),
  ];
  if (sources.length === 0) return;
  const from = pick(sources, r);
  const to: RuleLocation =
    r() < 0.5
      ? { zone: 'slot', index: Math.floor(r() * 5) }
      : { zone: 'bag', index: Math.floor(r() * (st.bag.length + 1)) };
  store.getState().moveRule(from, to);
}

function fuzzPlay(seed: string, decisionSeed: string): S {
  const store = createGameStore(createSeededRng(seed));
  const r = createSeededRng(decisionSeed);
  const s = () => store.getState();
  s().setNickname('fuzz');
  s().startGame();

  let guard = 0;
  while (s().status !== 'finished' && guard++ < 5000) {
    const st = s();
    switch (st.status) {
      case 'choosing-rule': {
        s().selectRule(pick(st.offeredRules, r));
        // Sometimes cancel and re-pick a (possibly different) offered rule.
        if (r() < 0.35) {
          s().cancelSelection();
          s().selectRule(pick(s().offeredRules, r));
        }
        // Place into a random slot or the bag.
        if (r() < 0.2) s().placePending({ type: 'bag' });
        else s().placePending({ type: 'slot', index: Math.floor(r() * 5) });
        // Occasionally reorder afterwards.
        if (r() < 0.3) randomMove(store, r);
        break;
      }
      case 'ready-to-spin': {
        if (r() < 0.4) randomMove(store, r); // reorder before pulling the lever
        s().spin();
        break;
      }
      case 'awaiting-selection': {
        const sel = s().pendingSelection!;
        const selectable = sel.selectable.flatMap((ok, i) => (ok ? [i] : []));
        // choose `count` distinct selectable cells at random
        const chosen: number[] = [];
        const pool = [...selectable];
        while (chosen.length < sel.count && pool.length > 0) {
          const idx = Math.floor(r() * pool.length);
          chosen.push(pool.splice(idx, 1)[0]);
        }
        s().selectCells(chosen);
        break;
      }
      case 'spin-result': {
        if (r() < 0.2) randomMove(store, r); // reorder between spins
        s().next();
        break;
      }
      default: {
        if (s().pendingRule) s().placePending({ type: 'slot', index: 0 });
        break;
      }
    }
  }
  expect(s().status).toBe('finished');
  return store;
}

function assertReplayMatches(seed: string, store: S) {
  const actions = store.getState().getActions();
  const logs = store.getState().spinLogs;
  const liveTotal = store.getState().totalScore;
  const liveBest = Math.max(0, ...logs.map((l) => l.roundScore));

  const replay = replayRun(seed, actions);

  expect(replay.ok, `replay.ok for seed ${seed}: ${replay.rejectReason}`).toBe(true);
  expect(replay.finalScore, `finalScore seed ${seed}`).toBe(liveTotal);
  expect(replay.bestSpinScore, `bestSpin seed ${seed}`).toBe(liveBest);
  expect(replay.spins.length, `spin count seed ${seed}`).toBe(logs.length);
  replay.spins.forEach((spin, i) => {
    expect(spin.finalBoard, `board seed ${seed} spin ${i}`).toEqual(
      logs[i].finalResult,
    );
    expect(spin.spinScore, `score seed ${seed} spin ${i}`).toBe(
      logs[i].roundScore,
    );
    expect(spin.totalScoreAfterSpin).toBe(
      logs.slice(0, i + 1).reduce((a, l) => a + l.roundScore, 0),
    );
  });
}

/** Play to finish always taking the first offer/first selectable (after the caller
 *  has performed any prefix actions). */
function finishSimply(store: S) {
  const s = () => store.getState();
  let guard = 0;
  while (s().status !== 'finished' && guard++ < 5000) {
    const st = s();
    if (st.status === 'choosing-rule') {
      s().selectRule(st.offeredRules[0]);
      s().placePending({ type: 'slot', index: 0 });
    } else if (st.status === 'ready-to-spin') s().spin();
    else if (st.status === 'awaiting-selection') {
      const sel = s().pendingSelection!;
      const picks: number[] = [];
      for (let i = 0; i < sel.selectable.length && picks.length < sel.count; i++)
        if (sel.selectable[i]) picks.push(i);
      s().selectCells(picks);
    } else if (st.status === 'spin-result') s().next();
    else if (s().pendingRule) s().placePending({ type: 'slot', index: 0 });
  }
}

describe('replay fuzz — server verification matches live play', () => {
  const N = 500;

  it('explicit regression: cancel then re-pick a DIFFERENT rule replays exactly', () => {
    const seed = 'explicit-cancel-repick';
    const store = createGameStore(createSeededRng(seed));
    const s = () => store.getState();
    s().setNickname('x');
    s().startGame();

    const offers = s().offeredRules;
    expect(offers.length).toBeGreaterThanOrEqual(2);
    s().selectRule(offers[0]);
    s().cancelSelection();
    s().selectRule(offers[1]); // a different rule than first picked
    s().placePending({ type: 'slot', index: 0 });
    // The rule actually placed must be the SECOND choice (proves cancel took).
    expect(s().ruleSlots[0]?.id).toBe(offers[1].id);

    finishSimply(store);
    assertReplayMatches(seed, store);
  });

  it(`reproduces ${N} randomized runs exactly (incl. cancel/reorder/select)`, () => {
    for (let i = 0; i < N; i++) {
      const seed = `fuzz-seed-${i}`;
      const decisionSeed = `decide-${i}`;
      const store = fuzzPlay(seed, decisionSeed);
      assertReplayMatches(seed, store);
    }
  });

  it('idempotent: same seed+actions twice is identical', () => {
    const store = fuzzPlay('repeat-seed', 'repeat-decide');
    const actions = store.getState().getActions();
    expect(replayRun('repeat-seed', actions)).toEqual(
      replayRun('repeat-seed', actions),
    );
  });
});
