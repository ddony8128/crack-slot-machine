import type { SymbolType } from '@/types';
import { createSeededRng } from '@/lib/rng';
import { baseSpin } from '@/lib/spin';

/**
 * The seed-based STARTING board for a season run (the `previousResult` shown
 * before the first spin). Unlike the legacy 00000 start, season modes seed this
 * from the run seed + symbol bag so number→number rules aren't over-powered and
 * the same (seed, weights) always yields the same start.
 *
 * It is NOT scored; it only feeds first-spin rules (locks / previous-result /
 * number-회귀). Deterministic: derived from `${seed}:initial-board`.
 */
export function initialBoardFor(
  seed: string,
  weights: Record<SymbolType, number>,
  n = 5,
): SymbolType[] {
  const rng = createSeededRng(`${seed}:initial-board`);
  return baseSpin(weights, rng, n);
}
