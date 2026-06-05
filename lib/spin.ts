import type { Rule, SymbolType } from '@/types';
import { FRUITS, GEMS } from '@/data/symbols';
import { rollSymbol, type Rng } from '@/lib/rng';

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
