import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { isRuleDraw } from '@/lib/ruleDraw';

describe('isRuleDraw', () => {
  it('7 7 🍒 0 💎 => true', () => {
    const result: SymbolType[] = ['seven', 'seven', 'cherry', 'zero', 'diamond'];
    expect(isRuleDraw(result)).toBe(true);
  });

  it('7 7 🍒 0 4 => false (has four)', () => {
    const result: SymbolType[] = ['seven', 'seven', 'cherry', 'zero', 'four'];
    expect(isRuleDraw(result)).toBe(false);
  });

  it('7 🍒 0 4 7 => false (two sevens but has four)', () => {
    const result: SymbolType[] = ['seven', 'cherry', 'zero', 'four', 'seven'];
    expect(isRuleDraw(result)).toBe(false);
  });

  it('three sevens => false', () => {
    const result: SymbolType[] = ['seven', 'seven', 'seven', 'zero', 'cherry'];
    expect(isRuleDraw(result)).toBe(false);
  });
});
