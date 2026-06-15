/**
 * Named basic rule-sets for RULE SLOT Season 1 modes. Data + types only.
 * Every id in `ruleIds` must exist in RULES_BY_ID (see data/rules.ts).
 */

export type RuleSet = {
  id: string;
  name: string;
  ruleIds: string[];
};

export const RULE_SETS: RuleSet[] = [
  {
    id: 'daily_basic_1',
    name: '일일 기본 규칙 1',
    ruleIds: ['select-swap', 'select-reroll', 'select-copy', 'last-lock', 'bonus-77'],
  },
  {
    id: 'daily_basic_2',
    name: '일일 기본 규칙 2',
    ruleIds: ['copy-above', 'left-pair', 'center-echo'],
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
