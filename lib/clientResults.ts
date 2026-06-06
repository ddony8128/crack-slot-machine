import type { SpinLog } from '@/types';
import type { ClientResults } from '@/lib/db/types';

/**
 * Build the result snapshot the client submits, derived purely from the store's
 * spin logs. The server recomputes the same values by replaying the run; this is
 * only the claim being checked, never trusted on its own.
 */
export function buildClientResults(
  spinLogs: SpinLog[],
  totalScore: number,
): ClientResults {
  let cumulative = 0;
  let bestSpinScore = 0;
  const spins = spinLogs.map((log) => {
    cumulative += log.roundScore;
    if (log.roundScore > bestSpinScore) bestSpinScore = log.roundScore;
    return {
      spinIndex: log.spinIndex,
      finalBoard: [...log.finalResult],
      spinScore: log.roundScore,
      totalScoreAfterSpin: cumulative,
    };
  });
  return { spins, finalScore: totalScore, bestSpinScore };
}
