import type { RunConfig } from '@/store/gameStore';
import { PUZZLES_BY_KEY } from '@/lib/puzzle/config';

/**
 * The RunConfig for a puzzle: fixed start board, fixed rule bag (the player
 * arranges them), and the puzzle's spin limit. Used identically by the client
 * (PuzzleClient) and the server replay so verification matches.
 */
export function puzzleRunConfig(puzzleKey: string): RunConfig {
  const p = PUZZLES_BY_KEY[puzzleKey];
  if (!p) throw new Error(`unknown puzzle: ${puzzleKey}`);
  return {
    initialBoard: [...p.initialBoard],
    maxSpins: p.spinLimit,
    provisioning: 'fixed',
    rulePoolIds: [...p.availableRuleIds],
  };
}
