import type { Rule, SymbolType } from '@/types';
import { FRUITS, GEMS, VEHICLES, CATS, MONSTERS } from '@/data/symbols';
import { rollSymbol, rollSymbolFrom, type Rng } from '@/lib/rng';
import { expandRules } from '@/lib/expandRules';

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
        for (const f of FRUITS) weights[f] *= 3;
        break;
      case 'gem-surge':
        for (const g of GEMS) weights[g] *= 3;
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
 *  - `number-spin`: every cell whose `previousResult` value was a number
 *    (seven/zero/four) rolls restricted to {seven, zero, four}.
 *  - 백귀야행 `night-parade` (monster): board-global — monster weights are
 *    multiplied by (number of monsters in `previousResult` + 3) for this spin.
 *  - 고양이 확률 증가 `cat-odds` (cat): position-conditional — on the odd cells
 *    (1-indexed 1st/3rd/5th → indices 0/2/4) cat weights are multiplied by 4.
 *
 * Each cell still consumes exactly ONE rng draw, so replay stays byte-identical;
 * and because cat/monster carry weight 0 in legacy/quick/event bags (and these
 * rules are only offered when their set is rollable), the modifiers are no-ops
 * there. With none of these rules present this is equivalent to `baseSpin`.
 *
 * Matches `number-spin`'s convention of reading the raw slot array (no
 * copy-above expansion), so each modifier applies once regardless of stacking.
 */
export function rollBoard(
  rules: (Rule | null)[],
  weights: Record<SymbolType, number>,
  previousResult: SymbolType[],
  rng: Rng,
  n = 5,
): SymbolType[] {
  const numberSpin = rules.some((r) => r?.id === 'number-spin');
  const catOdds = rules.some((r) => r?.id === 'cat-odds');
  const nightParade = rules.some((r) => r?.id === 'night-parade');

  // 백귀야행: board-global monster boost based on the previous spin's monsters.
  let boardWeights = weights;
  if (nightParade) {
    const prevMonsters = previousResult.reduce(
      (n2, s) => (MONSTERS.includes(s) ? n2 + 1 : n2),
      0,
    );
    const mult = prevMonsters + 3;
    boardWeights = { ...weights };
    for (const m of MONSTERS) boardWeights[m] *= mult;
  }

  const result: SymbolType[] = [];
  for (let i = 0; i < n; i++) {
    // 고양이 확률 증가: odd cells (1-indexed) get a ×4 cat boost.
    let cellWeights = boardWeights;
    if (catOdds && i % 2 === 0) {
      cellWeights = { ...boardWeights };
      for (const c of CATS) cellWeights[c] *= 4;
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
