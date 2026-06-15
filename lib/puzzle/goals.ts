/** Pure goal checker for RULE SLOT puzzles.
 *
 *  No I/O, no randomness, no engine coupling — every function is a pure mapping
 *  from a goal spec + a per-spin GoalContext to a boolean. The puzzle engine
 *  feeds in the board / hand / score it already computed (via lib/score.ts) and
 *  this module decides whether each goal is satisfied. */

import type { SymbolType } from '@/types';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import type { PuzzleGoal } from '@/lib/puzzle/config';

// Hand rank order (ascending). Mirrors the hand names produced by
// lib/score.ts#computeHand. 'No Hand' is the floor.
const HAND_RANK: Record<string, number> = {
  'No Hand': 0,
  Pair: 1,
  'Two Pair': 2,
  Triple: 3,
  'Full House': 4,
  'Four of a Kind': 5,
  'Five of a Kind': 6,
};

/** True when `hand` is at least as strong as `target` in the poker-hand order.
 *  Unknown hand names rank as the floor (0) so an unrecognized actual hand never
 *  spuriously satisfies a real target. */
export function handAtLeast(hand: string, target: string): boolean {
  const have = HAND_RANK[hand] ?? 0;
  const need = HAND_RANK[target] ?? 0;
  return have >= need;
}

export type GoalContext = {
  board: SymbolType[];
  hand: string;
  spinScore: number;
};

/** Evaluate a single goal against a single spin's context. */
export function checkGoal(goal: PuzzleGoal, ctx: GoalContext): boolean {
  switch (goal.type) {
    case 'contains_symbol_count':
      return ctx.board.filter((s) => s === goal.symbolId).length >= goal.count;

    case 'no_symbol':
      return !ctx.board.includes(goal.symbolId);

    case 'hand':
      return handAtLeast(ctx.hand, goal.handType);

    case 'score_at_least':
      return ctx.spinScore >= goal.score;

    case 'set_bonus': {
      const set = SYMBOL_SETS_BY_ID[goal.setId];
      if (!set) return false;
      const memberIds = set.symbols.map((s) => s.id as SymbolType);
      if (goal.bonusType === 'all-types') {
        // every distinct member symbol of the set appears somewhere on the board
        return memberIds.every((id) => ctx.board.includes(id));
      }
      // all-symbols: a full 5-cell board where every cell belongs to the set
      const members = new Set<SymbolType>(memberIds);
      return ctx.board.length === 5 && ctx.board.every((s) => members.has(s));
    }

    case 'exact_board':
      return (
        ctx.board.length === goal.board.length &&
        ctx.board.every((s, i) => s === goal.board[i])
      );

    default: {
      // exhaustiveness guard — a new goal type must be handled above.
      const _never: never = goal;
      return _never;
    }
  }
}

/** Aggregate a full puzzle run: a goal is achieved if ANY spin satisfies it.
 *  Returns the per-goal achievement flags (index-aligned with `goals`) and the
 *  number achieved. With no spins, nothing is achieved. */
export function checkPuzzleRun(
  goals: PuzzleGoal[],
  spins: GoalContext[],
): { achieved: boolean[]; count: number } {
  const achieved = goals.map((goal) => spins.some((ctx) => checkGoal(goal, ctx)));
  const count = achieved.filter(Boolean).length;
  return { achieved, count };
}
