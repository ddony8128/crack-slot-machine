import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import {
  PAIR_RULES,
  PAIR_RULES_BY_ID,
  pairRulesForSets,
} from '@/lib/pairRules';
import { buildRulePool } from '@/lib/modes/config';
import { scoreResult } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';

// The non-spec 페어 보너스 system (과수원 보석상 / 고양이 택시) was removed. PAIR_RULES is
// now empty; the generic plumbing is kept so a future spec-correct pair rule can
// be re-introduced as pure data. These tests pin that removed state.
describe('PAIR_RULES removed', () => {
  it('PAIR_RULES is empty', () => {
    expect(PAIR_RULES).toEqual([]);
    expect(Object.keys(PAIR_RULES_BY_ID)).toEqual([]);
  });

  it('pairRulesForSets yields nothing for any set combination', () => {
    expect(pairRulesForSets(['number', 'fruit', 'gem'])).toEqual([]);
    expect(pairRulesForSets(['number', 'cat', 'vehicle'])).toEqual([]);
  });

  it('the removed pair rule ids are no longer registered', () => {
    expect(RULES_BY_ID['pair-fruit-gem']).toBeUndefined();
    expect(RULES_BY_ID['pair-cat-vehicle']).toBeUndefined();
  });

  it('no rule in RULES carries the pair build', () => {
    expect(Object.values(RULES_BY_ID).some((r) => r.build === 'pair')).toBe(false);
  });
});

describe('buildRulePool no longer adds pair rules', () => {
  it('does not include the removed pair-fruit-gem when fruit+gem are selected', () => {
    const pool = buildRulePool(['number', 'fruit', 'gem'], 'daily_basic_1');
    expect(pool).not.toContain('pair-fruit-gem');
  });
});

describe('scoring carries no pair bonus', () => {
  it('a fruit + a gem on the board score no extra pair bonus', () => {
    // cherry (fruit) + diamond (gem) present — used to grant +100, now nothing.
    const r: SymbolType[] = ['cherry', 'diamond', 'zero', 'zero', 'four'];
    // bonusScore here reflects only the surviving set bonuses (none for a single
    // fruit + single gem), so it must be 0.
    expect(scoreResult(r, []).bonusScore).toBe(0);
  });
});
