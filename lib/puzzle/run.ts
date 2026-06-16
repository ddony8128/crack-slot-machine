import type { RunConfig } from '@/store/gameStore';
import type { SymbolType } from '@/types';
import { PUZZLES_BY_KEY } from '@/lib/puzzle/config';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { BASE_WEIGHTS } from '@/data/symbols';

/**
 * The symbol bag (as weights) a puzzle rolls: ONLY the symbols belonging to the
 * puzzle's `symbolSets` are rollable (weight 1); everything else is 0. This makes
 * the rollable pool match the spec exactly (e.g. p01 = numbers only {0,4,7};
 * p02 = {cherry,lemon,grape,plane,ship,car}) instead of the legacy BASE_WEIGHTS
 * (which also rolls gems/fruits in every number run). Reconstructed identically
 * on the server replay since it derives purely from the puzzle definition.
 */
function puzzleWeights(symbolSets: string[]): Record<SymbolType, number> {
  const weights: Record<SymbolType, number> = { ...BASE_WEIGHTS };
  for (const id of Object.keys(weights) as SymbolType[]) weights[id] = 0;
  for (const setId of symbolSets) {
    const set = SYMBOL_SETS_BY_ID[setId];
    if (!set) continue;
    for (const s of set.symbols) weights[s.id as SymbolType] = 1;
  }
  return weights;
}

/**
 * The RunConfig for a puzzle: fixed start board, fixed rule bag (the player
 * arranges them), the puzzle's spin limit, and a symbol bag restricted to the
 * puzzle's sets. Used identically by the client (PuzzleClient) and the server
 * replay so verification matches.
 */
export function puzzleRunConfig(puzzleKey: string): RunConfig {
  const p = PUZZLES_BY_KEY[puzzleKey];
  if (!p) throw new Error(`unknown puzzle: ${puzzleKey}`);
  return {
    initialBoard: [...p.initialBoard],
    maxSpins: p.spinLimit,
    baseWeights: puzzleWeights(p.symbolSets),
    provisioning: 'fixed',
    rulePoolIds: [...p.availableRuleIds],
    // Number special hands are 빠른 게임-only.
    numberSpecials: { four: false, zero: false },
    positionalCleanSweep: true,
    // Immediate-clear: the store ends the run the instant these goals are all met.
    // Carried here so the SERVER replay (which reconstructs the run from this same
    // config) ends at the identical spin → byte-identical client/server results.
    puzzleGoals: p.goals,
  };
}
