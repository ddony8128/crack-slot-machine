/**
 * 첨탑 오르기 v0 — pure run replayer (SP-E). Shared by the client (to know its
 * live state) and the server (to verify a submission, SP-F).
 *
 * A spire run is a flat, ordered `SpireAction[]`:
 *   choose_set → [play_stage → (artifact?) → shop buys…] → play_stage → …
 *
 * Each `play_stage` is a self-contained RC run replayed by the existing
 * `replayRun` (so per-spin boards/scores are reproduced by the SAME engine the
 * client used). The pure SP-B economy reducers thread `SpireRunState` between
 * stages; settlement/shop are recomputed here, never trusted from the client.
 * Stage/attempt numbers are DERIVED from the threaded state (anti-tamper).
 */

import type { RecordedAction } from '@/store/gameStore';
import { replayRun } from '@/lib/replay';
import {
  initialSpireState,
  applyInitialSetChoice,
  buySymbolIncrement,
  buySymbolSet,
  buyRule,
  buyArtifact,
  buyHandFlat,
  buyHandDouble,
  rerollShop,
  settleClear,
  settleFail,
  applyArtifactAcquire,
  type SpireRunState,
} from '@/lib/spire/state';
import {
  spireStageRunConfig,
  spireStageOutcome,
  spireStageTarget,
  goldBarMoney,
} from '@/lib/spire/stage';
import { SPIRE_STAGE_COUNT } from '@/lib/spire/config';
import { ARTIFACTS_BY_ID } from '@/lib/spire/artifacts';

export type SpireAction =
  | { type: 'choose_set'; chosenSetId: string }
  | { type: 'play_stage'; actions: RecordedAction[] }
  | { type: 'buy_symbol'; targetSymbolId: string; replacedSymbolId: string }
  | { type: 'buy_set'; setId: string; replacedSymbolIds: string[]; removedRuleIds?: string[] }
  | { type: 'buy_rule'; ruleId: string; removedRuleId?: string }
  | { type: 'buy_artifact'; artifactId: string; cost: number }
  | { type: 'buy_hand_flat'; handType: string }
  | { type: 'buy_hand_double'; handType: string }
  | { type: 'reroll_shop' }
  | { type: 'choose_artifact'; artifactId: string | null };

export type SpireStageResult = {
  stage: number;
  attempt: number;
  cleared: boolean;
  stageScore: number;
  spinsUsed: number;
  remainingSpins: number;
};

export type SpireReplayResult = {
  ok: boolean;
  rejectReason?: string;
  finalState: SpireRunState;
  stageResults: SpireStageResult[];
  stagesCleared: number;  // highest stage fully cleared (0..10)
  totalRunScore: number;
  runEnded: boolean;      // failed out (3rd fail) OR cleared stage 10
  endReason: 'completed' | 'failed-out' | 'in-progress';
};

/**
 * Replay a full spire run from its seed + action stream. Never throws; any
 * structural/illegal action returns ok:false + rejectReason (the partial state
 * is still returned for debugging).
 */
export function replaySpireRun(runSeed: string, actions: SpireAction[]): SpireReplayResult {
  let state = initialSpireState(runSeed);
  const stageResults: SpireStageResult[] = [];
  let runEnded = false;
  let endReason: SpireReplayResult['endReason'] = 'in-progress';
  // chime (차임벨): rerolls used in the CURRENT shop visit (the buys after one
  // play_stage). Reset to 0 right after each play_stage; the first 2 are free.
  let shopRerolls = 0;

  const fail = (reason: string): SpireReplayResult => ({
    ok: false,
    rejectReason: reason,
    finalState: state,
    stageResults,
    stagesCleared: state.currentStage - 1,
    totalRunScore: state.totalRunScore,
    runEnded,
    endReason,
  });

  if (!Array.isArray(actions)) return fail('actions is not an array');

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (runEnded) return fail(`action after run ended: ${action?.type}`);

    switch (action.type) {
      case 'choose_set': {
        // The initial set choice happens exactly once, before stage 1 — at which
        // point only the base 'number' set is owned.
        if (state.ownedSetIds.length !== 1) return fail('set already chosen');
        const r = applyInitialSetChoice(state, action.chosenSetId);
        if (!r.ok) return fail(r.error);
        state = r.state;
        break;
      }

      case 'play_stage': {
        const stage = state.currentStage;
        const attempt = state.currentStageAttempt;
        if (stage < 1 || stage > SPIRE_STAGE_COUNT) return fail(`play_stage out of range: ${stage}`);
        if (state.ownedSetIds.length < 2) return fail('play_stage before choosing a set');

        const cfg = spireStageRunConfig(
          runSeed,
          stage,
          attempt,
          state.symbolBag,
          state.rulePool,
          state.handUpgrades,
          state.artifacts,
        );
        const seed = `${runSeed}:stage-${stage}:attempt-${attempt}`;
        const rr = replayRun(seed, action.actions, cfg);
        if (!rr.ok) return fail(`stage ${stage}.${attempt}: ${rr.rejectReason}`);

        const outcome = spireStageOutcome(
          rr.spins.map((s) => s.spinScore),
          spireStageTarget(stage),
        );
        stageResults.push({
          stage,
          attempt,
          cleared: outcome.cleared,
          stageScore: outcome.stageScore,
          spinsUsed: outcome.spinsUsed,
          remainingSpins: outcome.remainingSpins,
        });

        // gold-bar (금괴): accrue +1 per spin with ≥4 gems at STAGE END, BEFORE
        // settlement, for BOTH clear and fail (so ledger interest counts it).
        const goldBar = goldBarMoney(
          rr.spins.map((s) => s.finalBoard),
          state.artifacts,
        );
        state = { ...state, money: state.money + goldBar };
        // A new shop visit begins after this stage — reset the chime counter.
        shopRerolls = 0;

        if (outcome.cleared) {
          const r = settleClear(state, outcome.remainingSpins, outcome.stageScore);
          if (!r.ok) return fail(r.error);
          state = r.state;
          if (stage >= SPIRE_STAGE_COUNT) {
            runEnded = true;
            endReason = 'completed';
          }
        } else {
          const r = settleFail(state);
          if (!r.ok) return fail(r.error);
          state = r.state;
          if (r.breakdown?.ended) {
            runEnded = true;
            endReason = 'failed-out';
          }
        }
        break;
      }

      case 'buy_symbol': {
        const r = buySymbolIncrement(state, action.targetSymbolId, action.replacedSymbolId);
        if (!r.ok) return fail(r.error);
        state = r.state;
        break;
      }
      case 'buy_set': {
        const r = buySymbolSet(state, action.setId, action.replacedSymbolIds, action.removedRuleIds ?? []);
        if (!r.ok) return fail(r.error);
        state = r.state;
        break;
      }
      case 'buy_rule': {
        const r = buyRule(state, action.ruleId, action.removedRuleId);
        if (!r.ok) return fail(r.error);
        state = r.state;
        break;
      }
      case 'buy_artifact': {
        const r = buyArtifact(state, action.artifactId, action.cost);
        if (!r.ok) return fail(r.error);
        // The artifact id is now in state.artifacts; apply its onAcquire effect at
        // the SAME point the live client does so the two states stay identical.
        state = applyArtifactAcquire(r.state, action.artifactId);
        break;
      }
      case 'buy_hand_flat': {
        const r = buyHandFlat(state, action.handType);
        if (!r.ok) return fail(r.error);
        state = r.state;
        break;
      }
      case 'buy_hand_double': {
        const r = buyHandDouble(state, action.handType);
        if (!r.ok) return fail(r.error);
        state = r.state;
        break;
      }
      case 'reroll_shop': {
        // chime: first 2 rerolls of this shop visit are free. Freeness is DERIVED
        // (artifact + per-visit index), never read from the parameterless action.
        const free = state.artifacts.includes('chime') && shopRerolls < 2;
        shopRerolls += 1;
        const r = rerollShop(state, free);
        if (!r.ok) return fail(r.error);
        state = r.state;
        break;
      }
      case 'choose_artifact': {
        // v0 reward pick (skip = null). At minimum reject an UNKNOWN artifact id
        // (catalog membership) as a tampering signal, and silently skip an
        // already-owned one. FULL offer-set validation — that this id was one of
        // the ≤2 seeded-offered artifacts at THIS reward step, including its
        // requiredSet — is deferred to the seeded shop generator (SP-H); it can't
        // be enforced here without recomputing that offer.
        if (action.artifactId) {
          if (!ARTIFACTS_BY_ID[action.artifactId]) {
            return fail(`unknown artifact: ${action.artifactId}`);
          }
          if (!state.artifacts.includes(action.artifactId)) {
            state = { ...state, artifacts: [...state.artifacts, action.artifactId] };
            // Apply onAcquire right after the id is added — same point as the live
            // client (components/SpireClient.tsx `choose`).
            state = applyArtifactAcquire(state, action.artifactId);
          }
        }
        break;
      }

      default: {
        const _exhaustive: never = action;
        return fail(`unknown action: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  return {
    ok: true,
    finalState: state,
    stageResults,
    stagesCleared: state.currentStage - 1,
    totalRunScore: state.totalRunScore,
    runEnded,
    endReason,
  };
}
