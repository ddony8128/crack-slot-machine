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
export const CLIENT_VERSION = '1.0.0-blackhaven';
// Bumped to 2: BLACKHAVEN scoring changes (신체/괴물 보너스 2배, 올블루/올레드 제거).
export const RULESET_VERSION = 2;
