/**
 * Client-only persistence for an in-progress 첨탑(spire) run so the player can
 * 이어하기(resume) after leaving the page.
 *
 * A spire run is exactly ONE RC run: a seed + chosen set id + the ordered list
 * of recorded actions. Re-dispatching those actions against a fresh store that
 * has been re-seeded with the same seed reproduces the identical rng stream, so
 * the resumed run still verifies under server-side replay (lib/replay.ts).
 *
 * Stored in localStorage as a single JSON blob under KEY. All accessors guard
 * `typeof window` so importing this module is safe on the server.
 */

import type { RecordedAction } from '@/store/gameStore';

const KEY = 'rule-slot-spire-run';

export type SpireSave = {
  seed: string;
  chosenSetId: string;
  runId: string;
  actions: RecordedAction[];
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
 * (seed + chosenSetId + runId strings, actions array) so a malformed blob never
 * crashes the resume flow.
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
      typeof o.chosenSetId !== 'string' ||
      typeof o.runId !== 'string' ||
      !Array.isArray(o.actions)
    ) {
      return null;
    }
    return {
      seed: o.seed,
      chosenSetId: o.chosenSetId,
      runId: o.runId,
      actions: o.actions as RecordedAction[],
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
