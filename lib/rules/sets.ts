/**
 * Named basic rule-sets for RULE SLOT Season 1 modes. Data + types only.
 * Every id in `ruleIds` must exist in RULES_BY_ID (see data/rules.ts).
 */

export type RuleSet = {
  id: string;
  name: string;
  ruleIds: string[];
};

/**
 * '일반' 규칙 — symbol-agnostic rules (work on any board: select/copy/유지/배치).
 * Used as the shared pool the 첨탑 shop offers ALONGSIDE the owned symbol-set
 * rules (deduped), so generic rules stay buyable regardless of symbol pool.
 */
export const GENERAL_RULE_IDS: string[] = [
  'select-swap',
  'select-reroll',
  'select-copy',
  'last-lock',
  'center-lock',
  'left-pair',
  'center-echo',
  'third-mirror',
  'copy-above',
  'bonus-77',
];

export const RULE_SETS: RuleSet[] = [
  {
    id: 'general',
    name: '일반 규칙',
    ruleIds: GENERAL_RULE_IDS,
  },
  {
    id: 'daily_basic_1',
    name: '일일 기본 규칙 1',
    ruleIds: ['select-swap', 'select-reroll', 'select-copy', 'last-lock', 'bonus-77'],
  },
  {
    id: 'daily_basic_2',
    name: '일일 기본 규칙 2',
    ruleIds: ['copy-above', 'left-pair', 'center-echo', 'select-reroll', 'center-lock'],
  },
  {
    id: 'spire_basic_temp',
    name: '첨탑 임시 기본 규칙',
    ruleIds: [
      'select-swap',
      'select-reroll',
      'select-copy',
      'copy-above',
      'left-pair',
      'center-echo',
    ],
  },
];

export const RULE_SETS_BY_ID: Record<string, RuleSet> = Object.fromEntries(
  RULE_SETS.map((ruleSet) => [ruleSet.id, ruleSet]),
);
