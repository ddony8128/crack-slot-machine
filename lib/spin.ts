import type { Rule, SymbolType } from '@/types';
import { FRUITS, GEMS, VEHICLES } from '@/data/symbols';
import { rollSymbol, rollSymbolFrom, type Rng } from '@/lib/rng';
import { expandRules } from '@/lib/expandRules';
import {
  POSITIONAL_WEIGHT_RULES,
  type PositionalWeightRule,
} from '@/lib/rules/positionalWeights';

const NUMBER_SPIN_POOL: SymbolType[] = ['seven', 'zero', 'four'];

export function computeWeights(
  rules: (Rule | null)[],
  base: Record<SymbolType, number>,
): Record<SymbolType, number> {
  const weights = { ...base };

  // vehicle-surge multiplies VEHICLES by (ORIGINAL non-null slot rule count + 1).
  // Counted on the un-expanded slot array per spec, so compute it before expanding.
  const slotRuleCount = rules.reduce((n, r) => (r ? n + 1 : n), 0);

  // copy-above duplicates the rule above (including weight rules), so expand first.
  for (const rule of expandRules(rules)) {
    if (!rule) continue;

    // four-shield is a reroll rule, but it ALSO affects the pre-roll weights
    // (zero ×2 this spin), so it is handled here by id regardless of type.
    if (rule.id === 'four-shield') {
      weights.zero *= 2;
      continue;
    }
    // four-fortune is a score rule, but it ALSO quadruples the 4 weight pre-roll.
    if (rule.id === 'four-fortune') {
      weights.four *= 4;
      continue;
    }

    if (rule.type !== 'weight') continue;

    switch (rule.id) {
      case 'seven-fever':
        weights.seven *= 3;
        break;
      case 'fruit-surge':
        for (const f of FRUITS) weights[f] *= 4;
        break;
      case 'gem-surge':
        for (const g of GEMS) weights[g] *= 4;
        break;
      case 'vehicle-surge':
        for (const v of VEHICLES) weights[v] *= slotRuleCount + 1;
        break;
      case 'no-zero':
        weights.zero = 0;
        break;
      case 'diamond-cut':
        weights.diamond = 0;
        weights.sapphire = 0;
        break;
      default:
        break;
    }
  }

  return weights;
}

export function baseSpin(
  weights: Record<SymbolType, number>,
  rng: Rng,
  n = 5,
): SymbolType[] {
  const result: SymbolType[] = [];
  for (let i = 0; i < n; i++) {
    result.push(rollSymbol(weights, rng));
  }
  return result;
}

/**
 * Roll the landing board honoring PRE-ROLL roll modifiers that depend on the
 * cell position or the previous spin (so they cannot live in the board-global
 * `computeWeights` vector):
 *
 *  - `number-spin`: a POOL restriction — every cell whose `previousResult` value
 *    was a number (seven/zero/four) rolls restricted to {seven, zero, four}.
 *  - positional/prev-state WEIGHT rules (고양이 확률 증가, 백귀야행): each active
 *    slot rule registered in `POSITIONAL_WEIGHT_RULES` transforms the per-cell
 *    weights before the draw. Adding such a rule is data — see that registry.
 *
 * Each cell still consumes exactly ONE rng draw, so replay stays byte-identical;
 * and because the registered transforms only scale their own set's symbols
 * (weight 0 in legacy/quick/event bags, and the rules are only offered when their
 * set is rollable), they are no-ops there. With no such rules present this is
 * equivalent to `baseSpin`.
 *
 * COPY ABOVE stacks these weight transforms (like it does for board-global weight
 * rules in computeWeights): the transforms are collected from `expandRules`, so a
 * copy-above below 백귀야행 multiplies the monster weight TWICE (e.g. 5 prev
 * monsters → ×8, copied → ×64). `number-spin` is a POOL restriction (idempotent),
 * so it still reads the raw slots and applies once.
 */
export function rollBoard(
  rules: (Rule | null)[],
  weights: Record<SymbolType, number>,
  previousResult: SymbolType[],
  rng: Rng,
  n = 5,
): SymbolType[] {
  const numberSpin = rules.some((r) => r?.id === 'number-spin');

  // Collect active positional/prev-state weight transforms, in slot order, with
  // copy-above expanded so a copied weight rule stacks (matches computeWeights).
  const transforms: PositionalWeightRule[] = [];
  for (const r of expandRules(rules)) {
    const t = r && POSITIONAL_WEIGHT_RULES[r.id];
    if (t) transforms.push(t);
  }

  const result: SymbolType[] = [];
  for (let i = 0; i < n; i++) {
    let cellWeights = weights;
    for (const t of transforms) {
      cellWeights = t(cellWeights, { cellIndex: i, previousResult });
    }

    const prev = previousResult[i];
    if (
      numberSpin &&
      (prev === 'seven' || prev === 'zero' || prev === 'four')
    ) {
      result.push(rollSymbolFrom(NUMBER_SPIN_POOL, cellWeights, rng));
    } else {
      result.push(rollSymbol(cellWeights, rng));
    }
  }
  return result;
}
