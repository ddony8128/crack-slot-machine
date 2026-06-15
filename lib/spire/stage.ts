/**
 * Per-stage run config + immediate-clear interpreter for 첨탑 오르기 v0.
 *
 * Each stage ATTEMPT is its own seeded RC run, built from the run's CURRENT
 * persistent state (symbol bag → weights, rule pool → offer pool). The seed is
 * derived from the run seed + stage + attempt so every attempt (incl. retries
 * after a shop visit) reproduces under replay.
 */

import type { SymbolType } from '@/types';
import type { RunConfig } from '@/store/gameStore';
import { BASE_WEIGHTS } from '@/data/symbols';
import { initialBoardFor } from '@/lib/board/initialBoard';
import { SPIRE_SPINS_PER_STAGE, SPIRE_STAGES } from '@/lib/spire/config';

/** `${runSeed}:stage-${stage}:attempt-${attempt}` — stable per attempt. */
export function stageAttemptSeed(runSeed: string, stage: number, attempt: number): string {
  return `${runSeed}:stage-${stage}:attempt-${attempt}`;
}

/**
 * Convert a symbol bag (counts, only present symbols) to a full
 * Record<SymbolType, number> with 0 defaults. Counts ARE roll weights — a
 * symbol with count 8 is rolled 8× as often as one with count 1.
 */
export function bagToWeights(bag: Record<string, number>): Record<SymbolType, number> {
  const weights = Object.fromEntries(
    (Object.keys(BASE_WEIGHTS) as SymbolType[]).map((s) => [s, 0]),
  ) as Record<SymbolType, number>;
  for (const [sym, count] of Object.entries(bag)) {
    if (count > 0) weights[sym as SymbolType] = count;
  }
  return weights;
}

/** Target score for a 1-based stage (0 if out of range). */
export function spireStageTarget(stage: number): number {
  return SPIRE_STAGES[stage - 1]?.targetScore ?? 0;
}

/**
 * RC config for one stage attempt, from the run's current bag + rule pool.
 * maxSpins is the hard cap (SPIRE_SPINS_PER_STAGE); the controller stops early
 * on clear (see spireStageOutcome).
 */
export function spireStageRunConfig(
  runSeed: string,
  stage: number,
  attempt: number,
  bag: Record<string, number>,
  rulePool: string[],
): RunConfig {
  const weights = bagToWeights(bag);
  const seed = stageAttemptSeed(runSeed, stage, attempt);
  return {
    initialBoard: initialBoardFor(`${seed}:initial`, weights),
    maxSpins: SPIRE_SPINS_PER_STAGE,
    baseWeights: weights,
    provisioning: 'pool',
    rulePoolIds: [...rulePool],
  };
}

export type SpireStageOutcome = {
  cleared: boolean;
  spinsUsed: number;      // spins actually played (≤ SPIRE_SPINS_PER_STAGE)
  remainingSpins: number; // unused spins (for the clear bonus); 0 on fail
  stageScore: number;     // cumulative score through the last played spin
};

/**
 * Interpret a stage attempt's per-spin scores. The stage CLEARS the moment the
 * cumulative score reaches the target (remaining spins go unplayed → bonus);
 * otherwise, after all spins, it fails.
 */
export function spireStageOutcome(perSpinScores: number[], target: number): SpireStageOutcome {
  let cum = 0;
  for (let i = 0; i < perSpinScores.length && i < SPIRE_SPINS_PER_STAGE; i++) {
    cum += perSpinScores[i];
    if (cum >= target) {
      const spinsUsed = i + 1;
      return {
        cleared: true,
        spinsUsed,
        remainingSpins: SPIRE_SPINS_PER_STAGE - spinsUsed,
        stageScore: cum,
      };
    }
  }
  return {
    cleared: false,
    spinsUsed: Math.min(perSpinScores.length, SPIRE_SPINS_PER_STAGE),
    remainingSpins: 0,
    stageScore: cum,
  };
}
