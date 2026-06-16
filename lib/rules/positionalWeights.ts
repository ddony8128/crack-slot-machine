import type { SymbolType } from '@/types';
import { CATS, MONSTERS } from '@/data/symbols';

/**
 * Registry for PRE-ROLL weight modifiers that depend on the cell position or the
 * previous spin, so they cannot live in the board-global `computeWeights` vector
 * (which produces a single weight set for the whole board).
 *
 * Each entry is a pure transform `(weights, ctx) => weights`, applied per cell
 * inside `rollBoard`. A position-INDEPENDENT rule (e.g. 백귀야행) simply ignores
 * `ctx.cellIndex`; a position-DEPENDENT rule (e.g. 고양이 확률 증가) keys off it.
 *
 * Adding a positional/prev-state weight rule is now data: register it here +
 * add the Rule def + wire it into its symbol set. No `rollBoard` edits.
 *
 * DETERMINISM CONTRACT: a transform must (1) be pure, (2) NOT consume rng, and
 * (3) be a no-op when its set's symbols carry weight 0 (legacy/quick/event bags),
 * so replay stays byte-identical. Multiplying a 0 weight keeps it 0; transforms
 * here only touch their own set's symbols, so multiple active transforms compose
 * commutatively (disjoint symbol sets).
 */
export type WeightContext = {
  /** Cell being rolled, 0-based. */
  cellIndex: number;
  /** The previous spin's landed board (same length as the board). */
  previousResult: SymbolType[];
};

export type PositionalWeightRule = (
  weights: Record<SymbolType, number>,
  ctx: WeightContext,
) => Record<SymbolType, number>;

export const POSITIONAL_WEIGHT_RULES: Record<string, PositionalWeightRule> = {
  // 고양이 확률 증가: on the odd cells (1-indexed 1st/3rd/5th → 0-based 0/2/4)
  // cat weights are multiplied by 4.
  'cat-odds': (weights, { cellIndex }) => {
    if (cellIndex % 2 !== 0) return weights;
    const out = { ...weights };
    for (const c of CATS) out[c] *= 4;
    return out;
  },

  // 백귀야행: board-global — monster weights are multiplied by
  // (number of monsters on the previous board + 3) for every cell this spin.
  'night-parade': (weights, { previousResult }) => {
    const prevMonsters = previousResult.reduce(
      (n, s) => (MONSTERS.includes(s) ? n + 1 : n),
      0,
    );
    const mult = prevMonsters + 3;
    const out = { ...weights };
    for (const m of MONSTERS) out[m] *= mult;
    return out;
  },
};
