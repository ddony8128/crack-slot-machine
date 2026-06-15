/**
 * Pure helpers for the RULE SLOT 첨탑 오르기 (Spire) run setup (Season 1 §16).
 *
 * The spire starts with the NUMBER set only (base bag 0×12, 4×5, 7×3). Before
 * stage 1 the player is shown 2 seed-picked symbol sets and chooses one; the
 * chosen set's 3 symbols are each added ×1 and 3 zeros are removed, and that
 * set's rules unlock. These helpers are deterministic and side-effect-free.
 */

import type { SymbolType } from '@/types';
import { BASE_WEIGHTS } from '@/data/symbols';
import { createSeededRng } from '@/lib/rng';
import { initialBoardFor } from '@/lib/board/initialBoard';
import { buildRulePool } from '@/lib/modes/config';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';

/** The non-number symbol sets the player may be offered before stage 1. */
const SPIRE_SET_CHOICE_IDS: string[] = ['fruit', 'gem', 'cat', 'vehicle', 'monster'];

/**
 * Deterministically pick 2 DISTINCT non-number set ids for the pre-stage-1
 * choice. Stable for a given seed (derived from `${seed}:set-choice`).
 */
export function pickSpireSetChoices(seed: string): [string, string] {
  const rng = createSeededRng(`${seed}:set-choice`);
  const pool = [...SPIRE_SET_CHOICE_IDS];

  // Fisher–Yates first two draws — guarantees distinctness.
  const first = Math.floor(rng() * pool.length);
  const a = pool.splice(first, 1)[0];
  const second = Math.floor(rng() * pool.length);
  const b = pool.splice(second, 1)[0];

  return [a, b];
}

/**
 * The post-choice symbol bag as WEIGHTS. Starts from the spec base
 * (zero:12, four:5, seven:3, every other SymbolType:0), removes 3 zeros
 * (→ zero:9), and adds each of the chosen set's 3 symbol ids at weight 1.
 *
 * Throws if `chosenSetId` is unknown or is the number set.
 */
export function applySpireSetChoice(chosenSetId: string): Record<SymbolType, number> {
  const set = SYMBOL_SETS_BY_ID[chosenSetId];
  if (!set || set.isNumberSet) {
    throw new Error(`Invalid spire set choice: ${chosenSetId}`);
  }

  // Full Record<SymbolType, number> with 0 defaults for every SymbolType.
  const weights = Object.fromEntries(
    (Object.keys(BASE_WEIGHTS) as SymbolType[]).map((s) => [s, 0]),
  ) as Record<SymbolType, number>;

  // Spec base: NUMBER set, then the choice mutation.
  weights.zero = 12 - 3; // remove 3 zeros → 9
  weights.four = 5;
  weights.seven = 3;

  for (const symbol of set.symbols) {
    weights[symbol.id as SymbolType] = 1;
  }

  return weights;
}

/**
 * The available rule pool once the set is chosen: the basic spire rules plus
 * the number-set and chosen-set rules (deduped, valid ids).
 */
export function spireRulePool(chosenSetId: string): string[] {
  return buildRulePool(['number', chosenSetId], 'spire_basic_temp');
}

/**
 * The deterministic seed-based STARTING board for the run, rolled from the
 * post-choice bag. Not scored; only feeds first-spin rules.
 */
export function spireInitialBoard(seed: string, chosenSetId: string): SymbolType[] {
  return initialBoardFor(`${seed}:spire`, applySpireSetChoice(chosenSetId));
}
