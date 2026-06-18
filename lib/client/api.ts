import type { RecordedAction } from '@/store/gameStore';
import type { ClientResults, LeaderboardPage } from '@/lib/db/types';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

export type StartResponse = {
  runId: string;
  seed: string;
  clientVersion: string;
  rulesetVersion: number;
};

export type SubmitResponse =
  | {
      status: 'submitted';
      score: number;
      bestSpinScore: number;
      eventSlug: string;
      // The player's prior best before this run (null = first play).
      previousBest: number | null;
      // 반복 플레이 패널티가 이번에 처음 발생했는가(최초 1회).
      penalty: boolean;
    }
  | { status: 'rejected'; reason: string };

/**
 * Open a server run for `slug`. The nickname is validated against the event
 * whitelist HERE (before any play): unregistered/soft-deleted nicknames are
 * rejected up front. Throws with an error code on failure (e.g.
 * 'nickname_not_whitelisted').
 */
export async function startRun(
  slug: string,
  nickname: string,
): Promise<StartResponse> {
  const res = await fetch(`/api/events/${encodeURIComponent(slug)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `start_failed_${res.status}`);
  }
  return res.json();
}

/** Submit a finished run for server replay verification. */
export async function submitRun(
  runId: string,
  payload: {
    nickname: string;
    actions: RecordedAction[];
    clientResults: ClientResults;
  },
): Promise<SubmitResponse> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      clientVersion: CLIENT_VERSION,
      rulesetVersion: RULESET_VERSION,
    }),
  });
  // submit returns 200 for both submitted and rejected; only network/5xx throw.
  if (!res.ok && res.status >= 500) {
    throw new Error(`submit_failed_${res.status}`);
  }
  return res.json();
}

export async function fetchLeaderboard(
  slug: string,
  page: number,
  pageSize: number,
): Promise<LeaderboardPage> {
  const res = await fetch(
    `/api/events/${encodeURIComponent(slug)}/leaderboard?page=${page}&pageSize=${pageSize}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`leaderboard_failed_${res.status}`);
  return res.json();
}
