import { replayRun } from '@/lib/replay';
import type { ClientResults } from '@/lib/db/types';
import type { RecordedAction, RunConfig } from '@/store/gameStore';

export type VerifyOutcome =
  | { status: 'submitted'; score: number; bestSpinScore: number }
  | { status: 'rejected'; reason: string };

/**
 * Authoritative server check: replay the run from its seed + actions and compare
 * against the client's submitted snapshot. The server's replayed numbers are the
 * only ones ever trusted/stored. Any divergence (or a structurally invalid
 * action log) is a rejection.
 *
 * Pure & HTTP-free so it can be unit-tested directly.
 */
export function verifySubmission(
  seed: string,
  actions: RecordedAction[],
  client: ClientResults | null | undefined,
  config?: RunConfig | null,
): VerifyOutcome {
  const replay = replayRun(seed, actions, config);
  if (!replay.ok) {
    return { status: 'rejected', reason: replay.rejectReason ?? 'replay_failed' };
  }

  if (!client || !Array.isArray(client.spins)) {
    return { status: 'rejected', reason: 'missing_client_results' };
  }

  if (client.finalScore !== replay.finalScore) {
    return { status: 'rejected', reason: 'final_score_mismatch' };
  }
  if (client.bestSpinScore !== replay.bestSpinScore) {
    return { status: 'rejected', reason: 'best_spin_score_mismatch' };
  }
  if (client.spins.length !== replay.spins.length) {
    return { status: 'rejected', reason: 'spin_count_mismatch' };
  }

  for (let i = 0; i < replay.spins.length; i++) {
    const a = replay.spins[i];
    const b = client.spins[i];
    if (
      !b ||
      a.spinIndex !== b.spinIndex ||
      a.spinScore !== b.spinScore ||
      a.totalScoreAfterSpin !== b.totalScoreAfterSpin ||
      a.finalBoard.length !== b.finalBoard?.length ||
      a.finalBoard.some((cell, j) => cell !== b.finalBoard[j])
    ) {
      return { status: 'rejected', reason: `spin_${i}_mismatch` };
    }
  }

  return {
    status: 'submitted',
    score: replay.finalScore,
    bestSpinScore: replay.bestSpinScore,
  };
}
