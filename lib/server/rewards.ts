import type { CreditAward, CreditSummary } from '@/types';

/** Score thresholds and their matching credit reasons, in ascending order. */
const SCORE_TIERS = [
  { threshold: 2000, reason: 'score_2000' },
  { threshold: 5000, reason: 'score_5000' },
  { threshold: 10000, reason: 'score_10000' },
] as const;

export type ComputeCreditsInput = {
  isFirstPlay: boolean;
  /** Best score BEFORE this run (null = no prior qualifying run). */
  previousBest: number | null;
  /** This run's final score. */
  totalScore: number;
  hadAllAchievementsBefore: boolean;
  hasAllAchievementsNow: boolean;
};

/**
 * Pure credit computation (no I/O). Each award is worth 1 credit. Score-tier
 * credits are only granted when the threshold is NEWLY crossed by this run
 * (i.e. the prior best had not yet reached it). Awards are returned in a stable
 * display order: first_play, score_2000, score_5000, score_10000,
 * all_achievements.
 */
export function computeCredits(input: ComputeCreditsInput): CreditSummary {
  const {
    isFirstPlay,
    previousBest,
    totalScore,
    hadAllAchievementsBefore,
    hasAllAchievementsNow,
  } = input;

  const awards: CreditAward[] = [];

  if (isFirstPlay) {
    awards.push({ reason: 'first_play', amount: 1 });
  }

  const prior = previousBest ?? -1;
  for (const { threshold, reason } of SCORE_TIERS) {
    if (totalScore >= threshold && prior < threshold) {
      awards.push({ reason, amount: 1 });
    }
  }

  if (hasAllAchievementsNow && !hadAllAchievementsBefore) {
    awards.push({ reason: 'all_achievements', amount: 1 });
  }

  const total = awards.reduce((sum, a) => sum + a.amount, 0);
  return { total, awards };
}
