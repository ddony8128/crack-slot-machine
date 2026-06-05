import type { Rule, SymbolType } from '@/types';
import { FRUITS, GEMS, RED_SET, BLUE_SET } from '@/data/symbols';
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

function hasActiveRule(rules: (Rule | null)[], id: string): boolean {
  return rules.some((r) => r != null && r.id === id);
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
  const sevenDouble = hasActiveRule(activeSlotRules, 'seven-double');
  const { hand, handScore } = computeHand(result);
  const sevenPts = sevenScore(result, { sevenDouble });

  let bonusScore = colorBonuses(result);
  if (hasActiveRule(activeSlotRules, 'bonus-77')) bonusScore += BONUS_77;
  if (hasActiveRule(activeSlotRules, 'clean-bonus') && countFours(result) === 0) {
    bonusScore += CLEAN_BONUS;
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
