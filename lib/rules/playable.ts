import type { Rule, SymbolType } from '@/types';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { COMBO_RULE_SETS } from '@/lib/rules/combos';

/** Builds that map 1:1 to a non-number symbol set whose symbols must be rollable
 *  for the rule to do anything (fruit-surge needs fruits, 우다다다 needs cats, …). */
const SET_BUILD_IDS = new Set(['fruit', 'gem', 'cat', 'vehicle', 'monster']);

/** The symbol sets a rule needs present to be meaningful (empty = always). */
function requiredSetIds(rule: Rule): string[] {
  const combo = COMBO_RULE_SETS[rule.id];
  if (combo) return [combo[0], combo[1]];
  if (rule.build && SET_BUILD_IDS.has(rule.build)) return [rule.build];
  return [];
}

/**
 * Is this rule playable in a run whose symbol bag is `weights`? A set rule is
 * only offered when at least one of its set's symbols can actually roll
 * (weight > 0). Number/generic rules (build '7'/'order'/'safe'/'color'/'score')
 * have no set requirement and are always playable.
 *
 * This is what keeps cat/vehicle/monster rules OUT of 빠른 게임 / 이벤트 offers
 * (whose bag never rolls those symbols), while season modes that include a set
 * still offer its rules.
 */
export function rulePlayable(rule: Rule, weights: Record<string, number>): boolean {
  return requiredSetIds(rule).every((setId) => {
    const set = SYMBOL_SETS_BY_ID[setId];
    return !!set && set.symbols.some((s) => (weights[s.id as SymbolType] ?? 0) > 0);
  });
}
