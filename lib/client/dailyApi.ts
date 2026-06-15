import type { RecordedAction } from '@/store/gameStore';
import type { ClientResults } from '@/lib/db/types';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

export type DailyCurrent =
  | { dateKey: string; endsAt: string; loggedIn: false }
  | {
      dateKey: string;
      endsAt: string;
      attemptsUsed: number;
      attemptsLeft: number;
      loggedIn: true;
    };

export type StartDailyResponse = { runId: string; seed: string; dateKey: string };

export type SubmitDailyResponse =
  | { status: 'submitted'; score: number; bestSpinScore: number; attemptsLeft: number }
  | { status: 'rejected'; reason: string; attemptsLeft?: number };

export type DailyLeaderboard = {
  dateKey: string;
  items: Array<{ rank: number; nickname: string; score: number }>;
};

async function errorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : `http_${res.status}`;
}

/** GET /api/daily/current. Throws Error(code) on failure. */
export async function fetchDailyCurrent(): Promise<DailyCurrent> {
  const res = await fetch('/api/daily/current', { cache: 'no-store' });
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}

/** POST /api/daily/start. Throws Error(code) on failure. */
export async function startDaily(): Promise<StartDailyResponse> {
  const res = await fetch('/api/daily/start', { method: 'POST' });
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}

/** POST /api/daily/submit. Returns 200 for both submitted and rejected. */
export async function submitDaily(
  runId: string,
  payload: { actions: RecordedAction[]; clientResults: ClientResults },
): Promise<SubmitDailyResponse> {
  const res = await fetch('/api/daily/submit', {
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

/** GET /api/daily/leaderboard?date=. Throws Error(code) on failure. */
export async function fetchDailyLeaderboard(
  date?: string,
): Promise<DailyLeaderboard> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`/api/daily/leaderboard${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}
