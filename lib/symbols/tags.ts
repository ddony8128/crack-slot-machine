import type { SymbolType } from '@/types';

/**
 * HYBRID symbol tagging (deferred E2 consumer).
 *
 * Base symbols belong to exactly one SYMBOL_SET (their own `symbols[].id`). A
 * HYBRID symbol additionally counts as a member of OTHER sets, listed here by
 * SYMBOL_SET id. This is read ONLY by scoring set-membership (lib/score.ts) so a
 * hybrid contributes to multiple sets' bonuses — it does NOT affect hands
 * (computeHand still counts a hybrid as its own id) or cat/monster RULE targeting
 * (those still use the base CATS/MONSTERS lists in lib/cascade.ts).
 *
 * zombie_cat (좀비고양이) scores as BOTH a cat and a monster.
 */
export const SYMBOL_TAGS: Partial<Record<SymbolType, string[]>> = {
  zombie_cat: ['cat', 'monster'],
};

/**
 * Is `symbol` a member of the given SYMBOL_SET for SCORING purposes?
 *
 * True iff the symbol is one of the set's own `symbols[].id` (base membership)
 * OR SYMBOL_TAGS[symbol] lists this set's id (hybrid membership). Base symbols
 * therefore match only their own set; hybrids match every tagged set.
 */
export function symbolInSet(
  symbol: SymbolType,
  set: { id: string; symbols: { id: string }[] },
): boolean {
  if (set.symbols.some((s) => s.id === symbol)) return true;
  return (SYMBOL_TAGS[symbol] ?? []).includes(set.id);
}
