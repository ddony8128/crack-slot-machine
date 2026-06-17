import type { SpireAction } from '@/lib/spire/replay';
import type { SeasonScoreChange } from '@/lib/season/scoring';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

export type StartSpireResponse = {
  runId: string;
  seed: string;
  choices: [string, string];
};

export type SubmitSpireResponse =
  | {
      status: 'submitted';
      stagesCleared: number;
      totalScore: number;
      seasonPoints: number;
      scoreChange?: SeasonScoreChange;
    }
  | { status: 'rejected'; reason: string };

async function errorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : `http_${res.status}`;
}

/** POST /api/spire/start. Throws Error(code) on failure. */
export async function startSpire(): Promise<StartSpireResponse> {
  const res = await fetch('/api/spire/start', { method: 'POST' });
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}

export type SpireCurrentResponse = {
  current: {
    runId: string;
    seed: string;
    actions: SpireAction[];
    stageReached: number;
  } | null;
};

/** GET /api/spire/current — the player's resumable run, or {current:null}. */
export async function fetchSpireCurrent(): Promise<SpireCurrentResponse> {
  const res = await fetch('/api/spire/current');
  if (!res.ok) throw new Error(await errorCode(res));
  return res.json();
}

/**
 * POST /api/spire/progress — autosave the in-progress action stream onto the
 * pending run. Fire-and-forget from the client (best-effort); never throws so a
 * transient failure can't interrupt play.
 */
export async function saveSpireProgress(
  runId: string,
  actions: SpireAction[],
): Promise<void> {
  try {
    await fetch('/api/spire/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, actions }),
    });
  } catch {
    // best-effort autosave; localStorage remains the offline fallback.
  }
}

/** POST /api/spire/submit. Returns 200 for both submitted and rejected. */
export async function submitSpire(
  runId: string,
  payload: {
    actions: SpireAction[];
    stagesCleared: number;
    totalScore: number;
  },
): Promise<SubmitSpireResponse> {
  const res = await fetch('/api/spire/submit', {
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
