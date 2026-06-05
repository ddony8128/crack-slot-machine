import type { Rule, SymbolType } from '@/types';
import { FRUITS, GEMS } from '@/data/symbols';
import { rollSymbol, rollSymbolFrom, type Rng } from '@/lib/rng';

const NUMBERS: SymbolType[] = ['seven', 'zero', 'four'];

export function computeWeights(
  rules: (Rule | null)[],
  base: Record<SymbolType, number>,
): Record<SymbolType, number> {
  const weights = { ...base };

  for (const rule of rules) {
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
        for (const f of FRUITS) weights[f] *= 2;
        break;
      case 'gem-surge':
        for (const g of GEMS) weights[g] *= 2;
        break;
      case 'no-zero':
        weights.zero = 0;
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
 * restricted to {seven, zero, four} so it lands on a number. All other cells
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
      result.push(rollSymbolFrom(NUMBERS, weights, rng));
    } else {
      result.push(rollSymbol(weights, rng));
    }
  }
  return result;
}
