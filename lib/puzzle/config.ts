/** Season 1 puzzle definitions (scaffolding). Content is code-driven for now;
 *  the puzzle_stages table exists for a future DB-backed editor.
 *
 *  `goals` is a structured, forward-ready spec consumed by the pure goal-checker
 *  in `lib/puzzle/goals.ts`. `goalText` is the player-facing description.
 *  `spinLimit`, `seed`, `initialBoard`, `availableRuleIds` and `symbolSets` drive
 *  a (future) deterministic puzzle run. A puzzle is cleared when ALL of its
 *  `goals` are satisfied across its spins (see checkPuzzleRun).
 *
 *  NOTE: p03..p10 below carry placeholder `seed` / `initialBoard` /
 *  `availableRuleIds` values that still need PLAYTEST TUNING — they are plausible
 *  but unverified. p01 and p02 are the canonical, fully-specified examples. */

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
  // ---- p01: canonical, fully specified ----
  {
    key: 'p01',
    index: 1,
    title: '첫 번째 행운',
    goalText: '7을 3개 이상 포함한 결과 만들기',
    goals: [{ type: 'contains_symbol_count', symbolId: 'seven', count: 3 }],
    spinLimit: 5,
    seed: 'puzzle-p01',
    initialBoard: ['zero', 'four', 'seven', 'cherry', 'ruby'],
    availableRuleIds: ['select-reroll', 'select-swap', 'seven-fever', 'zero-to-seven'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  // ---- p02: canonical, fully specified ----
  {
    key: 'p02',
    index: 2,
    title: '깨끗한 손',
    goalText: '4가 없는 상태로 500점 이상 획득',
    goals: [
      { type: 'no_symbol', symbolId: 'four' },
      { type: 'score_at_least', score: 500 },
    ],
    spinLimit: 5,
    seed: 'puzzle-p02',
    initialBoard: ['four', 'zero', 'cherry', 'lemon', 'seven'],
    availableRuleIds: ['four-shield', 'select-reroll', 'clean-bonus', 'fruit-surge'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  // ---- p03..p10: seeds / boards / rule ids need PLAYTEST TUNING ----
  {
    key: 'p03',
    index: 3,
    title: '세 종류',
    goalText: '과일 3종 보너스 달성',
    goals: [{ type: 'set_bonus', setId: 'fruit', bonusType: 'all-types' }],
    spinLimit: 6,
    seed: 'puzzle-p03',
    initialBoard: ['cherry', 'lemon', 'zero', 'seven', 'four'],
    availableRuleIds: ['fruit-surge', 'select-reroll', 'select-swap', 'fruit-fish'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  {
    key: 'p04',
    index: 4,
    title: '또 다른 세 종류',
    goalText: '보석 3종 보너스 달성',
    goals: [{ type: 'set_bonus', setId: 'gem', bonusType: 'all-types' }],
    spinLimit: 6,
    seed: 'puzzle-p04',
    initialBoard: ['diamond', 'ruby', 'zero', 'seven', 'four'],
    availableRuleIds: ['gem-surge', 'select-reroll', 'select-swap', 'gem-fish'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  {
    key: 'p05',
    index: 5,
    title: '완전한 한 쌍',
    goalText: '투페어 이상 달성',
    goals: [{ type: 'hand', handType: 'Two Pair' }],
    spinLimit: 4,
    seed: 'puzzle-p05',
    initialBoard: ['cherry', 'cherry', 'lemon', 'lemon', 'seven'],
    availableRuleIds: ['fruit-surge', 'select-copy', 'select-swap', 'first-cherry'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  {
    key: 'p06',
    index: 6,
    title: '다섯 칸의 의식',
    goalText: '올 과일 또는 올 보석 달성',
    goals: [{ type: 'set_bonus', setId: 'fruit', bonusType: 'all-symbols' }],
    spinLimit: 8,
    seed: 'puzzle-p06',
    initialBoard: ['cherry', 'lemon', 'grape', 'zero', 'four'],
    availableRuleIds: ['fruit-surge', 'fruit-fish', 'select-reroll', 'first-cherry'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  {
    key: 'p07',
    index: 7,
    title: '불길한 예감',
    goalText: '4가 없는 상태로 1000점 이상 획득',
    goals: [
      { type: 'no_symbol', symbolId: 'four' },
      { type: 'score_at_least', score: 1000 },
    ],
    spinLimit: 8,
    seed: 'puzzle-p07',
    initialBoard: ['four', 'four', 'seven', 'diamond', 'zero'],
    availableRuleIds: ['four-shield', 'clean-bonus', 'gem-surge', 'select-reroll'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  {
    key: 'p08',
    index: 8,
    title: '영의 상승',
    goalText: '0을 3개 이상 포함한 결과 만들기',
    goals: [{ type: 'contains_symbol_count', symbolId: 'zero', count: 3 }],
    spinLimit: 4,
    seed: 'puzzle-p08',
    initialBoard: ['zero', 'zero', 'seven', 'cherry', 'four'],
    availableRuleIds: ['select-reroll', 'select-copy', 'four-shield', 'seven-fever'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  {
    key: 'p09',
    index: 9,
    title: '파이브카드',
    goalText: '숫자를 제외한 같은 심볼 5개 만들기',
    goals: [{ type: 'hand', handType: 'Five of a Kind' }],
    spinLimit: 8,
    seed: 'puzzle-p09',
    initialBoard: ['cherry', 'cherry', 'cherry', 'lemon', 'seven'],
    availableRuleIds: ['fruit-surge', 'first-cherry', 'select-copy', 'select-reroll'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
  {
    key: 'p10',
    index: 10,
    title: '대박',
    goalText: '77777 달성',
    goals: [{ type: 'contains_symbol_count', symbolId: 'seven', count: 5 }],
    spinLimit: 10,
    seed: 'puzzle-p10',
    initialBoard: ['seven', 'seven', 'seven', 'zero', 'zero'],
    availableRuleIds: ['seven-fever', 'zero-to-seven', 'select-reroll', 'select-copy'],
    symbolSets: ['number', 'fruit', 'gem'],
  },
];

export const PUZZLES_BY_KEY: Record<string, PuzzleDef> = Object.fromEntries(
  PUZZLES.map((p) => [p.key, p]),
);

export const PUZZLE_POINTS_EACH = 100;
