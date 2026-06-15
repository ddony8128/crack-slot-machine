/**
 * Client-only persistence for an in-progress 첨탑(spire) run so the player can
 * 이어하기(resume) after leaving the page.
 *
 * A spire run is the run seed + the ordered list of staged SpireAction[] the
 * controller has recorded so far (choose_set / play_stage / shop buys / …).
 * Replaying those actions from the same seed via replaySpireRun reproduces the
 * identical run state, so the resumed run still verifies under server-side
 * replay (lib/spire/replay.ts). The chosen set is now the FIRST action, so it is
 * no longer stored separately.
 *
 * Stored in localStorage as a single JSON blob under KEY. All accessors guard
 * `typeof window` so importing this module is safe on the server.
 */

import type { SpireAction } from '@/lib/spire/replay';

const KEY = 'rule-slot-spire-run';

export type SpireSave = {
  seed: string;
  runId: string;
  actions: SpireAction[];
};

/** Persist the current spire run snapshot. No-op outside the browser. */
export function saveSpire(s: SpireSave): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Quota/serialization failures are non-fatal — resume is best-effort.
  }
}

/**
 * Load a saved spire run, or null if absent/corrupt. Validates the shape
 * (seed + runId strings, actions array) so a malformed blob never crashes the
 * resume flow. Action contents are not deeply validated here — replaySpireRun
 * rejects any structurally invalid stream on resume.
 */
export function loadSpire(): SpireSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.seed !== 'string' ||
      typeof o.runId !== 'string' ||
      !Array.isArray(o.actions)
    ) {
      return null;
    }
    return {
      seed: o.seed,
      runId: o.runId,
      actions: o.actions as SpireAction[],
    };
  } catch {
    return null;
  }
}

/** Remove any saved spire run. No-op outside the browser. */
export function clearSpire(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore — nothing else to do.
  }
}
