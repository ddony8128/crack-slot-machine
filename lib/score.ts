import type { EngineEvent, Rule, ScoreItem, SymbolType } from '@/types';
import { NUMBERS } from '@/data/symbols';
import { SYMBOL_SETS, SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { symbolInSet } from '@/lib/symbols/tags';
import { PAIR_RULES } from '@/lib/pairRules';
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
  PARKING_FEE_PER,
  DRACULA_FAMILY_PER,
  VITAMIN_PER,
  HAND_FLAT_UPGRADE,
  BONUS_77,
  CLEAN_BONUS,
  GEM_BEAUTY,
} from '@/data/scoreTable';

/** 첨탑 per-hand upgrades, keyed by computeHand's hand name. */
export type HandUpgradeMap = Record<string, { flatBonusCount: number; doubleCount: number }>;

/** Apply a hand upgrade: (base + 50×flat) × 2^double. No-op when absent/unscored. */
export function upgradedHandScore(hand: string, base: number, ups?: HandUpgradeMap): number {
  if (!ups || base <= 0) return base;
  const u = ups[hand];
  if (!u) return base;
  return (base + HAND_FLAT_UPGRADE * (u.flatBonusCount ?? 0)) * 2 ** (u.doubleCount ?? 0);
}

/** +VITAMIN_PER per fruit rerolled by 비타민 보충 (counted from the event log, so
 *  it reflects fruits at the rule's moment, not the final board). */
function vitaminFruits(events?: EngineEvent[]): number {
  if (!events) return 0;
  return events.filter(
    (e) => e.type === 'symbol_rerolled' && e.byRuleId === 'fruit-vitamin',
  ).length;
}

// Numbers (seven/zero/four) have dedicated scoring and never form poker hands or
// contribute to set bonuses. Everything else is a "set symbol".
const NUMBER_SET = new Set<SymbolType>(NUMBERS);

/** Cells held by 유료 주차 (vehicle-parking) this spin — one symbol_held event per
 *  vehicle cell the player picked. EVENT-based so the fee tracks the player's
 *  pick, not the final board. */
function parkingHolds(events?: EngineEvent[]): number {
  if (!events) return 0;
  return events.filter(
    (e) => e.type === 'symbol_held' && e.byRuleId === 'vehicle-parking',
  ).length;
}

/** Draculas on the (final) board — drives the 가족 만들기 family bonus. */
function countDraculas(result: SymbolType[]): number {
  return result.filter((s) => s === 'dracula').length;
}

/** Does the (final) board contain ≥1 gem-set symbol? Drives 미의 추구. */
function boardHasGem(result: SymbolType[]): boolean {
  const gem = SYMBOL_SETS_BY_ID['gem'];
  return result.some((s) => symbolInSet(s, gem));
}

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
  opts?: { extraCherry?: boolean },
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

  // cherry-charm (체리): count one extra cherry BEFORE evaluating the hand, so a
  // pair can upgrade to a triple, etc. No-op unless the artifact is active.
  if (opts?.extraCherry) {
    counts.set('cherry', (counts.get('cherry') ?? 0) + 1);
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

    // Set membership for COUNTING bonuses (per-symbol/adjacent/all-symbols/
    // per-event) goes through symbolInSet, so a HYBRID (e.g. zombie_cat) counts
    // for every set it is tagged into — NOT just a single literal set. The
    // `all-types` ("3종") completeness check below deliberately does NOT use this:
    // it keys off each base `set.symbols[].id` literally, so a hybrid alone can
    // never complete a 3종 (every base type must actually be present).
    const isMember = (sym: SymbolType) => symbolInSet(sym, set);
    const onBoard = result.filter(isMember).length;

    for (const bonus of set.bonuses) {
      switch (bonus.type) {
        case 'all-types': {
          const present = set.symbols.every((s) => result.includes(s.id as SymbolType));
          if (present) items.push({ label: `${set.name} 3종`, points: bonus.points });
          break;
        }
        case 'all-symbols': {
          if (result.length === 5 && result.every(isMember))
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
            if (!isMember(result[i])) continue;
            const left = i > 0 && isMember(result[i - 1]);
            const right = i + 1 < result.length && isMember(result[i + 1]);
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
            if (tagged && tagged.tag === bonus.event && isMember(tagged.symbolId)) count += 1;
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

/** Does the board contain ≥1 member of the given symbol set? */
function boardHasSet(result: SymbolType[], setId: string): boolean {
  const set = SYMBOL_SETS_BY_ID[setId];
  if (!set) return false;
  const members = new Set<SymbolType>(set.symbols.map((s) => s.id as SymbolType));
  return result.some((s) => members.has(s));
}

/**
 * Generic A–B pair bonus. For each PairRule active in `expanded` (n = count,
 * so copy-above stacks), pay points*n iff the board has ≥1 member of BOTH sets.
 * Returns the running sum + labeled line items so scoreResult/scoreItems agree.
 */
function pairBonus(
  expanded: (Rule | null)[],
  result: SymbolType[],
): { sum: number; items: ScoreItem[] } {
  const items: ScoreItem[] = [];
  for (const pair of PAIR_RULES) {
    const n = countRule(expanded, pair.id);
    if (n <= 0) continue;
    if (!boardHasSet(result, pair.setA) || !boardHasSet(result, pair.setB)) continue;
    items.push({ label: n > 1 ? `${pair.name} ×${n}` : pair.name, points: pair.points * n });
  }
  const sum = items.reduce((a, it) => a + it.points, 0);
  return { sum, items };
}

// Per-event types carrying a single acted-on symbol (moved/rerolled/copied).
type SymbolEventType = 'symbol_moved' | 'symbol_rerolled' | 'symbol_copied';

/** Count events of a given type whose symbolId is a member of the named set. */
function countSetEvents(
  events: EngineEvent[] | undefined,
  type: SymbolEventType,
  setId: string,
): number {
  if (!events || events.length === 0) return 0;
  const set = SYMBOL_SETS_BY_ID[setId];
  if (!set) return 0;
  let count = 0;
  for (const e of events) {
    if (e.type === type && symbolInSet(e.symbolId, set)) count += 1;
  }
  return count;
}

/** Count cat cells that have an adjacent cat — mirrors setBonuses' adjacent-penalty. */
function catAdjacentCells(result: SymbolType[]): number {
  const set = SYMBOL_SETS_BY_ID['cat'];
  if (!set) return 0;
  const isMember = (sym: SymbolType) => symbolInSet(sym, set);
  let adj = 0;
  for (let i = 0; i < result.length; i++) {
    if (!isMember(result[i])) continue;
    const left = i > 0 && isMember(result[i - 1]);
    const right = i + 1 < result.length && isMember(result[i + 1]);
    if (left || right) adj += 1;
  }
  return adj;
}

/**
 * Additive 첨탑 artifact bonuses (effects 2–7). PURE — used by BOTH scoreResult
 * and scoreItems so they never disagree. Returns the running sum + labeled line
 * items. The cherry-charm (effect 1) and the spin multiplier (effects 8–9) are
 * handled elsewhere (computeHand opts / artifactSpinMultiplier).
 */
export function artifactBonus(
  result: SymbolType[],
  activeSlotRules: (Rule | null)[],
  events: EngineEvent[] | undefined,
  artifacts: string[],
): { bonus: number; items: ScoreItem[] } {
  const items: ScoreItem[] = [];

  // 2. receipt (영수증): +300 when all 5 cells are in the fruit set.
  if (artifacts.includes('receipt')) {
    const fruit = SYMBOL_SETS_BY_ID['fruit'];
    if (fruit && result.length === 5 && result.every((s) => symbolInSet(s, fruit))) {
      items.push({ label: '영수증 +300', points: 300 });
    }
  }

  // 3. vault (금고): +200 when all 3 gem types are present.
  if (artifacts.includes('vault')) {
    const gem = SYMBOL_SETS_BY_ID['gem'];
    if (gem && gem.symbols.every((s) => result.includes(s.id as SymbolType))) {
      items.push({ label: '금고 +200', points: 200 });
    }
  }

  // 4. cat-tower (캣 타워): +60 × (cat cells with an adjacent cat) — exactly
  // cancels the existing adjacent-penalty.
  if (artifacts.includes('cat-tower')) {
    const adj = catAdjacentCells(result);
    if (adj > 0) items.push({ label: '캣 타워', points: 60 * adj });
  }

  // 5. blank-canvas (새하얀 도화지): +50 × (NULL entries in activeSlotRules).
  if (artifacts.includes('blank-canvas')) {
    const empty = activeSlotRules.filter((r) => r === null).length;
    if (empty > 0) items.push({ label: `새하얀 도화지 (${empty}칸)`, points: 50 * empty });
  }

  // 6. spooky-cruise (으스스한 유람선): +40 × (vehicle symbol_copied events).
  if (artifacts.includes('spooky-cruise')) {
    const n = countSetEvents(events, 'symbol_copied', 'vehicle');
    if (n > 0) items.push({ label: `유람선 복사 (${n})`, points: 40 * n });
  }

  // 7. monster-truck (괴물 자동차): +20 × (monster moved + rerolled events).
  if (artifacts.includes('monster-truck')) {
    const n =
      countSetEvents(events, 'symbol_moved', 'monster') +
      countSetEvents(events, 'symbol_rerolled', 'monster');
    if (n > 0) items.push({ label: `괴물 자동차 (${n})`, points: 20 * n });
  }

  const bonus = items.reduce((a, it) => a + it.points, 0);
  return { bonus, items };
}

/**
 * 첨탑 artifact spin multiplier (effects 8–9). PURE. Applied to baseRoundScore
 * AFTER the additive bonuses/penalty. crowbar and private-jet each contribute a
 * ×2, stacking to ×4.
 */
export function artifactSpinMultiplier(
  events: EngineEvent[] | undefined,
  artifacts: string[],
): number {
  // 8. crowbar (빠루): ≥3 monster rerolls → ×2.
  const crowbar =
    artifacts.includes('crowbar') &&
    countSetEvents(events, 'symbol_rerolled', 'monster') >= 3;
  // 9. private-jet (전용기): ≥6 vehicle moves → ×2.
  const privateJet =
    artifacts.includes('private-jet') &&
    countSetEvents(events, 'symbol_moved', 'vehicle') >= 6;
  return (crowbar ? 2 : 1) * (privateJet ? 2 : 1);
}

export function scoreItems(
  result: SymbolType[],
  activeSlotRules: (Rule | null)[] = [],
  events?: EngineEvent[],
  scoreBoards?: ScoreBoardSnapshot[],
  haunted?: boolean[],
  handUpgrades?: HandUpgradeMap,
  artifacts: string[] = [],
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

  const { hand, handScore: baseHand } = computeHand(result, haunted, {
    extraCherry: artifacts.includes('cherry-charm'),
  });
  const handScore = upgradedHandScore(hand, baseHand, handUpgrades);
  if (handScore > 0) {
    const upgraded = handScore !== baseHand;
    items.push({
      label: `족보: ${HAND_KO[hand] ?? hand}${upgraded ? ' (강화)' : ''}`,
      points: handScore,
    });
  }

  items.push(...setBonuses(result, events).items);

  const b77 = countRule(expanded, 'bonus-77');
  if (b77 > 0) items.push({ label: b77 > 1 ? `LUCKY SEVEN-SEVEN ×${b77}` : 'LUCKY SEVEN-SEVEN', points: BONUS_77 * b77 });

  // 미의 추구 (gem-beauty): mirror bonus-77, gated on a gem being present.
  const beauty = countRule(expanded, 'gem-beauty');
  if (beauty > 0 && boardHasGem(result))
    items.push({ label: beauty > 1 ? `미의 추구 ×${beauty}` : '미의 추구 ×1', points: GEM_BEAUTY * beauty });

  const vit = vitaminFruits(events);
  if (vit > 0) items.push({ label: `비타민 보충 (${vit}과일)`, points: VITAMIN_PER * vit });

  items.push(...pairBonus(expanded, result).items);

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

  // 가족 만들기 (monster-family): +DRACULA_FAMILY_PER per dracula on the final
  // board, ×rule occurrences (copy-above stacks). A positive ScoreItem.
  const family = countRule(expanded, 'monster-family');
  const draculas = countDraculas(result);
  if (family > 0 && draculas > 0) {
    items.push({ label: `가족 만들기 (드라큘라 ${draculas})`, points: DRACULA_FAMILY_PER * draculas * family });
  }

  // 유료 주차 (vehicle-parking): lose PARKING_FEE_PER per HELD vehicle cell. Now
  // EVENT-based — counts symbol_held events from the player's pick, not the final
  // board (×stacks falls out naturally since copy-above re-runs the select). A
  // negative ScoreItem, like 4 페널티.
  const parkHolds = parkingHolds(events);
  if (parkHolds > 0) {
    items.push({ label: `유료 주차 (${parkHolds}칸)`, points: -(parkHolds * PARKING_FEE_PER) });
  }

  // 첨탑 additive artifact bonuses (effects 2–7).
  items.push(...artifactBonus(result, activeSlotRules, events, artifacts).items);

  // 첨탑 spin multiplier (effects 8–9): applied to the whole spin AFTER the
  // additive bonuses/penalty. Push a single item carrying the added delta so the
  // items keep summing to scoreResult.baseRoundScore.
  const mult = artifactSpinMultiplier(events, artifacts);
  if (mult > 1) {
    const preMult = items.reduce((a, it) => a + it.points, 0);
    items.push({ label: `아티팩트 배수 ×${mult}`, points: preMult * (mult - 1) });
  }

  return items;
}

export function scoreResult(
  result: SymbolType[],
  activeSlotRules: (Rule | null)[] = [],
  events?: EngineEvent[],
  scoreBoards?: ScoreBoardSnapshot[],
  haunted?: boolean[],
  handUpgrades?: HandUpgradeMap,
  artifacts: string[] = [],
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
  const { hand, handScore: baseHand } = computeHand(result, haunted, {
    extraCherry: artifacts.includes('cherry-charm'),
  });
  const handScore = upgradedHandScore(hand, baseHand, handUpgrades);

  // seven-double: each application doubles the seven portion (×2 per occurrence).
  let sevenPts = SEVEN_SCORE[countSevens(result)] ?? 0;
  const sevenDoubleCount = countRule(expanded, 'seven-double');
  for (let k = 0; k < sevenDoubleCount; k++) sevenPts *= 2;

  let bonusScore = setBonuses(result, events).sum;
  bonusScore += BONUS_77 * countRule(expanded, 'bonus-77');
  // 미의 추구 (gem-beauty): +GEM_BEAUTY per rule occurrence, ONLY if the board has
  // ≥1 gem. No gem -> no points even if slotted.
  if (boardHasGem(result)) bonusScore += GEM_BEAUTY * countRule(expanded, 'gem-beauty');
  bonusScore += VITAMIN_PER * vitaminFruits(events);
  bonusScore += pairBonus(expanded, result).sum;
  bonusScore += CLEAN_BONUS * cleanSweepCount(expanded, result, scoreBoards);

  // 가족 만들기 (monster-family): +DRACULA_FAMILY_PER per dracula on the final
  // board, ×rule occurrences (copy-above stacks).
  bonusScore += DRACULA_FAMILY_PER * countDraculas(result) * countRule(expanded, 'monster-family');

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

  // 유료 주차 (vehicle-parking): add a per-HELD-cell fee to the penalty. Now
  // EVENT-based — one fee per symbol_held event from the player's pick (NOT the
  // final board), mirroring the four-penalty handling.
  penalty += parkingHolds(events) * PARKING_FEE_PER;

  // 첨탑 additive artifact bonuses (effects 2–7) fold into bonusScore.
  bonusScore += artifactBonus(result, activeSlotRules, events, artifacts).bonus;

  // 첨탑 spin multiplier (effects 8–9) applies to the whole spin AFTER the
  // additive bonuses/penalty (crowbar/private-jet stack to ×4).
  const mult = artifactSpinMultiplier(events, artifacts);
  const baseRoundScore = (sevenPts + handScore + bonusScore - penalty) * mult;

  return {
    hand,
    handScore,
    sevenScore: sevenPts,
    bonusScore,
    penalty,
    baseRoundScore,
  };
}
