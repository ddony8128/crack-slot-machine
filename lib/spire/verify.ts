/**
 * 첨탑 오르기 v0 — authoritative server-side verification (SP-F).
 *
 * The server NEVER trusts the client's economy/score numbers: it re-derives the
 * whole run from the seed + action stream via `replaySpireRun` (which re-plays
 * every stage on the same engine) and compares against the client's claim.
 * Pure + dependency-light so it unit-tests directly and the submit route stays
 * a thin wrapper (auth + version gate + DB persistence around this).
 */

import { pickSpireSetChoices } from '@/lib/spire/run';
import { replaySpireRun, type SpireAction, type SpireStageResult } from '@/lib/spire/replay';

export type SpireClaim = { stagesCleared: number; totalScore: number };

export type SpireVerifyResult =
  | {
      status: 'submitted';
      stagesCleared: number;
      totalScore: number;
      money: number;       // run-end balance (→ season points)
      unusedSpins: number; // spins banked over CLEARED stages (→ season points)
      runEnded: boolean;
      endReason: string;
      stageResults: SpireStageResult[];
    }
  | { status: 'rejected'; reason: string };

/**
 * Verify a spire submission. `claim` (the client's reported stagesCleared/
 * totalScore) is optional; when present, any mismatch with the replay is a
 * rejection. The chosen set is checked against the seed's two offered choices
 * (anti-tamper), mirroring replaySpireRun's other state-derived guards.
 */
export function verifySpireRun(
  seed: string,
  actions: SpireAction[],
  claim?: SpireClaim,
): SpireVerifyResult {
  if (!Array.isArray(actions)) return { status: 'rejected', reason: 'actions_not_array' };

  // The chosen set must be one of the two the seed offered before stage 1.
  const choose = actions.find(
    (a): a is Extract<SpireAction, { type: 'choose_set' }> => a?.type === 'choose_set',
  );
  if (choose && !pickSpireSetChoices(seed).includes(choose.chosenSetId)) {
    return { status: 'rejected', reason: 'invalid_set_choice' };
  }

  const r = replaySpireRun(seed, actions);
  if (!r.ok) return { status: 'rejected', reason: r.rejectReason ?? 'replay_failed' };

  if (claim) {
    if (claim.stagesCleared !== r.stagesCleared) return { status: 'rejected', reason: 'stages_mismatch' };
    if (claim.totalScore !== r.totalRunScore) return { status: 'rejected', reason: 'score_mismatch' };
  }

  // Unused spins count ONLY from cleared stages (spec §5) — failed attempts bank
  // nothing.
  const unusedSpins = r.stageResults
    .filter((s) => s.cleared)
    .reduce((sum, s) => sum + s.remainingSpins, 0);

  return {
    status: 'submitted',
    stagesCleared: r.stagesCleared,
    totalScore: r.totalRunScore,
    money: r.finalState.money,
    unusedSpins,
    runEnded: r.runEnded,
    endReason: r.endReason,
    stageResults: r.stageResults,
  };
}
