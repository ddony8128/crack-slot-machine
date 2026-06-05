import type { SymbolType } from '@/types';
import { FRUITS, GEMS } from '@/data/symbols';
import {
  ALL_FRUITS,
  ALL_GEMS,
  FIVE_OF_A_KIND,
  FOUR_OF_A_KIND,
  FOUR_PENALTY_ALL_FIVE,
  FOUR_PENALTY_EXTRA_3PLUS,
  FOUR_PENALTY_PER,
  JACKPOT,
  PAIR,
  THREE_OF_A_KIND,
} from '@/data/scoreTable';

const FRUIT_SET = new Set<SymbolType>(FRUITS);
const GEM_SET = new Set<SymbolType>(GEMS);

export function countFours(result: SymbolType[]): number {
  return result.filter((s) => s === 'four').length;
}

function nOfAKindScore(n: number): { name: string; score: number } {
  switch (n) {
    case 5:
      return { name: 'Five of a Kind', score: FIVE_OF_A_KIND };
    case 4:
      return { name: 'Four of a Kind', score: FOUR_OF_A_KIND };
    case 3:
      return { name: 'Three of a Kind', score: THREE_OF_A_KIND };
    case 2:
      return { name: 'Pair', score: PAIR };
    default:
      return { name: 'No Hand', score: 0 };
  }
}

export function computeHand(result: SymbolType[]): { hand: string; handScore: number } {
  // JACKPOT: exactly five 'seven'.
  if (result.length === 5 && result.every((s) => s === 'seven')) {
    return { hand: 'JACKPOT', handScore: JACKPOT };
  }

  // Positive symbols = everything except 'zero' and 'four'. ('seven' counts.)
  const positives = result.filter((s) => s !== 'zero' && s !== 'four');

  // N-of-a-kind among positive symbols.
  const counts = new Map<SymbolType, number>();
  for (const s of positives) counts.set(s, (counts.get(s) ?? 0) + 1);
  let maxCount = 0;
  for (const c of counts.values()) maxCount = Math.max(maxCount, c);

  const nKind = nOfAKindScore(maxCount);

  // Collect candidates: prefer n-of-a-kind name on ties.
  let bestName = nKind.name;
  let bestScore = nKind.score;

  const allFruits = result.length === 5 && result.every((s) => FRUIT_SET.has(s));
  const allGems = result.length === 5 && result.every((s) => GEM_SET.has(s));

  if (allFruits && ALL_FRUITS > bestScore) {
    bestName = 'All Fruits';
    bestScore = ALL_FRUITS;
  }
  if (allGems && ALL_GEMS > bestScore) {
    bestName = 'All Gems';
    bestScore = ALL_GEMS;
  }

  if (bestScore <= 0) return { hand: 'No Hand', handScore: 0 };
  return { hand: bestName, handScore: bestScore };
}

export function computePenalty(result: SymbolType[]): number {
  const fourCount = countFours(result);
  if (fourCount === 5) return FOUR_PENALTY_ALL_FIVE;
  let base = fourCount * FOUR_PENALTY_PER;
  if (fourCount >= 3) base += FOUR_PENALTY_EXTRA_3PLUS;
  return base;
}

export function scoreResult(result: SymbolType[]): {
  hand: string;
  handScore: number;
  penalty: number;
  roundScore: number;
} {
  const { hand, handScore } = computeHand(result);
  const penalty = computePenalty(result);
  return { hand, handScore, penalty, roundScore: handScore - penalty };
}
