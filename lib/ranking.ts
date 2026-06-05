import type { RankingRecord } from '@/types';

const STORAGE_KEY = 'rule-slot-rankings';

/**
 * Sort ranking records by:
 *   1. score descending
 *   2. bestSpinScore descending
 *   3. createdAt ascending (earlier records rank higher on ties)
 * Returns a NEW array; does not mutate the input.
 */
export function sortRankings(records: RankingRecord[]): RankingRecord[] {
  return records.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.bestSpinScore !== a.bestSpinScore) {
      return b.bestSpinScore - a.bestSpinScore;
    }
    // createdAt asc: earlier ISO string first.
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    return 0;
  });
}

/**
 * Read + parse rankings from localStorage. Returns [] on missing/invalid
 * JSON or in non-browser (SSR) environments. The result is always sorted.
 */
export function loadRankings(): RankingRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortRankings(parsed as RankingRecord[]);
  } catch {
    return [];
  }
}

/**
 * Load existing rankings, append the given record, sort, persist, and
 * return the sorted list. No-op persistence in SSR (still returns sorted).
 */
export function saveRanking(record: RankingRecord): RankingRecord[] {
  const sorted = sortRankings([...loadRankings(), record]);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch {
      // Ignore quota / serialization errors; return the in-memory list.
    }
  }
  return sorted;
}

/**
 * Build a RankingRecord (generated id + createdAt) from finished-game data
 * and persist it. Returns the updated sorted list.
 */
export function addRankingFromGame(input: {
  nickname: string;
  score: number;
  bestSpinScore: number;
  finalRules: string[];
}): RankingRecord[] {
  const record: RankingRecord = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    nickname: input.nickname,
    score: input.score,
    bestSpinScore: input.bestSpinScore,
    finalRules: input.finalRules,
    createdAt: new Date().toISOString(),
  };
  return saveRanking(record);
}

/** Remove all stored rankings. */
export function clearRankings(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * 1-based rank of the record with the given id within the sorted list,
 * or -1 if not present.
 */
export function getRank(records: RankingRecord[], id: string): number {
  const sorted = sortRankings(records);
  const index = sorted.findIndex((r) => r.id === id);
  return index === -1 ? -1 : index + 1;
}

/** Max of the given round scores, or 0 when empty. */
export function bestSpinScore(roundScores: number[]): number {
  if (roundScores.length === 0) return 0;
  return Math.max(...roundScores);
}
