import { describe, it, expect } from 'vitest';
import { SYMBOL_SETS, SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { RULE_SETS } from '@/lib/rules/sets';
import { buildRulePool } from '@/lib/modes/config';
import { RULES_BY_ID } from '@/data/rules';

describe('SYMBOL_SETS integrity', () => {
  it('has 6 sets, each with exactly 3 symbols', () => {
    expect(SYMBOL_SETS).toHaveLength(6);
    for (const set of SYMBOL_SETS) {
      expect(set.symbols).toHaveLength(3);
    }
  });

  it('has unique, non-empty symbol ids across all sets', () => {
    const ids = SYMBOL_SETS.flatMap((set) => set.symbols.map((s) => s.id));
    for (const id of ids) {
      expect(id).toBeTruthy();
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks only the number set as a number set', () => {
    for (const set of SYMBOL_SETS) {
      if (set.id === 'number') {
        expect(set.isNumberSet).toBe(true);
      } else {
        expect(set.isNumberSet).toBeFalsy();
      }
    }
  });

  it('indexes every set by id', () => {
    for (const set of SYMBOL_SETS) {
      expect(SYMBOL_SETS_BY_ID[set.id]).toBe(set);
    }
  });
});

describe('rule id references', () => {
  it('every ruleId in SYMBOL_SETS exists in RULES_BY_ID', () => {
    for (const set of SYMBOL_SETS) {
      for (const ruleId of set.ruleIds) {
        expect(RULES_BY_ID[ruleId], `symbol set ${set.id} rule ${ruleId}`).toBeDefined();
      }
    }
  });

  it('every ruleId in RULE_SETS exists in RULES_BY_ID', () => {
    for (const ruleSet of RULE_SETS) {
      for (const ruleId of ruleSet.ruleIds) {
        expect(RULES_BY_ID[ruleId], `rule set ${ruleSet.id} rule ${ruleId}`).toBeDefined();
      }
    }
  });
});

describe('buildRulePool', () => {
  it('unions basic + set rules, deduped and all existing', () => {
    const pool = buildRulePool(['number', 'fruit', 'gem'], 'daily_basic_1');

    // deduped
    expect(new Set(pool).size).toBe(pool.length);

    // all existing rule ids
    for (const id of pool) {
      expect(RULES_BY_ID[id], id).toBeDefined();
    }

    // contains a basic rule and set rules from each requested set
    expect(pool).toContain('select-swap'); // daily_basic_1
    expect(pool).toContain('seven-fever'); // number set
    expect(pool).toContain('fruit-surge'); // fruit set
    expect(pool).toContain('gem-surge'); // gem set
  });

  it('preserves first-seen order (rule-set ids first)', () => {
    const pool = buildRulePool(['number'], 'daily_basic_1');
    expect(pool.indexOf('select-swap')).toBeLessThan(pool.indexOf('seven-fever'));
  });

  it('throws on an unknown rule set id', () => {
    expect(() => buildRulePool(['number'], 'nope')).toThrow();
  });

  it('throws on an unknown symbol set id', () => {
    expect(() => buildRulePool(['nope'], 'daily_basic_1')).toThrow();
  });
});
