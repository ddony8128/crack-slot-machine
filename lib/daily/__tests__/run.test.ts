import { describe, it, expect } from 'vitest';
import {
  resolveDailySetup,
  dailyBagWeights,
  dailyRunConfigFromParts,
  dailyRunConfigFromRow,
} from '@/lib/daily/run';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { RULE_SETS_BY_ID } from '@/lib/rules/sets';
import type { DailyChallengeRow } from '@/lib/db/types';
import type { SymbolType } from '@/types';

describe('daily run config (DB-referenced)', () => {
  it('resolveDailySetup gives valid existing sets + a valid basic rule set', () => {
    const s = resolveDailySetup('2026-06-15');
    expect(SYMBOL_SETS_BY_ID[s.groupASetId]).toBeTruthy();
    expect(SYMBOL_SETS_BY_ID[s.groupBSetId]).toBeTruthy();
    expect(s.groupASetId).not.toBe(s.groupBSetId);
    expect(RULE_SETS_BY_ID[s.basicRuleSetId]).toBeTruthy();
  });

  it('dailyBagWeights = number + 2 sets at weight 1, sum 9, others 0', () => {
    const w = dailyBagWeights('fruit', 'gem');
    expect(w.zero).toBe(1);
    expect(w.four).toBe(1);
    expect(w.seven).toBe(1);
    expect(w.cherry).toBe(1);
    expect(w.diamond).toBe(1);
    expect(w.cheese_cat).toBe(0);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBe(9);
  });

  it('dailyRunConfigFromParts → pool run, 7 spins, seed board within the bag', () => {
    const cfg = dailyRunConfigFromParts({
      seed: 'daily-seed-2026-06-15',
      groupASetId: 'fruit',
      groupBSetId: 'gem',
      basicRuleSetId: 'daily_basic_1',
    });
    expect(cfg.provisioning).toBe('pool');
    expect(cfg.maxSpins).toBe(7);
    expect(cfg.initialBoard).toHaveLength(5);
    const allowed = new Set(
      (Object.entries(cfg.baseWeights!) as [SymbolType, number][])
        .filter(([, n]) => n > 0)
        .map(([s]) => s),
    );
    for (const cell of cfg.initialBoard!) expect(allowed.has(cell)).toBe(true);
    // pool contains number rules + the basic set's rules
    expect(cfg.rulePoolIds).toContain('seven-fever');
    expect(cfg.rulePoolIds).toContain('select-swap');
  });

  it('dailyRunConfigFromRow equals fromParts for the same inputs', () => {
    const row: DailyChallengeRow = {
      id: 'd1',
      seasonId: 's1',
      dateKey: '2026-06-15',
      startsAt: '',
      endsAt: '',
      seed: 'daily-seed-2026-06-15',
      groupASetId: 'cat',
      groupBSetId: 'monster',
      config: { basicRuleSetId: 'daily_basic_2' },
      createdAt: '',
    };
    expect(dailyRunConfigFromRow(row)).toEqual(
      dailyRunConfigFromParts({
        seed: row.seed,
        groupASetId: 'cat',
        groupBSetId: 'monster',
        basicRuleSetId: 'daily_basic_2',
      }),
    );
  });
});
