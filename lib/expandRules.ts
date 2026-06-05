import type { Rule } from '@/types';

/**
 * Expand `copy-above` rules into an effective multiset of rule EFFECTS, used by
 * the weight phase (computeWeights) and scoring (scoreResult).
 *
 * A `copy-above` in slot i means "apply the rule directly above (slot i-1) one
 * more time". For weight/score effects, order doesn't matter — we just need the
 * duplicated effect counted again. So we return a list where each active
 * `copy-above` (whose slot above holds an active, non-copy-above rule) is
 * accompanied by a duplicate of that above rule.
 *
 * NOTE: the post-roll cascade (applyRules) handles copy-above itself, in order;
 * it must NOT receive this expanded list (that would double-apply). Only
 * computeWeights and scoreResult use this.
 */
export function expandRules(slots: (Rule | null)[]): (Rule | null)[] {
  const out: (Rule | null)[] = [];
  for (let i = 0; i < slots.length; i++) {
    const rule = slots[i];
    out.push(rule);
    if (rule && rule.id === 'copy-above') {
      const above = i > 0 ? slots[i - 1] : null;
      if (above && above.id !== 'copy-above') {
        out.push(above); // duplicate the above rule's effect
      }
    }
  }
  return out;
}

/** Count active rules (by id) in a list, treating null as absent. */
export function countRule(rules: (Rule | null)[], id: string): number {
  let n = 0;
  for (const r of rules) if (r != null && r.id === id) n += 1;
  return n;
}
