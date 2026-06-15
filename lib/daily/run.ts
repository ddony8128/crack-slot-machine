import type { RunConfig } from '@/store/gameStore';
import type { SymbolType } from '@/types';
import type { DailyChallengeRow } from '@/lib/db/types';
import { BASE_WEIGHTS } from '@/data/symbols';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { buildRulePool } from '@/lib/modes/config';
import { initialBoardFor } from '@/lib/board/initialBoard';
import { dailyGroups } from '@/lib/daily/challenge';

const DAILY_MAX_SPINS = 7;

export type DailyBasicRuleSetId = 'daily_basic_1' | 'daily_basic_2';

/** Which basic rule set a day uses — computed ONCE at challenge creation and
 *  then frozen in the daily_challenges row (referenced thereafter). */
export function dailyBasicRuleSetId(dateKey: string): DailyBasicRuleSetId {
  const sum = [...dateKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  return sum % 2 === 0 ? 'daily_basic_1' : 'daily_basic_2';
}

/** Resolve the symbol-set groups + basic rule set for a NEW day's challenge.
 *  Call this only when CREATING the row; afterwards read the stored row. */
export function resolveDailySetup(dateKey: string): {
  groupASetId: string;
  groupBSetId: string;
  basicRuleSetId: DailyBasicRuleSetId;
} {
  const { groupASetId, groupBSetId } = dailyGroups(dateKey);
  return { groupASetId, groupBSetId, basicRuleSetId: dailyBasicRuleSetId(dateKey) };
}

/** The day's symbol bag as weights: number + the 2 rotating sets at weight 1. */
export function dailyBagWeights(groupASetId: string, groupBSetId: string): Record<SymbolType, number> {
  const weights = Object.fromEntries(
    (Object.keys(BASE_WEIGHTS) as SymbolType[]).map((s) => [s, 0]),
  ) as Record<SymbolType, number>;
  for (const setId of ['number', groupASetId, groupBSetId]) {
    const set = SYMBOL_SETS_BY_ID[setId];
    if (!set) continue;
    for (const sym of set.symbols) weights[sym.id as SymbolType] = 1;
  }
  return weights;
}

export type DailyConfigParts = {
  seed: string;
  groupASetId: string;
  groupBSetId: string;
  basicRuleSetId: string;
};

/**
 * Build the daily RunConfig from EXPLICIT parts (the stored challenge values).
 * Used by both the client (from the /start response) and the server submit
 * (from the daily_challenges row) so replay verification matches exactly.
 */
export function dailyRunConfigFromParts(p: DailyConfigParts): RunConfig {
  const weights = dailyBagWeights(p.groupASetId, p.groupBSetId);
  return {
    initialBoard: initialBoardFor(p.seed, weights),
    maxSpins: DAILY_MAX_SPINS,
    baseWeights: weights,
    provisioning: 'pool',
    rulePoolIds: buildRulePool(['number', p.groupASetId, p.groupBSetId], p.basicRuleSetId),
    // Number special hands are 빠른 게임-only.
    numberSpecials: { four: false, zero: false },
  };
}

/** Build the daily RunConfig from a stored daily_challenges row (DB-referenced). */
export function dailyRunConfigFromRow(row: DailyChallengeRow): RunConfig {
  const basicRuleSetId =
    (row.config as { basicRuleSetId?: string } | null)?.basicRuleSetId ??
    dailyBasicRuleSetId(row.dateKey);
  return dailyRunConfigFromParts({
    seed: row.seed,
    groupASetId: row.groupASetId,
    groupBSetId: row.groupBSetId,
    basicRuleSetId,
  });
}
