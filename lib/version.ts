/**
 * Release versions shared by the client and the server-side replay verifier.
 *
 * - CLIENT_VERSION: the app release (UI, fixes, presentation). Bump on any
 *   user-facing release.
 * - RULESET_VERSION: the game rules/score table/symbol probabilities/hand logic.
 *   Bump whenever a change would make an old score incomparable to a new one.
 *
 * Leaderboards only show records whose stored versions match these, so scores
 * from different rule sets never mix.
 */
export const CLIENT_VERSION = '2.0.0';
export const RULESET_VERSION = 2;

/** The active season slug (see seasons table / lib/season/config). */
export const SEASON_SLUG = '2026-06-season-1';
