import { describe, it, expect } from 'vitest';
import {
  pickSpireSetChoices,
  applySpireSetChoice,
  spireRulePool,
  spireInitialBoard,
} from '@/lib/spire/run';
import { RULE_SETS_BY_ID } from '@/lib/rules/sets';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { RULES_BY_ID } from '@/data/rules';

const NON_NUMBER_SETS = ['fruit', 'gem', 'cat', 'vehicle', 'monster'];

describe('pickSpireSetChoices', () => {
  it('is deterministic for a given seed', () => {
    expect(pickSpireSetChoices('seed-123')).toEqual(pickSpireSetChoices('seed-123'));
  });

  it('returns 2 distinct valid non-number set ids', () => {
    for (const seed of ['a', 'b', 'spire-2026', 'xyz', '0000', 'long-seed-value']) {
      const [a, b] = pickSpireSetChoices(seed);
      expect(a).not.toBe(b);
      expect(NON_NUMBER_SETS).toContain(a);
      expect(NON_NUMBER_SETS).toContain(b);
    }
  });

  it('varies across seeds (not a constant pair)', () => {
    const pairs = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => pickSpireSetChoices(s).join(',')),
    );
    expect(pairs.size).toBeGreaterThan(1);
  });
});

describe('applySpireSetChoice', () => {
  it('removes 3 zeros, keeps 4×5 / 7×3, adds the 3 chosen symbols ×1, sum=20', () => {
    for (const setId of NON_NUMBER_SETS) {
      const weights = applySpireSetChoice(setId);
      const set = SYMBOL_SETS_BY_ID[setId];

      expect(weights.zero).toBe(9);
      expect(weights.four).toBe(5);
      expect(weights.seven).toBe(3);

      for (const symbol of set.symbols) {
        expect(weights[symbol.id as keyof typeof weights]).toBe(1);
      }

      const chosenIds = new Set(set.symbols.map((s) => s.id));
      // Every symbol that is not number-set and not chosen must be weight 0.
      for (const [id, w] of Object.entries(weights)) {
        if (['zero', 'four', 'seven'].includes(id) || chosenIds.has(id)) continue;
        expect(w).toBe(0);
      }

      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBe(20);
    }
  });

  it('throws on the number set', () => {
    expect(() => applySpireSetChoice('number')).toThrow();
  });

  it('throws on an unknown set id', () => {
    expect(() => applySpireSetChoice('nope')).toThrow();
    expect(() => applySpireSetChoice('')).toThrow();
  });
});

describe('spireRulePool', () => {
  it('includes the basic spire rules plus the chosen set rules (deduped, valid ids)', () => {
    for (const setId of NON_NUMBER_SETS) {
      const pool = spireRulePool(setId);

      // No duplicates.
      expect(new Set(pool).size).toBe(pool.length);

      // All ids are valid rule ids.
      for (const id of pool) {
        expect(RULES_BY_ID[id]).toBeDefined();
      }

      // Contains every basic rule.
      for (const id of RULE_SETS_BY_ID['spire_basic_temp'].ruleIds) {
        expect(pool).toContain(id);
      }
      // Contains every number-set rule.
      for (const id of SYMBOL_SETS_BY_ID['number'].ruleIds) {
        expect(pool).toContain(id);
      }
      // Contains every chosen-set rule (may be empty for cat/vehicle/monster).
      for (const id of SYMBOL_SETS_BY_ID[setId].ruleIds) {
        expect(pool).toContain(id);
      }
    }
  });
});

describe('spireInitialBoard', () => {
  it('is deterministic for a given seed + chosen set', () => {
    expect(spireInitialBoard('seed-9', 'fruit')).toEqual(spireInitialBoard('seed-9', 'fruit'));
  });

  it('contains only symbols with positive weight in the chosen bag', () => {
    for (const setId of NON_NUMBER_SETS) {
      const weights = applySpireSetChoice(setId);
      const board = spireInitialBoard('board-seed', setId);
      expect(board).toHaveLength(5);
      for (const cell of board) {
        expect(weights[cell]).toBeGreaterThan(0);
      }
    }
  });
});
