import type { SymbolType } from '@/types';

export type Rng = () => number; // returns [0,1)

export function rollSymbol(weights: Record<SymbolType, number>, rng: Rng): SymbolType {
  const entries = Object.entries(weights) as Array<[SymbolType, number]>;
  const total = entries.reduce((sum, [, w]) => sum + (w > 0 ? w : 0), 0);

  // Fallback: if all weights are non-positive, pick uniformly.
  if (total <= 0) {
    const idx = Math.min(entries.length - 1, Math.floor(rng() * entries.length));
    return entries[idx][0];
  }

  let target = rng() * total;
  for (const [symbol, weight] of entries) {
    if (weight <= 0) continue;
    target -= weight;
    if (target < 0) return symbol;
  }
  // Floating-point safety net: return the last positive-weighted symbol.
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1] > 0) return entries[i][0];
  }
  return entries[entries.length - 1][0];
}

// Roll restricted to `allowed` symbols, using their weights renormalized.
export function rollSymbolFrom(
  allowed: SymbolType[],
  weights: Record<SymbolType, number>,
  rng: Rng,
): SymbolType {
  const restricted: Record<string, number> = {};
  for (const s of allowed) restricted[s] = weights[s];
  return rollSymbol(restricted as Record<SymbolType, number>, rng);
}

export function defaultRng(): number {
  return Math.random();
}
