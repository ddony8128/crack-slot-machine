import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { beginCascade } from '@/lib/cascade';
import { scoreResult, scoreItems } from '@/lib/score';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { SHAKEDOWN_PER } from '@/data/scoreTable';
import { COMBO_RULE_SETS, comboRulesForSets } from '@/lib/rules/combos';
import { buildRulePool } from '@/lib/modes/config';
import { rulePlayable } from '@/lib/rules/playable';
import type { Rng } from '@/lib/rng';

function queuedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

const PREV_ZEROS: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];

describe('comboRulesForSets', () => {
  it('number+gem -> ruby-convert and diamond-convert, NOT vandalism', () => {
    const ids = comboRulesForSets(['number', 'gem']);
    expect(ids).toContain('ruby-convert');
    expect(ids).toContain('diamond-convert');
    expect(ids).not.toContain('vandalism');
    expect(ids).not.toContain('shakedown'); // needs monster too
  });

  it('cat+vehicle -> vandalism only', () => {
    expect(comboRulesForSets(['cat', 'vehicle'])).toEqual(['vandalism']);
  });

  it('monster+gem -> shakedown', () => {
    expect(comboRulesForSets(['monster', 'gem'])).toContain('shakedown');
  });

  it('a single set of a combo present -> none', () => {
    expect(comboRulesForSets(['gem'])).toEqual([]);
    expect(comboRulesForSets(['cat'])).toEqual([]);
  });

  it('every combo id exists in RULES_BY_ID', () => {
    for (const id of Object.keys(COMBO_RULE_SETS)) {
      expect(RULES_BY_ID[id]).toBeDefined();
    }
  });
});

describe('buildRulePool — combo rules join only with BOTH sets', () => {
  it('number+gem includes ruby-convert/diamond-convert', () => {
    const pool = buildRulePool(['number', 'gem'], 'general');
    expect(pool).toContain('ruby-convert');
    expect(pool).toContain('diamond-convert');
  });

  it('number alone excludes them', () => {
    const pool = buildRulePool(['number'], 'general');
    expect(pool).not.toContain('ruby-convert');
    expect(pool).not.toContain('diamond-convert');
  });

  it('cat+vehicle includes vandalism', () => {
    expect(buildRulePool(['cat', 'vehicle'], 'general')).toContain('vandalism');
  });
});

describe('rulePlayable — combo rule needs BOTH sets rollable', () => {
  const rubyConvert = RULES_BY_ID['ruby-convert'];

  it('ruby-convert playable under BASE_WEIGHTS (number always rolls, gem rolls)', () => {
    expect(rulePlayable(rubyConvert, BASE_WEIGHTS)).toBe(true);
  });

  it('ruby-convert NOT playable when gems cannot roll (gem weight 0)', () => {
    // A cat-only bag: cats roll, but gem (and everything else) weight 0.
    const catOnly: Record<SymbolType, number> = {
      ...BASE_WEIGHTS,
      diamond: 0,
      ruby: 0,
      sapphire: 0,
      cheese_cat: 1,
      tuxedo_cat: 1,
      calico_cat: 1,
    };
    expect(rulePlayable(rubyConvert, catOnly)).toBe(false);
  });
});

describe('루비 변환 (ruby-convert) — 0/7 become ruby', () => {
  it('cells 0,1 (zero,seven) -> ruby, others untouched', () => {
    const base: SymbolType[] = ['zero', 'seven', 'four', 'cherry', 'ruby'];
    const frame = beginCascade(base, [RULES_BY_ID['ruby-convert']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0]),
    });
    expect(frame.working).toEqual(['ruby', 'ruby', 'four', 'cherry', 'ruby']);
    const transforms = frame.events.filter(
      (e) => e.type === 'symbol_transformed' && e.byRuleId === 'ruby-convert',
    );
    expect(transforms).toEqual([
      { type: 'symbol_transformed', fromSymbolId: 'zero', toSymbolId: 'ruby', index: 0, byRuleId: 'ruby-convert' },
      { type: 'symbol_transformed', fromSymbolId: 'seven', toSymbolId: 'ruby', index: 1, byRuleId: 'ruby-convert' },
    ]);
  });
});

describe('다이아 변환 (diamond-convert) — 4 becomes diamond', () => {
  it('both 4s -> diamond, others untouched', () => {
    const base: SymbolType[] = ['four', 'four', 'seven', 'cherry', 'ruby'];
    const frame = beginCascade(base, [RULES_BY_ID['diamond-convert']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0]),
    });
    expect(frame.working).toEqual(['diamond', 'diamond', 'seven', 'cherry', 'ruby']);
    const transforms = frame.events.filter(
      (e) => e.type === 'symbol_transformed' && e.byRuleId === 'diamond-convert',
    );
    expect(transforms).toHaveLength(2);
  });
});

describe('기물 파손 (vandalism) — reroll vehicles adjacent to a cat', () => {
  it('car(idx1, cat neighbor at 0) rerolled; plane(idx3, zero/seven neighbors) NOT', () => {
    const base: SymbolType[] = ['cheese_cat', 'car', 'zero', 'plane', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['vandalism']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.72]), // -> seven
    });
    expect(frame.working[0]).toBe('cheese_cat');
    expect(frame.working[2]).toBe('zero');
    expect(frame.working[3]).toBe('plane'); // lone vehicle (no cat neighbor) untouched
    expect(frame.working[4]).toBe('seven');
    expect(frame.working[1]).toBe('seven'); // car rerolled

    const rerolls = frame.events.filter(
      (e) => e.type === 'symbol_rerolled' && e.byRuleId === 'vandalism',
    );
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'car', index: 1, byRuleId: 'vandalism' },
    ]);
    expect(frame.steps[frame.steps.length - 1].rerolled).toEqual([1]);
  });
});

describe('금품 갈취 (shakedown) — reroll gems adjacent to a dracula + score', () => {
  it('ruby(idx1, dracula neighbor) rerolled; +70 in bonusScore', () => {
    const base: SymbolType[] = ['dracula', 'ruby', 'zero', 'diamond', 'seven'];
    const frame = beginCascade(base, [RULES_BY_ID['shakedown']], {
      previousResult: PREV_ZEROS,
      weights: BASE_WEIGHTS,
      rng: queuedRng([0.72]), // -> seven
    });
    expect(frame.working[0]).toBe('dracula');
    expect(frame.working[1]).toBe('seven'); // ruby rerolled
    expect(frame.working[3]).toBe('diamond'); // lone gem (no dracula neighbor) untouched

    const rerolls = frame.events.filter(
      (e) => e.type === 'symbol_rerolled' && e.byRuleId === 'shakedown',
    );
    expect(rerolls).toEqual([
      { type: 'symbol_rerolled', symbolId: 'ruby', index: 1, byRuleId: 'shakedown' },
    ]);

    const withEvents = scoreResult(frame.working, [], frame.events);
    const without = scoreResult(frame.working, []);
    expect(withEvents.bonusScore - without.bonusScore).toBe(SHAKEDOWN_PER); // +70

    const items = scoreItems(frame.working, [], frame.events);
    expect(items).toContainEqual({ label: '금품 갈취 (1)', points: SHAKEDOWN_PER });
  });
});
