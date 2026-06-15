import type { RecordedAction } from '@/store/gameStore';
import type { ClientResults } from '@/lib/db/types';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

/** localStorage keys for the persisted guest identity. */
export const GUEST_ID_KEY = 'rule-slot-guest-id';
export const GUEST_NAME_KEY = 'rule-slot-guest-name';

export type GuestIdentity = { guestId: string; displayName: string };

export type StartQuickResponse = {
  runId: string;
  seed: string;
};

export type SubmitQuickResponse =
  | { status: 'submitted'; score: number; bestSpinScore: number }
  | { status: 'rejected'; reason: string };

export type QuickLeaderboard = {
  items: Array<{ rank: number; nickname: string; score: number }>;
};

async function errorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : `http_${res.status}`;
}

/**
 * Resolve a stable guest identity for unauthenticated quick play. Reads both the
 * id and display name from localStorage; if either is missing, registers a new
 * guest (POST /api/guest), persists both, and returns it. SSR-safe: throws if
 * called without a window (the caller only invokes this from the browser).
 */
export async function ensureGuest(): Promise<GuestIdentity> {
  if (typeof window === 'undefined') {
    throw new Error('ensureGuest_requires_window');
  }

  const storedId = window.localStorage.getItem(GUEST_ID_KEY);
  const storedName = window.localStorage.getItem(GUEST_NAME_KEY);
  if (storedId && storedName) {
    return { guestId: storedId, displayName: storedName };
  }

  const res = await fetch('/api/guest', { method: 'POST' });
  if (!res.ok) throw new Error(await errorCode(res));
  const { guestId, displayName } = (await res.json()) as GuestIdentity;
  window.localStorage.setItem(GUEST_ID_KEY, guestId);
  window.localStorage.setItem(GUEST_NAME_KEY, displayName);
  return { guestId, displayName };
}

/** POST /api/quick/start. Throws Error(code) on failure. */
export async function startQuick(nickname: string): Promise<StartQuickResponse> {
  const res = await fetch('/api/quick/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}

/** POST /api/quick/submit. Returns 200 for both submitted and rejected. */
export async function submitQuick(
  runId: string,
  payload: {
    nickname: string;
    actions: RecordedAction[];
    clientResults: ClientResults;
  },
): Promise<SubmitQuickResponse> {
  const res = await fetch('/api/quick/submit', {
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

/** GET /api/quick/leaderboard. Throws Error(code) on failure. */
export async function fetchQuickLeaderboard(): Promise<QuickLeaderboard> {
  const res = await fetch('/api/quick/leaderboard', { cache: 'no-store' });
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}
