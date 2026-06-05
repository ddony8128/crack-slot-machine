import type { Rule, SymbolType } from '@/types';
import { FRUITS, GEMS } from '@/data/symbols';
import { rollSymbol, rollSymbolFrom, type Rng } from '@/lib/rng';
import { expandRules } from '@/lib/expandRules';

const NUMBER_SPIN_POOL: SymbolType[] = ['seven', 'zero'];

export function computeWeights(
  rules: (Rule | null)[],
  base: Record<SymbolType, number>,
): Record<SymbolType, number> {
  const weights = { ...base };

  // copy-above duplicates the rule above (including weight rules), so expand first.
  for (const rule of expandRules(rules)) {
    if (!rule) continue;

    // four-shield is a reroll rule, but it ALSO affects the pre-roll weights
    // (zero ×2 this spin), so it is handled here by id regardless of type.
    if (rule.id === 'four-shield') {
      weights.zero *= 2;
      continue;
    }

    if (rule.type !== 'weight') continue;

    switch (rule.id) {
      case 'seven-fever':
        weights.seven *= 3;
        break;
      case 'fruit-surge':
        for (const f of FRUITS) weights[f] *= 3;
        break;
      case 'gem-surge':
        for (const g of GEMS) weights[g] *= 3;
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
 * Roll the landing board honoring the `number-spin` PRE-ROLL roll-restriction.
 *
 * If `number-spin` is active (any slot rule id === 'number-spin'), every cell
 * whose `previousResult` value was a number (seven/zero/four) is rolled
 * restricted to {seven, zero} so it lands on 0 or 7 (never 4). All other cells
 * roll normally. With `number-spin` absent this is equivalent to `baseSpin`.
 */
export function rollBoard(
  rules: (Rule | null)[],
  weights: Record<SymbolType, number>,
  previousResult: SymbolType[],
  rng: Rng,
  n = 5,
): SymbolType[] {
  const numberSpin = rules.some((r) => r?.id === 'number-spin');
  const result: SymbolType[] = [];
  for (let i = 0; i < n; i++) {
    const prev = previousResult[i];
    if (
      numberSpin &&
      (prev === 'seven' || prev === 'zero' || prev === 'four')
    ) {
      result.push(rollSymbolFrom(NUMBER_SPIN_POOL, weights, rng));
    } else {
      result.push(rollSymbol(weights, rng));
    }
  }
  return result;
}
