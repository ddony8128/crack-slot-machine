/** Season 1 puzzle definitions. Content is code-driven; the puzzle_stages table
 *  exists for a future DB-backed editor.
 *
 *  `goals` is a structured spec consumed by the pure goal-checker in
 *  `lib/puzzle/goals.ts`. `goalText` is the player-facing description. `spinLimit`,
 *  `seed`, `initialBoard`, `availableRuleIds` and `symbolSets` drive a
 *  deterministic puzzle run. A puzzle is cleared when ALL of its `goals` are
 *  satisfied across its spins (see checkPuzzleRun).
 *
 *  프리 시즌 1 ships EXACTLY two puzzles (p01, p02). Both goals are `exact_board`;
 *  the rule bags are authored, and each `seed` is solver-tuned (see
 *  lib/puzzle/__tests__/solvable.test.ts) so a deterministic player action
 *  sequence clears it within the spin limit — solvable by design, not by luck. */

import type { SymbolType } from '@/types';

export type PuzzleGoal =
  | { type: 'contains_symbol_count'; symbolId: SymbolType; count: number }
  | { type: 'no_symbol'; symbolId: SymbolType }
  | { type: 'hand'; handType: string } // "at least" this hand
  | { type: 'set_bonus'; setId: string; bonusType: 'all-types' | 'all-symbols' }
  | { type: 'score_at_least'; score: number } // a single spin's score
  | { type: 'exact_board'; board: SymbolType[] };

export type PuzzleDef = {
  key: string;
  index: number;
  title: string;
  goalText: string;
  goals: PuzzleGoal[];
  spinLimit: number;
  seed: string;
  initialBoard: SymbolType[];
  availableRuleIds: string[];
  symbolSets: string[]; // [numberSet, groupA, groupB]
};

export const PUZZLES: PuzzleDef[] = [
  // ---- p01: 44444 -> 77777 (numbers only) ----
  {
    key: 'p01',
    index: 1,
    title: '77777 만들기',
    goalText: '44444에서 시작해 7을 5개 만들기',
    goals: [
      { type: 'exact_board', board: ['seven', 'seven', 'seven', 'seven', 'seven'] },
    ],
    spinLimit: 5,
    seed: 'puzzle-77777-1',
    initialBoard: ['four', 'four', 'four', 'four', 'four'],
    availableRuleIds: [
      'zero-to-seven',
      'seven-fever',
      'four-shield',
      'four-parry',
      'last-lock',
      'center-lock',
    ],
    symbolSets: ['number'],
  },
  // ---- p02: 배 5개 -> 체리·포도·체리·포도·체리 (fruit + vehicle) ----
  {
    key: 'p02',
    index: 2,
    title: '체리 포도 체리 포도 체리 만들기',
    goalText: '배 5개에서 시작해 체리·포도·체리·포도·체리 만들기',
    goals: [
      {
        type: 'exact_board',
        board: ['cherry', 'grape', 'cherry', 'grape', 'cherry'],
      },
    ],
    spinLimit: 5,
    seed: 'puzzle-cgcgc-1',
    initialBoard: ['ship', 'ship', 'ship', 'ship', 'ship'],
    availableRuleIds: [
      'vehicle-parking',
      'vehicle-crash',
      'vehicle-logistics',
      'last-lock',
      'first-cherry',
      'fruit-freeze',
      'center-echo',
      'select-swap',
    ],
    symbolSets: ['fruit', 'vehicle'],
  },
];

export const PUZZLES_BY_KEY: Record<string, PuzzleDef> = Object.fromEntries(
  PUZZLES.map((p) => [p.key, p]),
);

export const PUZZLE_POINTS_EACH = 100;
