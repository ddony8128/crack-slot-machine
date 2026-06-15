import type { BestScoreRow, SeasonRankItem } from '@/lib/db/types';

/** Each mode contributes at most this many season points (total cap 3000). */
export const SEASON_MODE_CAP = 1000;
export const DAILY_COUNT_CAP = 10; // only the best N days count

// ── per-mode point formulas (pure) ───────────────────────────────────────────

/** 첨탑: clearedStages×70 + min(300, floor(runScore/200)), capped at 1000. */
export function spireSeasonPoints(clearedStageCount: number, finalRunScore: number): number {
  const base = Math.max(0, clearedStageCount) * 70;
  const bonus = Math.min(300, Math.max(0, Math.floor((finalRunScore || 0) / 200)));
  return Math.min(SEASON_MODE_CAP, base + bonus);
}

/** 퍼즐: 100 per cleared puzzle, capped at 1000. */
export function puzzleSeasonPoints(clearedCount: number): number {
  return Math.min(SEASON_MODE_CAP, Math.max(0, clearedCount) * 100);
}

/**
 * 일일 도전 points for one day, by rank within that day's field. Uses the higher
 * of the percentile band and the small-field fallback so tiny fields still pay
 * the top ranks well.
 */
export function dailyPointsForRank(rank: number, totalParticipants: number): number {
  if (rank < 1 || totalParticipants < 1 || rank > totalParticipants) return 0;
  const pct = rank / totalParticipants;
  const percentile = pct <= 0.1 ? 100 : pct <= 0.3 ? 80 : pct <= 0.6 ? 60 : 40;
  const smallField = rank === 1 ? 100 : rank === 2 ? 80 : rank === 3 ? 60 : 40;
  return Math.max(percentile, smallField);
}

/** Sum of the best DAILY_COUNT_CAP daily-point values, capped at 1000. */
export function seasonDailyTotal(dailyPoints: number[]): number {
  const top = [...dailyPoints].sort((a, b) => b - a).slice(0, DAILY_COUNT_CAP);
  return Math.min(SEASON_MODE_CAP, top.reduce((s, v) => s + v, 0));
}

// ── season aggregation across all players (pure) ─────────────────────────────

/**
 * Build the season ranking from every best_scores row in the season. Daily
 * points are derived from each day's cross-player ranking (not stored), spire
 * points come from the stored per-run value, puzzle points from cleared count.
 */
export function buildSeasonRanking(
  rows: BestScoreRow[],
  nicknameOf: (playerId: string) => string,
): SeasonRankItem[] {
  const players = new Set<string>();
  for (const r of rows) players.add(r.playerId);

  // spire: best stored seasonPoints per player
  const spire = new Map<string, number>();
  // puzzle: count cleared puzzles per player
  const puzzleCleared = new Map<string, number>();
  // daily: group scores by date for ranking
  const byDate = new Map<string, BestScoreRow[]>();

  for (const r of rows) {
    if (r.mode === 'spire') {
      spire.set(r.playerId, Math.max(spire.get(r.playerId) ?? 0, r.seasonPoints));
    } else if (r.mode === 'puzzle') {
      if (r.cleared) puzzleCleared.set(r.playerId, (puzzleCleared.get(r.playerId) ?? 0) + 1);
    } else if (r.mode === 'daily') {
      const list = byDate.get(r.scopeKey) ?? [];
      list.push(r);
      byDate.set(r.scopeKey, list);
    }
  }

  // daily points per player = top-10 of their per-day ranking points
  const dailyPointsByPlayer = new Map<string, number[]>();
  for (const list of byDate.values()) {
    const sorted = [...list].sort((a, b) => b.score - a.score || a.updatedAt.localeCompare(b.updatedAt));
    sorted.forEach((row, i) => {
      const pts = dailyPointsForRank(i + 1, sorted.length);
      const arr = dailyPointsByPlayer.get(row.playerId) ?? [];
      arr.push(pts);
      dailyPointsByPlayer.set(row.playerId, arr);
    });
  }

  const items: SeasonRankItem[] = [...players].map((playerId) => {
    const spirePoints = Math.min(SEASON_MODE_CAP, spire.get(playerId) ?? 0);
    const puzzlePoints = puzzleSeasonPoints(puzzleCleared.get(playerId) ?? 0);
    const dailyPoints = seasonDailyTotal(dailyPointsByPlayer.get(playerId) ?? []);
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
