/** Daily-challenge timing + seed + symbol-group rotation. Pure & deterministic
 *  so the server route and tests agree. Day boundary is 12:00 KST = 03:00 UTC. */

// WU7: 5 official attempts/day, +5 after a one-time (dummy) ad refill → 10 max.
export const DAILY_BASE_ATTEMPTS = 5;
export const DAILY_AD_REFILL_ATTEMPTS = 5;
export const DAILY_MAX_ATTEMPTS = DAILY_BASE_ATTEMPTS + DAILY_AD_REFILL_ATTEMPTS;

/** Total attempts a player may use today given whether they used the ad refill. */
export function dailyAttemptsAllowed(adRefillUsed: boolean): number {
  return adRefillUsed ? DAILY_MAX_ATTEMPTS : DAILY_BASE_ATTEMPTS;
}

const DAY_BOUNDARY_UTC_HOURS = 3; // 12:00 KST

/** The active daily date key (YYYY-MM-DD) for an instant. The window for key D
 *  runs [D 03:00Z, D+1 03:00Z), i.e. 12:00 KST → next 12:00 KST. */
export function dailyDateKey(now: Date): string {
  const shifted = new Date(now.getTime() - DAY_BOUNDARY_UTC_HOURS * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

/** ISO window [startsAt, endsAt) for a date key. */
export function dailyWindow(dateKey: string): { startsAt: string; endsAt: string } {
  const start = new Date(`${dateKey}T${String(DAY_BOUNDARY_UTC_HOURS).padStart(2, '0')}:00:00Z`);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function dailySeed(dateKey: string): string {
  return `daily-seed-${dateKey}`;
}

/**
 * Symbol-group rotation per the Season 1 plan. numberSet is always fixed; the
 * two variable groups rotate by day. NOTE: the play engine currently uses the
 * legacy fruit/gem symbols regardless — these labels are stored for display and
 * are forward-ready for when extra symbol sets are wired into the engine.
 */
// Pairs of EXISTING non-number sets (fruit/gem/cat/vehicle/monster). numberSet
// is always present; these two rotate daily. groupA !== groupB in every pair.
const ROTATION: Array<[string, string]> = [
  ['fruit', 'gem'],
  ['cat', 'vehicle'],
  ['monster', 'fruit'],
  ['gem', 'cat'],
  ['vehicle', 'monster'],
  ['fruit', 'cat'],
  ['gem', 'vehicle'],
  ['monster', 'cat'],
  ['fruit', 'vehicle'],
  ['gem', 'monster'],
  ['cat', 'fruit'],
  ['vehicle', 'gem'],
  ['monster', 'vehicle'],
];

const SEASON_START_KEY = '2026-06-15';

function daysBetween(aKey: string, bKey: string): number {
  const a = Date.parse(`${aKey}T00:00:00Z`);
  const b = Date.parse(`${bKey}T00:00:00Z`);
  return Math.round((a - b) / (24 * 3600_000));
}

/** The two rotating symbol-set ids for a date key. */
export function dailyGroups(dateKey: string): { groupASetId: string; groupBSetId: string } {
  const offset = daysBetween(dateKey, SEASON_START_KEY);
  const idx = ((offset % ROTATION.length) + ROTATION.length) % ROTATION.length;
  const [groupASetId, groupBSetId] = ROTATION[idx];
  return { groupASetId, groupBSetId };
}
