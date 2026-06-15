import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { detectSpecials } from '@/lib/specials';
import { spireStageRunConfig } from '@/lib/spire/stage';
import { FOURS_4_MULT, FOURS_5_MULT } from '@/data/scoreTable';

const FOUR4: SymbolType[] = ['four', 'four', 'four', 'four', 'seven'];
const FOUR5: SymbolType[] = ['four', 'four', 'four', 'four', 'four'];
const ZERO3: SymbolType[] = ['zero', 'zero', 'zero', 'seven', 'four'];

describe('detectSpecials gating', () => {
  it('no opts → legacy ON (빠른 게임)', () => {
    expect(detectSpecials(FOUR4).nextMultiplier).toBe(FOURS_4_MULT);
    expect(detectSpecials(FOUR5).nextMultiplier).toBe(FOURS_5_MULT);
    expect(detectSpecials(ZERO3).zeroDraw).toBe(true);
  });

  it('both off → no specials (season default)', () => {
    const off = { four: false, zero: false };
    expect(detectSpecials(FOUR4, off).nextMultiplier).toBe(1);
    expect(detectSpecials(FOUR5, off).nextMultiplier).toBe(1);
    expect(detectSpecials(ZERO3, off).zeroDraw).toBe(false);
  });

  it('four on / zero off → only the 4-multiplier (4 석상)', () => {
    const opts = { four: true, zero: false };
    expect(detectSpecials(FOUR4, opts).nextMultiplier).toBe(FOURS_4_MULT);
    expect(detectSpecials(ZERO3, opts).zeroDraw).toBe(false);
  });

  it('zero on / four off → only the extra-rule draw (0 석상)', () => {
    const opts = { four: false, zero: true };
    expect(detectSpecials(ZERO3, opts).zeroDraw).toBe(true);
    expect(detectSpecials(FOUR4, opts).nextMultiplier).toBe(1);
  });
});

describe('spireStageRunConfig number specials from 석상 artifacts', () => {
  const bag = { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 };
  it('off without 석상 artifacts', () => {
    const cfg = spireStageRunConfig('s', 1, 1, bag, ['select-swap'], undefined, []);
    expect(cfg.numberSpecials).toEqual({ four: false, zero: false });
    expect(cfg.artifacts).toEqual([]);
  });
  it('four-statue enables only the 4 special', () => {
    const cfg = spireStageRunConfig('s', 1, 1, bag, [], undefined, ['four-statue']);
    expect(cfg.numberSpecials).toEqual({ four: true, zero: false });
    expect(cfg.artifacts).toContain('four-statue');
  });
  it('zero-statue enables only the 0 special', () => {
    const cfg = spireStageRunConfig('s', 1, 1, bag, [], undefined, ['zero-statue']);
    expect(cfg.numberSpecials).toEqual({ four: false, zero: true });
  });
});
