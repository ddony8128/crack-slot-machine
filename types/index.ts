export type SymbolType =
  | 'cherry' | 'lemon' | 'grape'      // fruits
  | 'diamond' | 'ruby' | 'sapphire'   // gems
  | 'seven' | 'zero' | 'four'         // numbers
  // Season 1 sets (ADDITIVE). Default weight 0 in BASE_WEIGHTS so legacy/quick/
  // event play never rolls them; they only appear when a mode's bag includes them.
  | 'cheese_cat' | 'tuxedo_cat' | 'calico_cat'   // cats
  | 'plane' | 'ship' | 'car'                       // vehicles
  | 'dracula' | 'zombie' | 'ghost'                 // monsters
  // hybrids: score as members of MULTIPLE sets via SYMBOL_TAGS (lib/symbols/tags.ts).
  // zombie_cat (좀비고양이) / ghost_cat (유령고양이) count as BOTH a cat and a
  // monster for set bonuses.
  | 'zombie_cat' | 'ghost_cat';                    // hybrids

export type RuleType = 'weight' | 'reroll' | 'transform' | 'lock' | 'score' | 'meta' | 'select';

// When a rule takes effect during a spin's resolution. 'pre-spin' rules bias the
// roll before symbols land; 'sequential' rules mutate the board in slot order;
// 'scoring' rules fire while points are tallied; 'next-spin' is reserved for
// effects that carry into the following spin (none yet).
export type RulePhase = 'pre-spin' | 'sequential' | 'scoring' | 'next-spin';

export type Rule = {
  id: string;
  name: string;
  description: string;   // short display text (Korean ok)
  type: RuleType;
  phase: RulePhase;      // when the rule takes effect during resolution
  build?: string;        // build tag (e.g. '7', 'fruit', 'gem', 'order', 'safe')
};

export type SpinLogStep = {
  label: string;
  result: SymbolType[];   // board snapshot after this rule
  locked: boolean[];      // cells frozen by a lock rule so far (for the greyed-out reveal)
  // Cells given a FRESH RANDOM ROLL by this step (four-shield, four-parry,
  // gem-shuffle, fruit/gem-fish, SELECT REROLL). The reveal must animate these
  // even when the value repeats (e.g. a 4 rerolled into another 4), otherwise a
  // same-value reroll looks like the cell never spun. Absent for non-reroll steps.
  rerolled?: number[];
};

// One line of the score breakdown ("why you got these points"). points can be negative.
export type ScoreItem = { label: string; points: number };

/**
 * An ADDITIVE per-spin engine event describing a single symbol change the cascade
 * made (reroll/move/copy/transform/lock). Emitted by the cascade and aggregated on
 * the SpinLog so later SET-scoring (vehicle/monster/cat) can read what happened to
 * each cell. These NEVER affect the board, score, reveal, or replay — read-only data.
 */
export type EngineEvent =
  | { type: 'symbol_rerolled'; symbolId: SymbolType; index: number; byRuleId: string }
  | { type: 'symbol_moved'; symbolId: SymbolType; fromIndex: number; toIndex: number; byRuleId: string }
  | { type: 'symbol_copied'; symbolId: SymbolType; fromIndex: number; toIndex: number; byRuleId: string }
  | { type: 'symbol_transformed'; fromSymbolId: SymbolType; toSymbolId: SymbolType; index: number; byRuleId: string }
  | { type: 'symbol_locked'; symbolId: SymbolType; index: number; byRuleId: string }
  // A cell flagged to HOLD into the next spin (유료 주차 / vehicle-parking). The
  // points loss is scored EVENT-based: one symbol_held per chosen vehicle cell.
  | { type: 'symbol_held'; symbolId: SymbolType; index: number; byRuleId: string }
  // A cell's "haunted" status was ADDED or REMOVED by a rule this spin. Read-only
  // data: the authoritative haunted state lives on the cascade frame; these events
  // let later EVENT-based scoring (e.g. 흡혈귀 퇴마사) count haunt removals.
  | { type: 'cell_status_added'; status: 'haunted'; index: number; byRuleId: string }
  | { type: 'cell_status_removed'; status: 'haunted'; index: number; byRuleId: string };

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
  scoreItems: ScoreItem[];  // itemized "why these points" breakdown (pre-multiplier)
  interactive: boolean;     // true if a `select` rule actually resolved this spin
  // ADDITIVE engine event log for the whole spin (every symbol reroll/move/copy/
  // transform/lock, in application order). Read-only data for later set-scoring;
  // does NOT affect board/score/reveal/replay.
  events: EngineEvent[];
  // Per-cell "haunted" flags (length 5) for THIS spin. A haunted cell added one
  // phantom 'ghost' to the hand scoring (E1-lite, set by RULE SLOT monster-haunt).
  // Surfaced to the UI so the player can see a 👻 indicator on haunted cells.
  haunted: boolean[];
};

export type SelectKind = 'copy' | 'swap' | 'reroll' | 'family' | 'park' | 'catswap';

// A `select` rule that paused the cascade for player input.
export type PendingSelection = {
  kind: SelectKind;
  ruleName: string;
  // Cells the player must pick: copy/reroll/family=1, swap=2, park=min(2, #vehicles).
  count: number;
  selectable: boolean[];   // which cells the player may pick (length 5)
};

export type GameStatus =
  | 'start' | 'choosing-rule' | 'placing'
  | 'ready-to-spin' | 'spinning' | 'spin-result' | 'finished'
  | 'awaiting-selection';

/**
 * The incremental reveal feed the UI animates from. Unlike a completed SpinLog,
 * this is updated DURING resolution: `steps` grows as auto rules run and as the
 * player resolves each `select` rule, so the reveal can play once and pause at
 * each selection without ever replaying.
 *
 * `id` increments per spin so the reveal hook can distinguish a brand-new spin
 * (new id → roll from scratch) from "same spin, more steps arrived" (same id →
 * continue animating the appended steps with no re-roll).
 */
export type RevealStream = {
  id: number;
  baseResult: SymbolType[];
  steps: SpinLogStep[];
  done: boolean;
};

export type GameState = {
  nickname: string;
  // Server-issued run identity for score submission (null until a run starts).
  runId: string | null;
  eventSlug: string | null;
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
  // Extra rule picks OWED to the next turn (accumulated from zeros>=3 specials).
  extraRulePickCount: number;
  // Rule placements remaining in the CURRENT choosing phase before the spin is
  // allowed. 1 on a normal turn; >1 when a zero-draw bonus added picks.
  picksLeft: number;
  spinLogs: SpinLog[];
  status: GameStatus;
  pendingSelection: PendingSelection | null; // set while status === 'awaiting-selection'
  // Incremental reveal feed for the UI; null when idle. Updated as the cascade
  // progresses (spin → selectCells → finalize) so the reveal plays once.
  revealStream: RevealStream | null;
  // Cells to HOLD at the start of the NEXT spin's first roll (default []). A
  // next-spin rule (e.g. 유료 주차 / vehicle-parking) populates this from the
  // FINAL board of the spin that produced it; the next spin() feeds it as
  // beginCascade's preHeld pass (held cells = previousResult, then locked).
  // PURE ENGINE STATE: carried/consumed entirely via the cascade frame, so
  // replay reproduces it byte-for-byte. A held cell may still be overwritten by
  // a later rule that spin (held = first-roll only). REPLACED each spin: a spin
  // with no parking rule yields frame.nextHold [] → this clears.
  nextHoldCells: number[];
  // Puzzle runs ONLY: true once every puzzle goal is met across the resolved
  // spins. The cleared spin still ends in 'spin-result' (so its reveal plays and
  // the board settles); the puzzle UI then shows 클리어 + a 결과 보기 action that
  // advances to 'finished'. Always false in quick/daily/spire.
  puzzleCleared: boolean;
  // 첨탑 stage runs ONLY (RunConfig.stageTarget set): true once the cumulative
  // stage score meets the target. Like puzzleCleared, the clearing spin still
  // ends in 'spin-result' (reveal plays); the result button then advances to
  // 'finished' so SpireClient can show the settlement. Always false otherwise.
  stageCleared: boolean;
};
