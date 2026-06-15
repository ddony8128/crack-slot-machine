/** Season 1 puzzle definitions (scaffolding). Content is code-driven for now;
 *  the puzzle_stages table exists for a future DB-backed editor.
 *
 *  `goal` is a structured, forward-ready spec for an auto-checker that is NOT
 *  yet implemented — clearance verification is a follow-up. `goalText` is the
 *  player-facing description. `spinLimit` and `symbolSets` are authoritative. */

export type PuzzleGoal =
  | { type: 'sevens'; count: number } // ≥count sevens in one result
  | { type: 'clean-score'; score: number } // ≥score with zero 4s
  | { type: 'group-three'; group: 'A' | 'B' } // group 3-types bonus
  | { type: 'all-group'; group: 'A' | 'B' } // all 5 from a group
  | { type: 'two-pair-plus' } // two-pair or better
  | { type: 'next-spin-score'; afterFours: number; score: number }
  | { type: 'zero-special' } // 0×3+ special triggered
  | { type: 'five-of-a-kind' } // five identical non-number symbols
  | { type: 'jackpot' }; // 77777

export type PuzzleDef = {
  key: string;
  index: number;
  title: string;
  goalText: string;
  goal: PuzzleGoal;
  spinLimit: number;
  symbolSets: string[]; // [numberSet, groupA, groupB]
};

export const PUZZLES: PuzzleDef[] = [
  { key: 'p01', index: 1, title: '첫 번째 행운', goalText: '7을 3개 이상 포함한 결과 만들기', goal: { type: 'sevens', count: 3 }, spinLimit: 5, symbolSets: ['number', 'fruit', 'gem'] },
  { key: 'p02', index: 2, title: '깨끗한 손', goalText: '4가 없는 상태로 500점 이상 획득', goal: { type: 'clean-score', score: 500 }, spinLimit: 5, symbolSets: ['number', 'fruit', 'gem'] },
  { key: 'p03', index: 3, title: '세 종류', goalText: 'groupA 3종 보너스 달성', goal: { type: 'group-three', group: 'A' }, spinLimit: 6, symbolSets: ['number', 'horror', 'card'] },
  { key: 'p04', index: 4, title: '또 다른 세 종류', goalText: 'groupB 3종 보너스 달성', goal: { type: 'group-three', group: 'B' }, spinLimit: 6, symbolSets: ['number', 'cat', 'occult'] },
  { key: 'p05', index: 5, title: '완전한 한 쌍', goalText: '투페어 이상 달성', goal: { type: 'two-pair-plus' }, spinLimit: 4, symbolSets: ['number', 'fruit', 'card'] },
  { key: 'p06', index: 6, title: '다섯 칸의 의식', goalText: '올 groupA 또는 올 groupB 달성', goal: { type: 'all-group', group: 'A' }, spinLimit: 8, symbolSets: ['number', 'horror', 'occult'] },
  { key: 'p07', index: 7, title: '불길한 예감', goalText: '4가 4개 이상 나온 뒤 다음 스핀에서 1000점 이상 획득', goal: { type: 'next-spin-score', afterFours: 4, score: 1000 }, spinLimit: 8, symbolSets: ['number', 'gem', 'time'] },
  { key: 'p08', index: 8, title: '영의 상승', goalText: '0이 3개 이상 나오는 특수 족보 발동', goal: { type: 'zero-special' }, spinLimit: 4, symbolSets: ['number', 'cat', 'card'] },
  { key: 'p09', index: 9, title: '파이브카드', goalText: '숫자를 제외한 같은 심볼 5개 만들기', goal: { type: 'five-of-a-kind' }, spinLimit: 8, symbolSets: ['number', 'fruit', 'gem'] },
  { key: 'p10', index: 10, title: '대박', goalText: '77777 달성', goal: { type: 'jackpot' }, spinLimit: 10, symbolSets: ['number', 'horror', 'occult'] },
];

export const PUZZLES_BY_KEY: Record<string, PuzzleDef> = Object.fromEntries(
  PUZZLES.map((p) => [p.key, p]),
);

export const PUZZLE_POINTS_EACH = 100;
