import type { RecordedAction } from '@/store/gameStore';
import type { ClientResults, PuzzleDistribution } from '@/lib/db/types';
import type { SeasonScoreChange } from '@/lib/season/scoring';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

export type StartPuzzleResponse = { runId: string; seed: string };

export type SubmitPuzzleResponse =
  | {
      status: 'submitted';
      goalsAchieved: number;
      totalGoals: number;
      cleared: boolean;
      spinCount: number;
      distribution: PuzzleDistribution;
      scoreChange?: SeasonScoreChange;
    }
  | { status: 'rejected'; reason: string };

async function errorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : `http_${res.status}`;
}

/** POST /api/puzzles/[key]/start. Throws Error(code) on failure. */
export async function startPuzzle(key: string): Promise<StartPuzzleResponse> {
  const res = await fetch(`/api/puzzles/${encodeURIComponent(key)}/start`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}

/** POST /api/puzzles/[key]/submit. Returns 200 for both submitted and rejected. */
export async function submitPuzzle(
  key: string,
  runId: string,
  payload: { actions: RecordedAction[]; clientResults: ClientResults },
): Promise<SubmitPuzzleResponse> {
  const res = await fetch(`/api/puzzles/${encodeURIComponent(key)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runId,
      ...payload,
      clientVersion: CLIENT_VERSION,
      rulesetVersion: RULESET_VERSION,
    }),
  });
  // Only network/5xx throw; submitted vs rejected both come back 200.
  if (!res.ok && res.status >= 500) {
    throw new Error(`submit_failed_${res.status}`);
  }
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}
