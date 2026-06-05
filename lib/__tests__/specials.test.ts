import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { detectSpecials } from '@/lib/specials';

describe('detectSpecials', () => {
  it('zeros >= 3 => zeroDraw true', () => {
    const r: SymbolType[] = ['zero', 'zero', 'zero', 'cherry', 'four'];
    expect(detectSpecials(r).zeroDraw).toBe(true);
  });

  it('zeros < 3 => zeroDraw false', () => {
    const r: SymbolType[] = ['zero', 'zero', 'cherry', 'cherry', 'four'];
    expect(detectSpecials(r).zeroDraw).toBe(false);
  });

  it('fours == 4 => nextMultiplier 3', () => {
    const r: SymbolType[] = ['four', 'four', 'four', 'four', 'cherry'];
    expect(detectSpecials(r).nextMultiplier).toBe(3);
  });

  it('fours == 5 => nextMultiplier 4', () => {
    const r: SymbolType[] = ['four', 'four', 'four', 'four', 'four'];
    expect(detectSpecials(r).nextMultiplier).toBe(4);
  });

  it('no special multiplier => 1', () => {
    const r: SymbolType[] = ['cherry', 'lemon', 'grape', 'four', 'four'];
    expect(detectSpecials(r).nextMultiplier).toBe(1);
  });
});
