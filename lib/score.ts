import type { Rule, ScoreItem, SymbolType } from '@/types';
import { FRUITS, GEMS, RED_SET, BLUE_SET } from '@/data/symbols';
import { expandRules, countRule } from '@/lib/expandRules';
import {
  SEVEN_SCORE,
  HAND_PAIR,
  HAND_TWO_PAIR,
  HAND_TRIPLE,
  HAND_FULL_HOUSE,
  HAND_FOUR_KIND,
  HAND_FIVE_KIND,
  BONUS_ALL_FRUIT_TYPES,
  BONUS_ALL_GEM_TYPES,
  BONUS_ONLY_FRUITS,
  BONUS_ONLY_GEMS,
  BONUS_ALL_BLUE,
  BONUS_ALL_RED,
  FOUR_PENALTY_PER,
  BONUS_77,
  CLEAN_BONUS,
} from '@/data/scoreTable';

const FRUIT_SET = new Set<SymbolType>(FRUITS);
const GEM_SET = new Set<SymbolType>(GEMS);
const COLORED: SymbolType[] = [...FRUITS, ...GEMS];
const COLORED_SET = new Set<SymbolType>(COLORED);

export function countFours(result: SymbolType[]): number {
  return result.filter((s) => s === 'four').length;
}

export function countSevens(result: SymbolType[]): number {
  return result.filter((s) => s === 'seven').length;
}

export function countZeros(result: SymbolType[]): number {
  return result.filter((s) => s === 'zero').length;
}

// Best colored n-of-a-kind. Numbers (seven/zero/four) are ignored.
export function computeHand(result: SymbolType[]): { hand: string; handScore: number } {
  const counts = new Map<SymbolType, number>();
  for (const s of result) {
    if (COLORED_SET.has(s)) counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  const values = [...counts.values()];
  const max = values.length ? Math.max(...values) : 0;
  const pairs = values.filter((c) => c === 2).length;
  const hasTriple = values.includes(3);
  const hasPair = values.includes(2);

  if (max >= 5) return { hand: 'Five of a Kind', handScore: HAND_FIVE_KIND };
  if (max === 4) return { hand: 'Four of a Kind', handScore: HAND_FOUR_KIND };
  if (hasTriple && hasPair) return { hand: 'Full House', handScore: HAND_FULL_HOUSE };
  if (max === 3) return { hand: 'Triple', handScore: HAND_TRIPLE };
  if (pairs >= 2) return { hand: 'Two Pair', handScore: HAND_TWO_PAIR };
  if (max === 2) return { hand: 'Pair', handScore: HAND_PAIR };
  return { hand: 'No Hand', handScore: 0 };
}

export function sevenScore(
  result: SymbolType[],
  opts: { sevenDouble: boolean } = { sevenDouble: false },
): number {
  const sevens = countSevens(result);
  const base = SEVEN_SCORE[sevens] ?? 0;
  return opts.sevenDouble ? base * 2 : base;
}

// Sum of additive color/type bonuses.
export function colorBonuses(result: SymbolType[]): number {
  let bonus = 0;
  const has = (s: SymbolType) => result.includes(s);

  if (has('cherry') && has('lemon') && has('grape')) bonus += BONUS_ALL_FRUIT_TYPES;
  if (has('diamond') && has('ruby') && has('sapphire')) bonus += BONUS_ALL_GEM_TYPES;

  if (result.length === 5 && result.every((s) => FRUIT_SET.has(s))) bonus += BONUS_ONLY_FRUITS;
  if (result.length === 5 && result.every((s) => GEM_SET.has(s))) bonus += BONUS_ONLY_GEMS;
  if (result.length === 5 && result.every((s) => BLUE_SET.has(s))) bonus += BONUS_ALL_BLUE;
  if (result.length === 5 && result.every((s) => RED_SET.has(s))) bonus += BONUS_ALL_RED;

  return bonus;
}

const HAND_KO: Record<string, string> = {
  Pair: '페어',
  'Two Pair': '투페어',
  Triple: '트리플',
  'Full House': '풀하우스',
  'Four of a Kind': '포카드',
  'Five of a Kind': '파이브카드',
};

// Color/type bonuses as labeled line items (parallel to colorBonuses' sum).
export function colorBonusItems(result: SymbolType[]): ScoreItem[] {
  const items: ScoreItem[] = [];
  const has = (s: SymbolType) => result.includes(s);
  const all = (set: Set<SymbolType>) =>
    result.length === 5 && result.every((s) => set.has(s));

  if (has('cherry') && has('lemon') && has('grape'))
    items.push({ label: '과일 3종', points: BONUS_ALL_FRUIT_TYPES });
  if (has('diamond') && has('ruby') && has('sapphire'))
    items.push({ label: '보석 3종', points: BONUS_ALL_GEM_TYPES });
  if (all(FRUIT_SET)) items.push({ label: '올 과일', points: BONUS_ONLY_FRUITS });
  if (all(GEM_SET)) items.push({ label: '올 보석', points: BONUS_ONLY_GEMS });
  if (all(new Set(BLUE_SET))) items.push({ label: '올 블루', points: BONUS_ALL_BLUE });
  if (all(new Set(RED_SET))) items.push({ label: '올 레드', points: BONUS_ALL_RED });
  return items;
}

/**
 * Itemized score breakdown ("why these points"). Sum of points == baseRoundScore
 * (pre-multiplier). Mirrors scoreResult exactly so they never disagree.
 */
export function scoreItems(
  result: SymbolType[],
  activeSlotRules: (Rule | null)[] = [],
): ScoreItem[] {
  const expanded = expandRules(activeSlotRules);
  const items: ScoreItem[] = [];

  const sevens = countSevens(result);
  if (sevens >= 1) {
    let pts = SEVEN_SCORE[sevens] ?? 0;
    const dbl = countRule(expanded, 'seven-double');
    for (let k = 0; k < dbl; k++) pts *= 2;
    items.push({ label: dbl > 0 ? `7 ${sevens}개 (×${2 ** dbl})` : `7 ${sevens}개`, points: pts });
  }

  const { hand, handScore } = computeHand(result);
  if (handScore > 0) items.push({ label: `족보: ${HAND_KO[hand] ?? hand}`, points: handScore });

  items.push(...colorBonusItems(result));

  const b77 = countRule(expanded, 'bonus-77');
  if (b77 > 0) items.push({ label: b77 > 1 ? `LUCKY SEVEN-SEVEN ×${b77}` : 'LUCKY SEVEN-SEVEN', points: BONUS_77 * b77 });

  const clean = countRule(expanded, 'clean-bonus');
  if (clean > 0 && countFours(result) === 0)
    items.push({ label: clean > 1 ? `CLEAN SWEEP ×${clean}` : 'CLEAN SWEEP', points: CLEAN_BONUS * clean });

  const fours = countFours(result);
  if (fours > 0) items.push({ label: `4 페널티 (${fours}개)`, points: -(fours * FOUR_PENALTY_PER) });

  return items;
}

export function scoreResult(
  result: SymbolType[],
  activeSlotRules: (Rule | null)[] = [],
): {
  hand: string;
  handScore: number;
  sevenScore: number;
  bonusScore: number;
  penalty: number;
  baseRoundScore: number;
} {
  // copy-above duplicates the rule above (including score rules), so expand and
  // COUNT occurrences — each application of a score rule stacks.
  const expanded = expandRules(activeSlotRules);
  const { hand, handScore } = computeHand(result);

  // seven-double: each application doubles the seven portion (×2 per occurrence).
  let sevenPts = SEVEN_SCORE[countSevens(result)] ?? 0;
  const sevenDoubleCount = countRule(expanded, 'seven-double');
  for (let k = 0; k < sevenDoubleCount; k++) sevenPts *= 2;

  let bonusScore = colorBonuses(result);
  bonusScore += BONUS_77 * countRule(expanded, 'bonus-77');
  if (countFours(result) === 0) {
    bonusScore += CLEAN_BONUS * countRule(expanded, 'clean-bonus');
  }

  const penalty = countFours(result) * FOUR_PENALTY_PER;
  const baseRoundScore = sevenPts + handScore + bonusScore - penalty;

  return {
    hand,
    handScore,
    sevenScore: sevenPts,
    bonusScore,
    penalty,
    baseRoundScore,
  };
}
