/**
 * Config-driven A–B pair rules for RULE SLOT.
 *
 * A pair rule belongs to TWO symbol sets (setA, setB). It is included in a run's
 * rule pool only when BOTH sets are present (see buildRulePool), and it pays a
 * conditional bonus at scoring time when the board has ≥1 member of each set
 * (see lib/score.ts).
 *
 * These are DATA: buildRulePool and the scorer consume them generically — there
 * is NO per-pair hardcoding in the engine/score logic. Adding a pair rule here
 * (and registering it in data/rules.ts) is all that's required.
 */

export type PairRule = {
  id: string;
  name: string;
  setA: string;
  setB: string;
  points: number;
  description: string;
};

export const PAIR_RULES: PairRule[] = [
  {
    id: 'pair-fruit-gem',
    name: '과수원 보석상',
    setA: 'fruit',
    setB: 'gem',
    points: 100,
    description: '과일과 보석이 각각 하나 이상 있으면 100점을 더 얻는다.',
  },
  {
    id: 'pair-cat-vehicle',
    name: '고양이 택시',
    setA: 'cat',
    setB: 'vehicle',
    points: 80,
    description: '고양이와 교통수단이 각각 하나 이상 있으면 80점을 더 얻는다.',
  },
];

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
