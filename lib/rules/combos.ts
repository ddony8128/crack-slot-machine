/**
 * Config-driven A–B COMBO rules for RULE SLOT.
 *
 * A combo rule belongs to TWO symbol sets. Unlike a PairRule (lib/pairRules.ts),
 * which pays a conditional SCORE bonus at scoring time, a combo rule has a BOARD
 * EFFECT (transform/reroll) during the cascade that reads symbols from both sets
 * (e.g. reroll every gem adjacent to a dracula). It joins a run's rule pool only
 * when BOTH of its sets are present (mirroring pairRulesForSets in buildRulePool)
 * and is only OFFERED when both sets can actually roll (see lib/rules/playable.ts).
 *
 * This is DATA: buildRulePool and rulePlayable consume COMBO_RULE_SETS generically;
 * the per-combo board effect lives in lib/cascade.ts (applyOne), keyed by rule id.
 */

export const COMBO_RULE_SETS: Record<string, [string, string]> = {
  'ruby-convert': ['number', 'gem'],
  'diamond-convert': ['number', 'gem'],
  vandalism: ['cat', 'vehicle'],
  'why-here': ['cat', 'vehicle'],
  shakedown: ['monster', 'gem'],
};

/**
 * The combo-rule ids applicable to a set of symbol sets: every combo whose BOTH
 * sets are present in `setIds`. Deduped, preserving registry (declaration) order.
 */
export function comboRulesForSets(setIds: string[]): string[] {
  const present = new Set(setIds);
  const out: string[] = [];
  for (const [id, [a, b]] of Object.entries(COMBO_RULE_SETS)) {
    if (present.has(a) && present.has(b)) out.push(id);
  }
  return out;
}
