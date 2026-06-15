import type { SymbolType } from '@/types';
import { createSeededRng } from '@/lib/rng';
import {
  createGameStore,
  type GameStore,
  type RecordedAction,
  type RunConfig,
} from '@/store/gameStore';
import { RULES_BY_ID } from '@/data/rules';
import type { StoreApi } from 'zustand/vanilla';

/** Per-spin outcome, shaped to match the client's submitted snapshot. */
export type ReplaySpin = {
  spinIndex: number;
  finalBoard: SymbolType[];
  spinScore: number; // roundScore (after multiplier)
  totalScoreAfterSpin: number; // cumulative totalScore after this spin
};

export type ReplayResult = {
  ok: boolean;
  rejectReason?: string;
  spins: ReplaySpin[];
  finalScore: number;
  bestSpinScore: number;
};

const REPLAY_NICKNAME = 'replay';

/**
 * Dispatch one recorded action against the store. Throws on a structurally
 * invalid action (unknown rule id / malformed shape) so replayRun can reject it.
 */
function dispatch(store: StoreApi<GameStore>, action: RecordedAction): void {
  const s = store.getState();
  switch (action.type) {
    case 'selectRule': {
      const rule = RULES_BY_ID[action.ruleId];
      if (!rule) throw new Error(`unknown ruleId: ${action.ruleId}`);
      s.selectRule(rule);
      return;
    }
    case 'cancelSelection':
      s.cancelSelection();
      return;
    case 'placePending':
      s.placePending(action.target);
      return;
    case 'moveRule':
      s.moveRule(action.from, action.to);
      return;
    case 'spin':
      s.spin();
      return;
    case 'selectCells':
      if (!Array.isArray(action.indices)) throw new Error('bad selectCells');
      s.selectCells(action.indices);
      return;
    case 'next':
      s.next();
      return;
    default: {
      // Exhaustiveness guard: an unrecognised action type is a tampering signal.
      const _exhaustive: never = action;
      throw new Error(`unknown action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Replay a run from its seed + recorded actions and compute the authoritative
 * spins/score. Because this drives the SAME store/engine the client used (just
 * seeded with the same rng), a faithful client's submitted results match this
 * exactly; any divergence means tampering.
 *
 * Never throws: structural problems are returned as `ok:false` + `rejectReason`.
 */
export function replayRun(
  seed: string,
  actions: RecordedAction[],
  config?: RunConfig | null,
): ReplayResult {
  const empty: ReplayResult = {
    ok: false,
    spins: [],
    finalScore: 0,
    bestSpinScore: 0,
  };

  if (!Array.isArray(actions)) {
    return { ...empty, rejectReason: 'actions is not an array' };
  }

  const store = createGameStore(createSeededRng(seed));
  store.getState().setNickname(REPLAY_NICKNAME);
  // Season modes pass a config so the reconstructed run matches the client's.
  if (config) store.getState().configureRun(config);
  store.getState().startGame();

  try {
    for (const action of actions) {
      dispatch(store, action);
    }
  } catch (err) {
    return {
      ...empty,
      rejectReason:
        err instanceof Error ? err.message : 'replay dispatch error',
    };
  }

  const finalState = store.getState();
  const logs = finalState.spinLogs;

  let cumulative = 0;
  let bestSpinScore = 0;
  const spins: ReplaySpin[] = logs.map((log) => {
    cumulative += log.roundScore;
    if (log.roundScore > bestSpinScore) bestSpinScore = log.roundScore;
    return {
      spinIndex: log.spinIndex,
      finalBoard: [...log.finalResult],
      spinScore: log.roundScore,
      totalScoreAfterSpin: cumulative,
    };
  });

  return {
    ok: true,
    spins,
    finalScore: finalState.totalScore,
    bestSpinScore,
  };
}
