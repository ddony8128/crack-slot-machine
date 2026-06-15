import { describe, it, expect } from 'vitest';
import { RULES, RULES_BY_ID, RULE_PHASE_LABELS } from '@/data/rules';
import type { RulePhase } from '@/types';

const VALID_PHASES: RulePhase[] = [
  'pre-spin',
  'sequential',
  'scoring',
  'next-spin',
];

describe('rule phase (발동 시점)', () => {
  it('every rule has a phase that is one of the 4 valid values', () => {
    for (const rule of RULES) {
      expect(VALID_PHASES, `${rule.id} has an invalid phase`).toContain(
        rule.phase,
      );
    }
  });

  it('spot-checks the documented id -> phase mapping', () => {
    expect(RULES_BY_ID['seven-fever'].phase).toBe('pre-spin');
    expect(RULES_BY_ID['clean-bonus'].phase).toBe('sequential');
    expect(RULES_BY_ID['four-fortune'].phase).toBe('scoring');
    expect(RULES_BY_ID['select-swap'].phase).toBe('sequential');
  });
});

describe('RULE_PHASE_LABELS', () => {
  it('has all 4 phase keys', () => {
    expect(Object.keys(RULE_PHASE_LABELS).sort()).toEqual(
      [...VALID_PHASES].sort(),
    );
  });

  it('provides a non-empty label for every valid phase', () => {
    for (const phase of VALID_PHASES) {
      expect(RULE_PHASE_LABELS[phase]).toBeTruthy();
    }
  });
});

describe('four-fortune wording', () => {
  it('clarifies the 4-penalty is replaced ("감점 대신")', () => {
    expect(RULES_BY_ID['four-fortune'].description).toContain('감점 대신');
  });
});
