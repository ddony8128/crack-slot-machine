import type { BestScoreRow, SeasonRankItem } from '@/lib/db/types';

/**
 * A before/after season-total + rank delta for one point-granting submit. Returned
 * by the spire/puzzle/daily submit endpoints so the result screens can play a
 * count-up. `delta` may be 0 (e.g. a non-improving best score).
 */
export type SeasonScoreChange = {
  previousSeasonScore: number;
  newSeasonScore: number;
  delta: number;
  previousRank: number | null;
  newRank: number | null;
  reason: string;
};

/** Each mode contributes at most this many season points (total cap 3000). */
export const SEASON_MODE_CAP = 1000;
export const DAILY_COUNT_CAP = 10; // only the best N days count

// ─────────────────────────────────────────────────────────────────────────────
// v2 season formulas (docs/SEASON_RANKING_DONATION_PLAN.md). Additive: the older
// functions below remain until buildSeasonRanking is swapped (SR-D).
// ─────────────────────────────────────────────────────────────────────────────

/** 후원자 칭호 minimum donation. */
export const SUPPORTER_MIN_AMOUNT = 10000;

// Puzzle: 100 on clear + 10 per leftover spin; best kept per puzzle.
export const PUZZLE_CLEAR_BASE = 100;
export const PUZZLE_LEFTOVER_PER = 10;

/** Puzzle season score for ONE puzzle clear: 100 + leftover×10. */
export function puzzleScore(spinLimit: number, spinsUsed: number): number {
  const leftover = Math.max(0, spinLimit - spinsUsed);
  return PUZZLE_CLEAR_BASE + leftover * PUZZLE_LEFTOVER_PER;
}

// Daily: +20 the first time you play a day; rank reward only for SETTLED days.
export const DAILY_FIRST_PLAY = 20;
export const DAILY_TOP10_REWARD = 50;
export const DAILY_TOP50_REWARD = 30;

/** Rank reward for a SETTLED day. Top10% → +50 (only), top50% → +30, else 0. */
export function dailyRankReward(rank: number, totalParticipants: number): number {
  if (rank < 1 || totalParticipants < 1 || rank > totalParticipants) return 0;
  const top10 = Math.max(1, Math.ceil(totalParticipants * 0.1));
  const top50 = Math.max(1, Math.ceil(totalParticipants * 0.5));
  if (rank <= top10) return DAILY_TOP10_REWARD;
  if (rank <= top50) return DAILY_TOP50_REWARD;
  return 0;
}

// Spire (best run only): maxClearedStage×100 + money×10 + unusedSpins×10.
export const SPIRE_STAGE_POINTS = 100;
export const SPIRE_MONEY_PER = 10;
export const SPIRE_SPIN_PER = 10;

/** Spire season score from a finished run's best summary. unusedSpins = sum of
 *  remaining spins over CLEARED stages only. */
export function spireSeasonScore(
  maxClearedStage: number,
  money: number,
  unusedSpins: number,
): number {
  return (
    Math.max(0, maxClearedStage) * SPIRE_STAGE_POINTS +
    Math.max(0, money) * SPIRE_MONEY_PER +
    Math.max(0, unusedSpins) * SPIRE_SPIN_PER
  );
}

// ── per-mode point formulas (pure) ───────────────────────────────────────────

/** 퍼즐: 100 per cleared puzzle, capped at 1000. */
export function puzzleSeasonPoints(clearedCount: number): number {
  return Math.min(SEASON_MODE_CAP, Math.max(0, clearedCount) * 100);
}

/** Sum of the best DAILY_COUNT_CAP daily-point values, capped at 1000. */
export function seasonDailyTotal(dailyPoints: number[]): number {
  const top = [...dailyPoints].sort((a, b) => b - a).slice(0, DAILY_COUNT_CAP);
  return Math.min(SEASON_MODE_CAP, top.reduce((s, v) => s + v, 0));
}

// ── season aggregation across all players (pure) ─────────────────────────────

/**
 * Build the season ranking from every best_scores row in the season (v2 spec).
 * Spire/puzzle points are the per-row `seasonPoints` stored at submit (spire =
 * the best run; puzzle = summed over each puzzle's best). Daily is LAZY-PERSISTED:
 * each daily row already carries its settled rank reward in `seasonPoints` (0
 * until the day is settled by settleDueDailyChallenges), and the +20 first-play
 * stays derived per daily row here. So this is a pure O(rows) sum — no per-day
 * ranking recompute and no `now`. No per-mode caps.
 */
export function buildSeasonRanking(
  rows: BestScoreRow[],
  nicknameOf: (playerId: string) => string,
): SeasonRankItem[] {
  const players = new Set<string>();
  for (const r of rows) players.add(r.playerId);

  // spire: best stored seasonPoints per player
  const spire = new Map<string, number>();
  // puzzle: sum of stored seasonPoints (each row is that puzzle's best)
  const puzzleSum = new Map<string, number>();
  // daily: +DAILY_FIRST_PLAY per played day + the row's persisted rank reward
  const dailyByPlayer = new Map<string, number>();

  for (const r of rows) {
    if (r.mode === 'spire') {
      spire.set(r.playerId, Math.max(spire.get(r.playerId) ?? 0, r.seasonPoints));
    } else if (r.mode === 'puzzle') {
      puzzleSum.set(r.playerId, (puzzleSum.get(r.playerId) ?? 0) + r.seasonPoints);
    } else if (r.mode === 'daily') {
      dailyByPlayer.set(
        r.playerId,
        (dailyByPlayer.get(r.playerId) ?? 0) + DAILY_FIRST_PLAY + r.seasonPoints,
      );
    }
  }

  const items: SeasonRankItem[] = [...players].map((playerId) => {
    const spirePoints = spire.get(playerId) ?? 0;
    const puzzlePoints = puzzleSum.get(playerId) ?? 0;
    const dailyPoints = dailyByPlayer.get(playerId) ?? 0;
    return {
      rank: 0,
      playerId,
      nickname: nicknameOf(playerId),
      spirePoints,
      puzzlePoints,
      dailyPoints,
      seasonPoints: spirePoints + puzzlePoints + dailyPoints,
    };
  });

  items.sort(
    (a, b) =>
      b.seasonPoints - a.seasonPoints ||
      b.dailyPoints - a.dailyPoints ||
      b.spirePoints - a.spirePoints ||
      b.puzzlePoints - a.puzzlePoints,
  );
  items.forEach((it, i) => (it.rank = i + 1));
  return items;
}
