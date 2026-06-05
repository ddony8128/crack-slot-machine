export type SymbolType =
  | 'cherry' | 'lemon' | 'grape'      // fruits
  | 'diamond' | 'ruby' | 'sapphire'   // gems
  | 'seven' | 'zero' | 'four';

export type RuleType = 'weight' | 'reroll' | 'transform' | 'lock' | 'score' | 'meta';

export type Rule = {
  id: string;
  name: string;
  description: string;   // short display text (Korean ok)
  type: RuleType;
  build?: string;        // build tag (e.g. '7', 'fruit', 'gem', 'order', 'safe')
};

export type SpinLogStep = {
  label: string;
  result: SymbolType[];   // board snapshot after this rule
  locked: boolean[];      // cells frozen by a lock rule so far (for the greyed-out reveal)
};

export type SpinLog = {
  spinIndex: number;        // 0-based
  baseResult: SymbolType[]; // raw roll before post-roll rules
  steps: SpinLogStep[];     // sequential rule applications (A->B->C)
  finalResult: SymbolType[];
  hand: string;             // hand name e.g. 'Pair', 'No Hand'
  handScore: number;        // positive hand points
  sevenScore: number;       // points from sevens
  bonusScore: number;       // color/type + score-rule bonuses
  penalty: number;          // positive number representing the 4-penalty magnitude
  baseRoundScore: number;   // sevenScore + handScore + bonusScore - penalty
  multiplier: number;       // multiplier applied this spin
  roundScore: number;       // baseRoundScore * multiplier
  zeroDraw: boolean;        // zeros>=3 triggered extra rule pick
  multiplierSet: number;    // multiplier granted to next spin (1 if none)
  lockedCells: boolean[];   // final cells frozen by lock rules (greyed in UI)
};

export type GameStatus =
  | 'start' | 'choosing-rule' | 'placing'
  | 'ready-to-spin' | 'spinning' | 'spin-result' | 'finished';

export type GameState = {
  nickname: string;
  spinIndex: number;        // 0-based, 0..6; == maxSpins when finished
  maxSpins: number;         // 7
  totalScore: number;
  nextMultiplier: number;   // applied to NEXT spin's score (default 1)
  previousResult: SymbolType[];  // last final result; starts ['zero',...x5]
  currentResult: SymbolType[];
  ruleSlots: Array<Rule | null>; // length 5, applied top->bottom
  bag: Rule[];                   // inactive holding area
  offeredRules: Rule[];          // 3
  pendingRule: Rule | null;      // chosen card not yet placed
  extraRulePickCount: number;
  spinLogs: SpinLog[];
  status: GameStatus;
};

export type RankingRecord = {
  id: string;
  nickname: string;
  score: number;
  createdAt: string;
  bestSpinScore: number;
  finalRules: string[];
};
