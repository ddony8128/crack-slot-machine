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

/**
 * Hash an arbitrary string into a 32-bit seed (cyrb128, first word). Deterministic
 * and platform-independent, so the same seed string yields the same numbers on
 * the client and on the Node server during replay verification.
 */
function cyrb128(str: string): number {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

/**
 * Deterministic seeded PRNG (mulberry32) producing values in [0,1). Given the
 * same `seed` string it always yields the same sequence — the basis for the
 * server replaying a run from its seed + recorded actions and getting the exact
 * same boards and score the client computed.
 *
 * Use this for ALL game-result randomness. Keep `defaultRng` (Math.random) for
 * result-independent cosmetics (presentation jitter, sound variation) only.
 */
export function createSeededRng(seed: string): Rng {
  let state = cyrb128(seed) >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
