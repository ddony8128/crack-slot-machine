/**
 * Per-mode configuration skeletons for RULE SLOT Season 1. Types + one pure
 * helper only — no engine wiring or game logic.
 */

import { RULE_SETS_BY_ID } from '@/lib/rules/sets';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { pairRulesForSets } from '@/lib/pairRules';

export type DailyChallengeConfig = {
  dateKey: string;
  seed: string;
  symbolSetIds: string[];
  basicRuleSetId: 'daily_basic_1' | 'daily_basic_2';
  maxBaseAttempts: number;
  adRefillAttempts: number;
  maxTotalAttempts: number;
};

export type PuzzleConfig = {
  puzzleKey: string;
  title: string;
  seed: string;
  initialBoard: string[];
  symbolSetIds: string[];
  availableRuleIds: string[];
  maxSpins: number;
  goals: unknown[];
};

export type SpireRunConfig = {
  seed: string;
  baseSymbolSetIds: string[];
  basicRuleSetId: string;
  stageCount: number;
};

/**
 * The available rule pool for a mode: the union of the named rule-set's ruleIds
 * and every selected symbol-set's ruleIds. Deduped, preserving first-seen order
 * (rule-set ids first, then set ids in the given order). Throws on unknown ids.
 */
export function buildRulePool(symbolSetIds: string[], ruleSetId: string): string[] {
  const ruleSet = RULE_SETS_BY_ID[ruleSetId];
  if (!ruleSet) {
    throw new Error(`Unknown rule set id: ${ruleSetId}`);
  }

  const seen = new Set<string>();
  const pool: string[] = [];

  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      pool.push(id);
    }
  };

  for (const id of ruleSet.ruleIds) {
    add(id);
  }

  for (const setId of symbolSetIds) {
    const symbolSet = SYMBOL_SETS_BY_ID[setId];
    if (!symbolSet) {
      throw new Error(`Unknown symbol set id: ${setId}`);
    }
    for (const id of symbolSet.ruleIds) {
      add(id);
    }
  }

  // A–B pair rules apply only when BOTH joined sets are present (deduped here).
  for (const id of pairRulesForSets(symbolSetIds)) {
    add(id);
  }

  return pool;
}
