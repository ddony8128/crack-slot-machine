import type { SymbolType } from '@/types';

export function isRuleDraw(result: SymbolType[]): boolean {
  const sevens = result.filter((s) => s === 'seven').length;
  const fours = result.filter((s) => s === 'four').length;
  return sevens === 2 && fours === 0;
}
