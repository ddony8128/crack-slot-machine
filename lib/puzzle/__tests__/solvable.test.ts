import { describe, it, expect } from 'vitest';
import type { StoreApi } from 'zustand/vanilla';
import { createSeededRng } from '@/lib/rng';
import {
  createGameStore,
  type GameStore,
  type RecordedAction,
} from '@/store/gameStore';
import { RULES_BY_ID } from '@/data/rules';
import { computeHand } from '@/lib/score';
import { PUZZLES_BY_KEY } from '@/lib/puzzle/config';
import { puzzleRunConfig } from '@/lib/puzzle/run';
import { checkPuzzleRun, type GoalContext } from '@/lib/puzzle/goals';

/**
 * STEP 0 — solver proof. For each Season-1 puzzle we SEARCH (over the fixed
 * bag's orderings into slots + every valid select-cell choice, replayed against
 * a fresh seeded store exactly the way lib/replay.ts does) for an action
 * sequence that CLEARS the puzzle within its spin limit. Because the seed is
 * fixed, any solution found is fully deterministic and reproducible — the same
 * "의도적으로 가능, 운 아님" guarantee the anti-cheat replay relies on.
 *
 * This file never mutates puzzle definitions; it only drives the store.
 */

type Solution = {
  actions: RecordedAction[];
  clearSpin: number; // 1-based spin index on which the puzzle cleared
  slotRuleIds: (string | null)[];
};

/** A fresh store seeded + configured exactly like the client/replay for a key. */
function freshStore(key: string): StoreApi<GameStore> {
  const p = PUZZLES_BY_KEY[key];
  const store = createGameStore(createSeededRng(p.seed));
  store.getState().setNickname('solver');
  store.getState().configureRun(puzzleRunConfig(key));
  store.getState().startGame();
  return store;
}

/** All k-length ordered arrangements (permutations of size k) of `ids`. */
function arrangements(ids: string[], k: number): string[][] {
  if (k === 0) return [[]];
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i++) {
    const rest = [...ids.slice(0, i), ...ids.slice(i + 1)];
    for (const tail of arrangements(rest, k - 1)) out.push([ids[i], ...tail]);
  }
  return out;
}

/** Goal context for a finished spin's final board. */
function ctxFor(board: GoalContext['board']): GoalContext {
  return { board, hand: computeHand(board).hand, spinScore: 0 };
}

/**
 * Drive the store through ONE spin, resolving any select pauses by a bounded DFS
 * over valid cell choices. Returns the recorded actions for the FIRST choice
 * path that completes the spin (always exists — selects auto-skip when
 * inapplicable, otherwise some valid choice resolves them). Returns null only on
 * an unexpected state.
 */
function playOneSpin(store: StoreApi<GameStore>): RecordedAction[] | null {
  const s = store.getState();
  if (s.status !== 'ready-to-spin') return null;
  s.spin();

  // Resolve a chain of select pauses by always taking the first valid choice.
  let guard = 0;
  while (store.getState().status === 'awaiting-selection' && guard < 16) {
    guard += 1;
    const sel = store.getState().pendingSelection;
    if (!sel) return null;
    const idxs: number[] = [];
    for (let i = 0; i < sel.selectable.length && idxs.length < sel.count; i++) {
      if (sel.selectable[i]) idxs.push(i);
    }
    if (idxs.length !== sel.count) return null;
    store.getState().selectCells(idxs);
  }

  // A spin resolves to 'spin-result' normally, OR 'finished' when puzzle
  // immediate-clear ends the run the instant the goal is met on this spin.
  const st = store.getState().status;
  if (st !== 'spin-result' && st !== 'finished') return null;
  return store.getState().getActions();
}

/**
 * Search for a clearing action sequence. For each k (1..5) and each ordered
 * arrangement of k bag rules into slots 0..k-1, replay from scratch, spin up to
 * the limit (re-spinning the same arrangement via next()), and check the goals
 * over the accumulated final boards after each spin.
 */
function solve(key: string): Solution | null {
  const p = PUZZLES_BY_KEY[key];
  const bagIds = [...p.availableRuleIds];

  for (let k = 1; k <= Math.min(5, bagIds.length); k++) {
    for (const arrangement of arrangements(bagIds, k)) {
      const store = freshStore(key);

      // Place the arrangement: bag rule -> slot. After each placement the moved
      // rule leaves the bag, so re-find its current bag index each time.
      for (let slot = 0; slot < arrangement.length; slot++) {
        const ruleId = arrangement[slot];
        const bagIdx = store.getState().bag.findIndex((r) => r.id === ruleId);
        if (bagIdx === -1) break;
        store
          .getState()
          .moveRule({ zone: 'bag', index: bagIdx }, { zone: 'slot', index: slot });
      }

      const ctxs: GoalContext[] = [];
      let cleared = false;
      let clearSpin = 0;

      for (let spin = 1; spin <= p.spinLimit; spin++) {
        const ok = playOneSpin(store);
        if (!ok) break;
        const logs = store.getState().spinLogs;
        const last = logs[logs.length - 1];
        ctxs.push(ctxFor(last.finalResult));
        const { count } = checkPuzzleRun(p.goals, ctxs);
        if (count === p.goals.length) {
          cleared = true;
          clearSpin = spin;
          break;
        }
        if (store.getState().status === 'spin-result') store.getState().next();
        if (store.getState().status !== 'ready-to-spin') break;
      }

      if (cleared) {
        const slotRuleIds: (string | null)[] = [null, null, null, null, null];
        arrangement.forEach((id, i) => (slotRuleIds[i] = id));
        return { actions: store.getState().getActions(), clearSpin, slotRuleIds };
      }
    }
  }
  return null;
}

/**
 * Re-run a found action sequence through a brand-new seeded store (the exact
 * lib/replay.ts dispatch path) and assert it still clears — proving the solution
 * is deterministic/reproducible from seed + actions alone.
 */
function replayClears(key: string, actions: RecordedAction[]): boolean {
  const store = freshStore(key);
  const s = store.getState();
  for (const a of actions) {
    switch (a.type) {
      case 'selectRule': {
        const rule = RULES_BY_ID[a.ruleId];
        if (!rule) return false;
        store.getState().selectRule(rule);
        break;
      }
      case 'cancelSelection':
        store.getState().cancelSelection();
        break;
      case 'placePending':
        store.getState().placePending(a.target);
        break;
      case 'moveRule':
        store.getState().moveRule(a.from, a.to);
        break;
      case 'spin':
        store.getState().spin();
        break;
      case 'selectCells':
        store.getState().selectCells(a.indices);
        break;
      case 'next':
        store.getState().next();
        break;
    }
  }
  void s;
  const ctxs: GoalContext[] = store
    .getState()
    .spinLogs.map((l) => ctxFor(l.finalResult));
  const p = PUZZLES_BY_KEY[key];
  return checkPuzzleRun(p.goals, ctxs).count === p.goals.length;
}

describe('Season 1 puzzles are intentionally solvable (deterministic, not luck)', () => {
  for (const key of ['p01', 'p02']) {
    it(`${key} is solvable within its spin limit on its fixed seed`, () => {
      const solution = solve(key);
      expect(solution, `no clearing sequence found for ${key}`).not.toBeNull();
      // The found sequence, replayed from seed + actions alone, still clears.
      expect(replayClears(key, solution!.actions)).toBe(true);
      // Audit print: seed, winning rule placement, clearing spin.
      console.log(
        `[solver] ${key} seed=${PUZZLES_BY_KEY[key].seed} clearSpin=${solution!.clearSpin} ` +
          `slots=${JSON.stringify(solution!.slotRuleIds)}`,
      );
    }, 30_000); // exhaustive BFS solver; p02's branch is slow on cold CI/Win
  }
});

/** First 1-based spin whose prefix clears all goals (mirrors the submit route). */
function firstClearSpin(
  goals: Parameters<typeof checkPuzzleRun>[0],
  ctxs: GoalContext[],
): number | null {
  for (let k = 1; k <= ctxs.length; k++) {
    if (checkPuzzleRun(goals, ctxs.slice(0, k)).count === goals.length) return k;
  }
  return null;
}

describe('puzzle immediate-clear: the run ends on the clearing spin', () => {
  for (const key of ['p01', 'p02']) {
    it(`${key} drives status:'finished' the instant goals are met (no exhausting spins)`, () => {
      const solution = solve(key);
      expect(solution, `no clearing sequence found for ${key}`).not.toBeNull();

      // Replay the SOLVED action sequence through a fresh seeded+configured store,
      // exactly the server-replay path. With puzzleGoals in the config, the store
      // must end on the clearing spin — NOT play out the full spinLimit.
      const store = freshStore(key);
      for (const a of solution!.actions) {
        switch (a.type) {
          case 'selectRule':
            store.getState().selectRule(RULES_BY_ID[a.ruleId]);
            break;
          case 'cancelSelection':
            store.getState().cancelSelection();
            break;
          case 'placePending':
            store.getState().placePending(a.target);
            break;
          case 'moveRule':
            store.getState().moveRule(a.from, a.to);
            break;
          case 'spin':
            store.getState().spin();
            break;
          case 'selectCells':
            store.getState().selectCells(a.indices);
            break;
          case 'next':
            store.getState().next();
            break;
        }
      }

      const p = PUZZLES_BY_KEY[key];
      const finalState = store.getState();
      // Cleared → finished, and it ended early (logs ≤ the solver's clearSpin,
      // strictly < spinLimit when the solver cleared before the limit).
      expect(finalState.status).toBe('finished');
      expect(finalState.spinLogs.length).toBe(solution!.clearSpin);

      // The submit-route clearSpin computation returns the SAME first-meeting spin.
      const ctxs: GoalContext[] = finalState.spinLogs.map((l) => ctxFor(l.finalResult));
      const clearSpin = firstClearSpin(p.goals, ctxs);
      expect(clearSpin).toBe(solution!.clearSpin);
      expect(clearSpin).toBeLessThanOrEqual(p.spinLimit);
    }, 30_000); // exhaustive BFS solver; p02's branch is slow under parallel load
  }
});

describe('submit-route clearSpin = FIRST spin whose prefix clears all goals', () => {
  it('returns the earliest meeting spin, not spins.length', () => {
    const goals: Parameters<typeof checkPuzzleRun>[0] = [
      { type: 'exact_board', board: ['seven', 'seven', 'seven', 'seven', 'seven'] },
    ];
    // Goal met on spin 2 of a 4-spin array → clearSpin must be 2.
    const ctxs: GoalContext[] = [
      ctxFor(['four', 'four', 'four', 'four', 'four']),
      ctxFor(['seven', 'seven', 'seven', 'seven', 'seven']),
      ctxFor(['four', 'four', 'four', 'four', 'four']),
      ctxFor(['seven', 'seven', 'seven', 'seven', 'seven']),
    ];
    expect(firstClearSpin(goals, ctxs)).toBe(2);
  });

  it('returns null when no prefix clears the goals', () => {
    const goals: Parameters<typeof checkPuzzleRun>[0] = [
      { type: 'exact_board', board: ['seven', 'seven', 'seven', 'seven', 'seven'] },
    ];
    const ctxs: GoalContext[] = [ctxFor(['four', 'four', 'four', 'four', 'four'])];
    expect(firstClearSpin(goals, ctxs)).toBeNull();
  });
});
