import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { scoreResult, scoreItems } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { VITAMIN_PER } from '@/data/scoreTable';

// rng ≈0.72 lands on 'seven' under BASE_WEIGHTS (9 positive-weight symbols).
const sevenRng = () => 0.72;
const ctx = (prev: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero']) => ({
  previousResult: prev,
  weights: BASE_WEIGHTS,
  rng: sevenRng,
});

describe('비타민 보충 (fruit-vitamin)', () => {
  it('rerolls every fruit cell and emits a reroll event per fruit', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'seven', 'grape', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['fruit-vitamin']], ctx());
    const vitEvents = frame.events.filter(
      (e) => e.type === 'symbol_rerolled' && e.byRuleId === 'fruit-vitamin',
    );
    expect(vitEvents).toHaveLength(3); // 3 fruits rerolled
    expect(frame.working[2]).toBe('seven'); // non-fruit untouched
    expect(frame.working[4]).toBe('four');
    // fruit cells were rerolled (to seven under this rng)
    expect(frame.working[0]).toBe('seven');
  });

  it('scores +5 per rerolled fruit (event-based)', () => {
    const base: SymbolType[] = ['cherry', 'lemon', 'seven', 'grape', 'four'];
    const frame = beginCascade(base, [RULES_BY_ID['fruit-vitamin']], ctx());
    const final = frame.working;
    const withEv = scoreResult(final, [RULES_BY_ID['fruit-vitamin']], frame.events);
    const withoutEv = scoreResult(final, [RULES_BY_ID['fruit-vitamin']]);
    expect(withEv.bonusScore - withoutEv.bonusScore).toBe(VITAMIN_PER * 3); // +15
    const items = scoreItems(final, [RULES_BY_ID['fruit-vitamin']], frame.events);
    expect(items).toContainEqual({ label: '비타민 보충 (3과일)', points: 15 });
  });

  it('no fruits → no rerolls, no bonus', () => {
    const base: SymbolType[] = ['seven', 'zero', 'four', 'seven', 'zero'];
    const frame = beginCascade(base, [RULES_BY_ID['fruit-vitamin']], ctx());
    expect(
      frame.events.filter((e) => e.byRuleId === 'fruit-vitamin'),
    ).toHaveLength(0);
    const s = scoreResult(frame.working, [RULES_BY_ID['fruit-vitamin']], frame.events);
    const s0 = scoreResult(frame.working, [RULES_BY_ID['fruit-vitamin']]);
    expect(s.bonusScore).toBe(s0.bonusScore);
  });
});
