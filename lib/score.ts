import type { EngineEvent, Rule, ScoreItem, SymbolType } from '@/types';
import { NUMBERS } from '@/data/symbols';
import { SYMBOL_SETS } from '@/lib/symbols/sets';
import { expandRules, countRule } from '@/lib/expandRules';
import {
  SEVEN_SCORE,
  HAND_PAIR,
  HAND_TWO_PAIR,
  HAND_TRIPLE,
  HAND_FULL_HOUSE,
  HAND_FOUR_KIND,
  HAND_FIVE_KIND,
  FOUR_PENALTY_PER,
  FOUR_FORTUNE_PER,
  BONUS_77,
  CLEAN_BONUS,
} from '@/data/scoreTable';

// Numbers (seven/zero/four) have dedicated scoring and never form poker hands or
// contribute to set bonuses. Everything else is a "set symbol".
const NUMBER_SET = new Set<SymbolType>(NUMBERS);

// Map an EngineEvent.type to the SetBonus.event tag it satisfies, plus where to
// read the symbol id that the event acted on.
type PerEventTag = 'moved' | 'rerolled' | 'copied';
function eventTag(e: EngineEvent): { tag: PerEventTag; symbolId: SymbolType } | null {
  switch (e.type) {
    case 'symbol_moved':
      return { tag: 'moved', symbolId: e.symbolId };
    case 'symbol_rerolled':
      return { tag: 'rerolled', symbolId: e.symbolId };
    case 'symbol_copied':
      return { tag: 'copied', symbolId: e.symbolId };
    default:
      return null; // transformed / locked have no per-event bonus
  }
}

const PER_EVENT_LABEL: Record<PerEventTag, string> = {
  moved: '이동',
  rerolled: '재굴림',
  copied: '복사',
};

export function countFours(result: SymbolType[]): number {
  return result.filter((s) => s === 'four').length;
}

export function countSevens(result: SymbolType[]): number {
  return result.filter((s) => s === 'seven').length;
}

export function countZeros(result: SymbolType[]): number {
  return result.filter((s) => s === 'zero').length;
}

// Best n-of-a-kind over ALL non-number symbols. Numbers (seven/zero/four) are
// ignored. For legacy boards (only fruits/gems) this is identical to before.
export function computeHand(
  result: SymbolType[],
  haunted?: boolean[],
): { hand: string; handScore: number } {
  const counts = new Map<SymbolType, number>();
  for (const s of result) {
    if (!NUMBER_SET.has(s)) counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  // E1-lite: each haunted cell adds ONE phantom 'ghost' to the counts. Omitted /
  // empty `haunted` -> identical to the legacy behaviour.
  if (haunted) {
    for (let i = 0; i < haunted.length; i++) {
      if (haunted[i]) counts.set('ghost', (counts.get('ghost') ?? 0) + 1);
    }
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

/**
 * Config-driven set bonuses. Iterates every non-number SYMBOL_SET and applies
 * its configured SetBonus[] against the board (and optional engine events),
 * returning both the running sum and the labeled line items (so scoreResult and
 * scoreItems never disagree).
 *
 * Per-event bonuses count only when `events` is provided.
 */
export function setBonuses(
  result: SymbolType[],
  events?: EngineEvent[],
): { sum: number; items: ScoreItem[] } {
  const items: ScoreItem[] = [];

  for (const set of SYMBOL_SETS) {
    if (set.isNumberSet) continue;

    const members = new Set<SymbolType>(set.symbols.map((s) => s.id as SymbolType));
    const onBoard = result.filter((s) => members.has(s)).length;

    for (const bonus of set.bonuses) {
      switch (bonus.type) {
        case 'all-types': {
          const present = set.symbols.every((s) => result.includes(s.id as SymbolType));
          if (present) items.push({ label: `${set.name} 3종`, points: bonus.points });
          break;
        }
        case 'all-symbols': {
          if (result.length === 5 && result.every((s) => members.has(s)))
            items.push({ label: `올 ${set.name}`, points: bonus.points });
          break;
        }
        case 'per-symbol': {
          if (onBoard > 0)
            items.push({ label: `${set.name} ${onBoard}개`, points: bonus.points * onBoard });
          break;
        }
        case 'adjacent-penalty': {
          // Count board cells that are members AND have an adjacent (left/right)
          // member. Example: [cheese_cat][tuxedo_cat][zero][calico_cat][seven]
          // -> cells 0 and 1 each have a member neighbor (each other) = 2 cells;
          // the lone calico at idx 3 has no member neighbor. 2 * points.
          let adj = 0;
          for (let i = 0; i < result.length; i++) {
            if (!members.has(result[i])) continue;
            const left = i > 0 && members.has(result[i - 1]);
            const right = i + 1 < result.length && members.has(result[i + 1]);
            if (left || right) adj += 1;
          }
          if (adj > 0)
            items.push({ label: `이웃 ${set.name}`, points: bonus.points * adj });
          break;
        }
        case 'per-event': {
          if (!events || events.length === 0) break;
          let count = 0;
          for (const e of events) {
            const tagged = eventTag(e);
            if (tagged && tagged.tag === bonus.event && members.has(tagged.symbolId)) count += 1;
          }
          if (count > 0)
            items.push({
              label: `${set.name} ${PER_EVENT_LABEL[bonus.event]}`,
              points: bonus.points * count,
            });
          break;
        }
      }
    }
  }

  const sum = items.reduce((a, it) => a + it.points, 0);
  return { sum, items };
}

const HAND_KO: Record<string, string> = {
  Pair: '페어',
  'Two Pair': '투페어',
  Triple: '트리플',
  'Full House': '풀하우스',
  'Four of a Kind': '포카드',
  'Five of a Kind': '파이브카드',
};

/**
 * Itemized score breakdown ("why these points"). Sum of points == baseRoundScore
 * (pre-multiplier). Mirrors scoreResult exactly so they never disagree.
 */
/** Board snapshot at a score rule's slot position (from the cascade frame). */
export type ScoreBoardSnapshot = { ruleId: string; board: SymbolType[] };

/**
 * How many CLEAN SWEEP applications pay out. POSITION-AWARE when scoreBoards is
 * provided: each clean-bonus application checks the board AT ITS OWN slot moment
 * (4-free there → pays), so rule ORDER matters. Without scoreBoards (pure unit
 * tests) it falls back to the final board.
 */
function cleanSweepCount(
  expanded: (Rule | null)[],
  result: SymbolType[],
  scoreBoards?: ScoreBoardSnapshot[],
): number {
  if (scoreBoards) {
    return scoreBoards.filter(
      (sb) => sb.ruleId === 'clean-bonus' && countFours(sb.board) === 0,
    ).length;
  }
  return countFours(result) === 0 ? countRule(expanded, 'clean-bonus') : 0;
}

export function scoreItems(
  result: SymbolType[],
  activeSlotRules: (Rule | null)[] = [],
  events?: EngineEvent[],
  scoreBoards?: ScoreBoardSnapshot[],
  haunted?: boolean[],
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

  const { hand, handScore } = computeHand(result, haunted);
  if (handScore > 0) items.push({ label: `족보: ${HAND_KO[hand] ?? hand}`, points: handScore });

  items.push(...setBonuses(result, events).items);

  const b77 = countRule(expanded, 'bonus-77');
  if (b77 > 0) items.push({ label: b77 > 1 ? `LUCKY SEVEN-SEVEN ×${b77}` : 'LUCKY SEVEN-SEVEN', points: BONUS_77 * b77 });

  const clean = cleanSweepCount(expanded, result, scoreBoards);
  if (clean > 0)
    items.push({ label: clean > 1 ? `CLEAN SWEEP ×${clean}` : 'CLEAN SWEEP', points: CLEAN_BONUS * clean });

  const fours = countFours(result);
  const fortune = countRule(expanded, 'four-fortune');
  if (fours > 0) {
    if (fortune > 0) {
      items.push({ label: `4 보너스 (${fours}개)`, points: fours * FOUR_FORTUNE_PER * fortune });
    } else {
      items.push({ label: `4 페널티 (${fours}개)`, points: -(fours * FOUR_PENALTY_PER) });
    }
  }

  return items;
}

export function scoreResult(
  result: SymbolType[],
  activeSlotRules: (Rule | null)[] = [],
  events?: EngineEvent[],
  scoreBoards?: ScoreBoardSnapshot[],
  haunted?: boolean[],
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
  const { hand, handScore } = computeHand(result, haunted);

  // seven-double: each application doubles the seven portion (×2 per occurrence).
  let sevenPts = SEVEN_SCORE[countSevens(result)] ?? 0;
  const sevenDoubleCount = countRule(expanded, 'seven-double');
  for (let k = 0; k < sevenDoubleCount; k++) sevenPts *= 2;

  let bonusScore = setBonuses(result, events).sum;
  bonusScore += BONUS_77 * countRule(expanded, 'bonus-77');
  bonusScore += CLEAN_BONUS * cleanSweepCount(expanded, result, scoreBoards);

  // FOUR FORTUNE: while active, each 4 scores +FOUR_FORTUNE_PER (×count via
  // copy-above) instead of incurring the normal penalty.
  const fours = countFours(result);
  const fortune = countRule(expanded, 'four-fortune');
  let penalty: number;
  if (fortune > 0) {
    bonusScore += fours * FOUR_FORTUNE_PER * fortune;
    penalty = 0;
  } else {
    penalty = fours * FOUR_PENALTY_PER;
  }
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
