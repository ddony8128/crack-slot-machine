/**
 * Config-driven A–B pair rules for RULE SLOT.
 *
 * A pair rule belongs to TWO symbol sets (setA, setB). When present it is
 * included in a run's rule pool only when BOTH sets are present (see
 * buildRulePool).
 *
 * The non-spec 페어 보너스 rules (과수원 보석상 / 고양이 택시) have been removed —
 * the array is intentionally empty. The type + generic plumbing
 * (pairRulesForSets, PAIR_RULES_BY_ID) are kept so importers compile and a future
 * spec-correct pair rule can be re-introduced as pure data.
 */

export type PairRule = {
  id: string;
  name: string;
  setA: string;
  setB: string;
  points: number;
  description: string;
};

export const PAIR_RULES: PairRule[] = [];

export const PAIR_RULES_BY_ID: Record<string, PairRule> = Object.fromEntries(
  PAIR_RULES.map((p) => [p.id, p]),
);

/** Order-independent key for an unordered set pair. */
const key = (a: string, b: string): string => [a, b].sort().join('+');

/** Lookup from unordered set-pair key -> the pair-rule ids that join them. */
export const PAIR_RULE_IDS_BY_SETKEY: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const p of PAIR_RULES) {
    const k = key(p.setA, p.setB);
    (map[k] ??= []).push(p.id);
  }
  return map;
})();

/**
 * The pair-rule ids applicable to a set of symbol sets: for every unordered pair
 * of DISTINCT set ids present, collect any pair rules joining them. Deduped,
 * preserving first-seen order.
 */
export function pairRulesForSets(setIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < setIds.length; i++) {
    for (let j = i + 1; j < setIds.length; j++) {
      if (setIds[i] === setIds[j]) continue;
      const ids = PAIR_RULE_IDS_BY_SETKEY[key(setIds[i], setIds[j])];
      if (!ids) continue;
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
    }
  }
  return out;
}
