export type SymbolType =
  | 'cherry' | 'lemon' | 'grape'      // fruits
  | 'diamond' | 'ruby' | 'sapphire'   // gems
  | 'seven' | 'zero' | 'four';

export type RuleType = 'weight' | 'reroll' | 'transform' | 'lock';

export type Rule = {
  id: string;
  name: string;
  description: string;   // short display text (Korean ok)
  type: RuleType;
};

export type SpinLogStep = { label: string; result: SymbolType[] };  // one applied-rule snapshot

export type SpinLog = {
  spinIndex: number;        // 0-based
  baseResult: SymbolType[]; // raw roll before post-roll rules
  steps: SpinLogStep[];     // sequential rule applications (A->B->C)
  finalResult: SymbolType[];
  hand: string;             // hand name e.g. 'Pair', 'JACKPOT', 'No Hand'
  handScore: number;        // positive hand points
  penalty: number;          // positive number representing the 4-penalty magnitude
  roundScore: number;       // handScore - penalty
  ruleDraw: boolean;        // RULE DRAW triggered this spin
};

export type GameStatus =
  | 'start' | 'choosing-rule' | 'choosing-slot'
  | 'ready-to-spin' | 'spinning' | 'spin-result' | 'finished';

export type GameState = {
  nickname: string;
  spinIndex: number;        // 0-based current spin (0..4)
  maxSpins: number;         // 5
  totalScore: number;
  previousResult: SymbolType[];  // last final result (for CENTER LOCK); starts ['zero',...x5]
  currentResult: SymbolType[];
  ruleSlots: Array<Rule | null>; // length 3
  offeredRules: Rule[];
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
