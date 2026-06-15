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

describe('pairRulesForSets', () => {
  it('includes pair-fruit-gem when both fruit and gem are present', () => {
    expect(pairRulesForSets(['number', 'fruit', 'gem'])).toContain('pair-fruit-gem');
  });

  it('includes pair-cat-vehicle when both cat and vehicle are present', () => {
    expect(pairRulesForSets(['number', 'cat', 'vehicle'])).toContain('pair-cat-vehicle');
  });

  it('includes neither when only one set of a pair is present', () => {
    const ids = pairRulesForSets(['number', 'fruit', 'cat']);
    expect(ids).not.toContain('pair-fruit-gem');
    expect(ids).not.toContain('pair-cat-vehicle');
  });

  it('dedupes and ignores duplicate set ids', () => {
    expect(pairRulesForSets(['fruit', 'fruit'])).toEqual([]);
  });
});

describe('buildRulePool', () => {
  it('includes pair-fruit-gem when both sets are selected', () => {
    expect(buildRulePool(['number', 'fruit', 'gem'], 'daily_basic_1')).toContain('pair-fruit-gem');
  });

  it('omits pair-fruit-gem when only fruit is selected', () => {
    expect(buildRulePool(['number', 'fruit'], 'daily_basic_1')).not.toContain('pair-fruit-gem');
  });
});

describe('pair-bonus scoring', () => {
  it('pays +100 when both a fruit AND a gem are on the board', () => {
    // cherry (fruit) + diamond (gem) present
    const r: SymbolType[] = ['cherry', 'diamond', 'zero', 'zero', 'four'];
    const base = scoreResult(r, []);
    const withPair = scoreResult(r, [RULES_BY_ID['pair-fruit-gem']]);
    expect(withPair.bonusScore).toBe(base.bonusScore + 100);
  });

  it('pays +0 when only a fruit (no gem) is on the board', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'zero', 'zero', 'four'];
    const base = scoreResult(r, []);
    const withPair = scoreResult(r, [RULES_BY_ID['pair-fruit-gem']]);
    expect(withPair.bonusScore).toBe(base.bonusScore);
  });

  it('copy-above stacks the pair bonus (×2 => +200)', () => {
    const r: SymbolType[] = ['cherry', 'diamond', 'zero', 'zero', 'four'];
    const base = scoreResult(r, []);
    const dup = scoreResult(r, [RULES_BY_ID['pair-fruit-gem'], RULES_BY_ID['copy-above']]);
    expect(dup.bonusScore).toBe(base.bonusScore + 200);
  });
});

describe('sync with RULES_BY_ID', () => {
  it('every PAIR_RULE id exists in RULES_BY_ID', () => {
    for (const p of PAIR_RULES) {
      expect(RULES_BY_ID[p.id]).toBeDefined();
      expect(RULES_BY_ID[p.id].name).toBe(p.name);
    }
  });

  it('PAIR_RULES_BY_ID covers every pair rule', () => {
    for (const p of PAIR_RULES) {
      expect(PAIR_RULES_BY_ID[p.id]).toBe(p);
    }
  });
});
