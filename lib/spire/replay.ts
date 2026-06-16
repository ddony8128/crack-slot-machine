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
import { SPIRE_STAGE_COUNT, SPIRE_ARTIFACT_STAGES } from '@/lib/spire/config';
import { ARTIFACTS_BY_ID, artifactOffered } from '@/lib/spire/artifacts';
import { spireRewardArtifacts } from '@/lib/spire/shop';

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
  // The artifact stage (3/6/9) just cleared whose seeded reward pick is still
  // pending. A `choose_artifact` is ONLY legal while this is set, and the chosen
  // id MUST be one of that step's seeded reward offers (anti-cheat, SP-H). Reset
  // after the pick is consumed (or skipped).
  let pendingRewardStage: number | null = null;

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
        // The artifact reward pick (after a 3/6/9 clear) must be resolved before
        // the next stage starts — mirrors the client (no stage from the reward
        // screen), and stops a forged stream from skipping reward validation.
        if (pendingRewardStage !== null) return fail('play_stage before resolving artifact reward');

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
          } else if (SPIRE_ARTIFACT_STAGES.includes(stage)) {
            // Clearing an artifact stage opens a reward pick BEFORE the shop —
            // the next legal action is exactly one `choose_artifact`.
            pendingRewardStage = stage;
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
        // v0 reward pick (skip = null). A reward pick is ONLY legal right after
        // clearing an artifact stage (3/6/9); otherwise it is a tampering signal.
        if (pendingRewardStage === null) {
          return fail('choose_artifact outside a reward step');
        }
        const rewardStage = pendingRewardStage;
        // Consume the pending reward regardless of pick/skip outcome below.
        pendingRewardStage = null;

        if (action.artifactId) {
          const def = ARTIFACTS_BY_ID[action.artifactId];
          if (!def) {
            return fail(`unknown artifact: ${action.artifactId}`);
          }
          // FULL offer-set validation (SP-H): recompute the SAME seeded reward
          // offer the client showed at this step and require the chosen id to be
          // one of those ≤2 artifacts, AND still pass eligibility (requiredSet +
          // not-already-owned). A legit client pick always lands in this set, so
          // honest runs reproduce exactly; a forged id is rejected.
          const offered = spireRewardArtifacts(state, rewardStage).map((o) => o.id);
          if (!offered.includes(action.artifactId)) {
            return fail(`artifact not offered at reward step: ${action.artifactId}`);
          }
          if (!artifactOffered(def, state.ownedSetIds, state.artifacts)) {
            return fail(`artifact not eligible: ${action.artifactId}`);
          }
          state = { ...state, artifacts: [...state.artifacts, action.artifactId] };
          // Apply onAcquire right after the id is added — same point as the live
          // client (components/SpireClient.tsx `choose`).
          state = applyArtifactAcquire(state, action.artifactId);
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
