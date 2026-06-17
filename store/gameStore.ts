import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameState, Rule, SpinLog, SymbolType } from '@/types';
import { createSeededRng, defaultRng, type Rng } from '@/lib/rng';
import { rollBoard, computeWeights } from '@/lib/spin';
import {
  beginCascade,
  resolveSelection,
  type ApplyCtx,
  type CascadeFrame,
} from '@/lib/cascade';
import { scoreResult, scoreItems, type HandUpgradeMap } from '@/lib/score';
import { detectSpecials } from '@/lib/specials';
import { rulePlayable } from '@/lib/rules/playable';
import { RULES, RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS, CATS } from '@/data/symbols';
import type { PuzzleGoal } from '@/lib/puzzle/config';
import { checkPuzzleRun, type GoalContext } from '@/lib/puzzle/goals';
import { computeHand } from '@/lib/score';

const MAX_SPINS = 7;
const SLOT_COUNT = 5;
const OFFER_COUNT = 3;
const ZERO_RESULT: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];

export type PlaceTarget = { type: 'slot'; index: number } | { type: 'bag' };
export type RuleLocation = { zone: 'slot'; index: number } | { zone: 'bag'; index: number };

/**
 * How a run provisions rules each turn:
 *  - 'offer'  : random 3-card offers from the full rule pool (default; event/daily/quick).
 *  - 'pool'   : random 3-card offers drawn only from `rulePoolIds` (season modes).
 *  - 'fixed'  : NO offers — `rulePoolIds` are pre-loaded into the bag and the player
 *               arranges them into slots (puzzle). Turns go straight to ready-to-spin.
 */
export type RunProvisioning = 'offer' | 'pool' | 'fixed';

/**
 * Optional per-run configuration for season modes. All fields default to the
 * legacy behavior, so a run with no config (event/daily/quick) is unchanged.
 * MUST be reconstructable server-side so replay/verify can apply the same config.
 */
export type RunConfig = {
  initialBoard?: SymbolType[];             // previousResult before the first spin
  maxSpins?: number;
  baseWeights?: Record<SymbolType, number>; // the run's symbol bag (as weights)
  provisioning?: RunProvisioning;
  rulePoolIds?: string[];
  // 첨탑 per-hand upgrades, applied to every spin's hand score (other modes
  // leave this unset → scoring is unchanged).
  handUpgrades?: HandUpgradeMap;
  // 첨탑 owned artifacts — flow into scoring (lib/score) for artifact effects.
  artifacts?: string[];
  // Number special hands (4×4/4×5 multiplier, 0≥3 extra rule). Unset → ON
  // (빠른 게임/legacy); season modes pass {four:false, zero:false}.
  numberSpecials?: { four: boolean; zero: boolean };
  // CLEAN SWEEP scoring: position-aware (at the rule's moment) when true; the
  // legacy final-board reading when unset (빠른 게임/이벤트). Season modes set true.
  positionalCleanSweep?: boolean;
  // Puzzle goals: when set (puzzle runs ONLY), the run ENDS IMMEDIATELY (status
  // 'finished') as soon as every goal is met across the resolved spins, rather
  // than waiting for maxSpins. quick/daily/spire leave this unset → unchanged.
  // Reconstructed identically server-side (puzzleRunConfig), so client + replay
  // end the run at the same spin from seed + actions.
  puzzleGoals?: PuzzleGoal[];
};

/**
 * A serializable log of every outcome-affecting action the player took, in order.
 * Replaying these against a fresh store seeded with the same rng reproduces the
 * exact same boards and score — the basis for server-side anti-cheat
 * verification. cancelSelection is intentionally NOT recorded: only the last
 * selectRule before a placePending matters, and each recorded selectRule
 * overwrites pendingRule, so replay is faithful without it.
 */
export type RecordedAction =
  | { type: 'selectRule'; ruleId: string }
  | { type: 'cancelSelection' }
  | { type: 'placePending'; target: PlaceTarget }
  | { type: 'moveRule'; from: RuleLocation; to: RuleLocation }
  | { type: 'spin' }
  | { type: 'selectCells'; indices: number[] }
  | { type: 'next' };

export type GameActions = {
  setNickname: (name: string) => void;
  /**
   * Bind this store to a server-issued run: re-seed the rng with `seed` and
   * record runId/slug so the finished run can be submitted. Must be called
   * before startGame() so the offered rules + rolls match the server's replay.
   */
  beginRun: (seed: string, runId: string, slug: string) => void;
  /**
   * Set (or clear with null) the run config used by the NEXT startGame(). Call
   * after beginRun() and before startGame(). Server replay calls this too so the
   * reconstructed run matches. No-config runs behave exactly as before.
   */
  configureRun: (config: RunConfig | null) => void;
  startGame: () => void;
  selectRule: (rule: Rule) => void;
  cancelSelection: () => void;
  placePending: (target: PlaceTarget) => void;
  moveRule: (from: RuleLocation, to: RuleLocation) => void;
  spin: () => void;
  selectCells: (indices: number[]) => void;
  next: () => void;
  reset: () => void;
  /** The ordered action log for this run (for replay / score submission). */
  getActions: () => RecordedAction[];
};

/**
 * The store exposes the active run's RunConfig as read-only state (null for
 * legacy 빠른 게임/이벤트). It mirrors the private `runConfig` closure so UI
 * (StatusBar's pool-aware ReferenceModal) can read the run's baseWeights without
 * threading props through GameScreen. It does NOT affect engine state/replay —
 * the closure `runConfig` remains the single source of truth for resolution.
 */
export type GameStore = GameState & GameActions & { runConfig: RunConfig | null };

/**
 * Fisher-Yates shuffle driven by the injected rng (not Math.random).
 * Returns a new array; does not mutate the input.
 */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const k = Math.min(j, i); // safety: rng() could theoretically return ~1
    [out[i], out[k]] = [out[k], out[i]];
  }
  return out;
}

/**
 * Builds that are NEVER offered in the 'offer' (legacy 빠른 게임/이벤트) path.
 * combo (red-dye/blue-dye/ruby-convert/diamond-convert/…) and pair
 * (pair-fruit-gem/…) rules are season-1 multi-set mechanics: even though their
 * fruit/gem requirements pass rulePlayable on the legacy bag, 기획 keeps quick on
 * the original number/fruit/gem rule set only. Season modes use 'pool'/'fixed'
 * with explicit rulePoolIds, so this exclusion does not touch them.
 */
export const LEGACY_EXCLUDED_BUILDS = new Set<string>(['combo', 'pair']);

/**
 * Offer `count` distinct rules (by id) that are NOT currently in a slot OR the
 * bag. Shuffles the allowed pool with the injected rng and takes the first
 * `count`. With 26 rules this never starves a 3- (or 4-) card offer.
 *
 * `count` defaults to OFFER_COUNT; the swiss-knife (맥가이버 칼) artifact bumps it
 * to 4 (passed via offerCount() at each call site). Config-driven → replays
 * identically.
 *
 * When `excludeLegacyBuilds` is true (the 'offer' provisioning path), combo/pair
 * rules are dropped IN ADDITION to the rulePlayable filter — see
 * LEGACY_EXCLUDED_BUILDS. Season pools ('pool'/'fixed') pass false so their
 * curated rulePoolIds are unchanged.
 */
function offerRules(
  rng: Rng,
  slots: Array<Rule | null>,
  bag: Rule[],
  pool: Rule[] = RULES,
  count: number = OFFER_COUNT,
  weights: Record<SymbolType, number> = BASE_WEIGHTS,
  excludeLegacyBuilds = false,
): Rule[] {
  const usedIds = new Set<string>();
  for (const r of slots) if (r != null) usedIds.add(r.id);
  for (const r of bag) usedIds.add(r.id);
  // Only offer rules whose symbols can actually roll in this run's bag — keeps
  // cat/vehicle/monster rules out of 빠른 게임/이벤트 offers (their bag rolls
  // none), while season pools (already curated to the run's sets) are unchanged.
  const allowed = pool.filter(
    (r) =>
      !usedIds.has(r.id) &&
      rulePlayable(r, weights) &&
      !(excludeLegacyBuilds && LEGACY_EXCLUDED_BUILDS.has(r.build ?? '')),
  );
  return shuffle(allowed, rng).slice(0, count);
}

/** Resolve a rule-id list to Rule objects (skips unknown ids). */
function rulesFromIds(ids: string[]): Rule[] {
  return ids.map((id) => RULES_BY_ID[id]).filter((r): r is Rule => r != null);
}

function emptySlots(): Array<Rule | null> {
  return [null, null, null, null, null];
}

/**
 * bean-blessing (콩의 가호): the second rule slot (index 1) is applied ONE MORE
 * TIME each spin. Implemented as a derived, transient "effective slots" list that
 * duplicates slot 1 right after itself — so the cascade, the interactive select
 * path, AND scoring all see the SAME 6-element list and reuse every existing
 * mechanism (no new cascade branches, no recursion: the artifact isn't a rule).
 *
 * Pure + config-driven: it reads only `artifacts` (reconstructed identically in
 * replay) and the slot contents, so it adds no randomness and replays byte-for-
 * byte. A no-op when the artifact is absent OR slot 1 is empty — which is why all
 * existing tests + replayFuzz (no artifacts) are unchanged. `state.ruleSlots`
 * stays the 5-slot array for UI/placement/moveRule; this is used only for spin
 * resolution + scoring of that spin.
 */
export function effectiveSlots(
  ruleSlots: (Rule | null)[],
  artifacts?: string[],
): (Rule | null)[] {
  if (artifacts?.includes('bean-blessing') && ruleSlots[1] != null) {
    return [
      ruleSlots[0],
      ruleSlots[1],
      ruleSlots[1],
      ruleSlots[2],
      ruleSlots[3],
      ruleSlots[4],
    ];
  }
  return ruleSlots;
}

function freshState(nickname: string): GameState {
  return {
    nickname,
    runId: null,
    eventSlug: null,
    spinIndex: 0,
    maxSpins: MAX_SPINS,
    totalScore: 0,
    nextMultiplier: 1,
    previousResult: [...ZERO_RESULT],
    currentResult: [...ZERO_RESULT],
    ruleSlots: emptySlots(),
    bag: [],
    offeredRules: [],
    pendingRule: null,
    extraRulePickCount: 0,
    picksLeft: 0,
    spinLogs: [],
    status: 'start',
    pendingSelection: null,
    revealStream: null,
    nextHoldCells: [],
    puzzleCleared: false,
  };
}

type Initializer = (
  set: StoreApi<GameStore>['setState'],
  get: StoreApi<GameStore>['getState'],
) => GameStore;

function buildInitializer(initialRng: Rng): Initializer {
  // Mutable so beginRun() can re-seed an existing store with a server-issued
  // seed. Every rng consumer below reads this closure variable, so swapping it
  // changes all subsequent rolls/offers deterministically.
  let rng: Rng = initialRng;

  // Optional per-run config (season modes). null → legacy behavior.
  let runConfig: RunConfig | null = null;
  // The rule pool used for offers ('offer'→all RULES; 'pool'→rulePoolIds).
  const offerPool = (): Rule[] =>
    runConfig?.provisioning === 'pool' && runConfig.rulePoolIds
      ? rulesFromIds(runConfig.rulePoolIds)
      : RULES;

  // True for the legacy 'offer' path (빠른 게임/이벤트: undefined or explicit
  // 'offer'). Drives the combo/pair exclusion in offerRules so quick offers stay
  // on the original number/fruit/gem rule set. Season modes ('pool'/'fixed')
  // return false → their curated rulePoolIds are untouched.
  const isOfferProvisioning = (): boolean =>
    runConfig?.provisioning == null || runConfig.provisioning === 'offer';

  // swiss-knife (맥가이버 칼): 4 rule offers instead of 3. Config-driven, so
  // replay reproduces the same offer size + draws.
  const offerCount = (): number =>
    runConfig?.artifacts?.includes('swiss-knife') ? 4 : OFFER_COUNT;

  // The run's symbol bag (as weights) — drives which rules are offerable
  // (rulePlayable). Defaults to BASE_WEIGHTS for legacy event/quick runs.
  const bagWeights = (): Record<SymbolType, number> =>
    runConfig?.baseWeights ?? BASE_WEIGHTS;

  // The in-progress cascade frame is kept OUT of GameState (it carries the live
  // working/locked arrays threaded across the pause). It only ever
  // matters between spin() and selectCells()/finalize().
  let activeFrame: CascadeFrame | null = null;
  let activeCtx: ApplyCtx | null = null;
  // The EFFECTIVE slot list for the in-progress spin (= ruleSlots, with slot 1
  // duplicated when bean-blessing is owned). Computed in spin() and reused by
  // selectCells() (resolveSelection) and finalize() (scoreResult/scoreItems) so
  // the cascade, the pause/resume, and scoring all agree. Reset like activeFrame.
  let activeSlots: (Rule | null)[] | null = null;

  // Monotonic reveal-stream id. Incremented at the START of each spin() so the
  // reveal hook can tell a brand-new spin (new id → roll) apart from the same
  // spin gaining more steps after a selection (same id → continue, no replay).
  let revealId = 0;
  const nextId = () => (revealId += 1);

  // Ordered, serializable log of outcome-affecting actions. Reset on
  // startGame()/reset(); appended to by each committing action. Read via
  // getActions() to build a replayable run for server verification.
  let recorded: RecordedAction[] = [];
  const record = (a: RecordedAction) => {
    recorded.push(a);
  };

  return (set, get) => {
    /**
     * Resolve a completed cascade frame into a SpinLog + score and finish the
     * spin (status 'spin-result'). Shared by spin() (when no select rule pauses)
     * and selectCells() (when the last select rule resolves).
     */
    const finalize = (frame: CascadeFrame) => {
      const state = get();
      const { spinIndex } = state;
      // Score against the SAME effective slots the cascade ran on (slot 1
      // duplicated under bean-blessing), so score-rule occurrence counts and
      // blank-canvas null counts match what was actually applied. Falls back to
      // the live ruleSlots if a frame somehow finalizes without spin() setting it.
      const slots = activeSlots ?? state.ruleSlots;
      const finalResult = [...frame.working];

      // The spin's engine events (same list attached to the SpinLog below) feed
      // per-event SET bonuses (vehicle moved/rerolled, monster copied, ...).
      const events = frame.events ?? [];
      // scoreBoards lets position-sensitive rules (CLEAN SWEEP) score against the
      // board at their slot moment. Season modes opt in; legacy (빠른 게임/이벤트)
      // passes undefined → CLEAN SWEEP reads the FINAL board (original behavior).
      const boards = runConfig?.positionalCleanSweep ? (frame.scoreBoards ?? []) : undefined;
      // haunted cells (E1-lite) add a phantom 'ghost' to the hand counts. Threaded
      // exactly like `boards`: frame field -> finalize -> scoreResult/scoreItems.
      const haunted = frame.haunted ?? [];
      const ups = runConfig?.handUpgrades;
      const arts = runConfig?.artifacts ?? [];
      const score = scoreResult(finalResult, slots, events, boards, haunted, ups, arts);
      const items = scoreItems(finalResult, slots, events, boards, haunted, ups, arts);
      const specials = detectSpecials(finalResult, runConfig?.numberSpecials);
      const multiplier = state.nextMultiplier;
      let roundScore = score.baseRoundScore * multiplier;
      // time-capsule (타임캡슐): the stage's 1st spin (spinIndex 0) scores 0; the
      // 7th/last spin (spinIndex 6) scores ×2. Applied AFTER the existing
      // multiplier. spinIndex is deterministic, so this replays identically; if
      // the stage clears before spin 7, spin 6 never runs and the ×2 simply
      // doesn't occur.
      if (arts.includes('time-capsule')) {
        if (spinIndex === 0) roundScore = 0;
        else if (spinIndex === 6) roundScore *= 2;
      }

      const log: SpinLog = {
        spinIndex,
        baseResult: frame.baseResult,
        steps: frame.steps,
        finalResult,
        hand: score.hand,
        handScore: score.handScore,
        sevenScore: score.sevenScore,
        bonusScore: score.bonusScore,
        penalty: score.penalty,
        baseRoundScore: score.baseRoundScore,
        multiplier,
        roundScore,
        zeroDraw: specials.zeroDraw,
        multiplierSet: specials.nextMultiplier,
        lockedCells: frame.locked,
        scoreItems: items,
        interactive: frame.interactive,
        // ADDITIVE engine event log from the cascade (read-only; default [] if a
        // frame somehow lacks it). Does not affect any other SpinLog field.
        events: frame.events ?? [],
        // Per-cell haunted flags for the UI 👻 indicator. Copied from the cascade
        // frame; default to a length-5 all-false array if a frame somehow lacks it.
        haunted: [...(frame.haunted ?? [false, false, false, false, false])],
      };

      activeFrame = null;
      activeCtx = null;
      activeSlots = null;

      // Keep the SAME-id revealStream (so the hook continues, never replays) but
      // mark it done with the final steps. Do NOT clear it here — the reveal hook
      // still needs it to finish animating; it's cleared on the next spin (new id)
      // or in reset().
      const prevStream = state.revealStream;
      const revealStream =
        prevStream != null
          ? { ...prevStream, steps: [...frame.steps], done: true }
          : {
              id: revealId,
              baseResult: frame.baseResult,
              steps: [...frame.steps],
              done: true,
            };

      const nextSpinLogs = [...state.spinLogs, log];

      // Puzzle clear: when this run carries puzzleGoals, mark the run cleared the
      // INSTANT every goal is satisfied across the resolved spins (incl. this one).
      // The spin still ENDS in 'spin-result' so its reveal plays + board settles;
      // the puzzle UI shows 클리어 and a 결과 보기 action that calls next() → finished
      // (so the player isn't forced through the remaining spins). Driven purely by
      // the deterministic spin logs + config; the server replay (same puzzleGoals)
      // detects the same clearing spin. No-op for quick/daily/spire (no puzzleGoals).
      let puzzleCleared = false;
      const goals = runConfig?.puzzleGoals;
      if (goals && goals.length > 0) {
        const ctxs: GoalContext[] = nextSpinLogs.map((l) => ({
          board: l.finalResult,
          hand: computeHand(l.finalResult).hand,
          spinScore: l.roundScore,
        }));
        puzzleCleared = checkPuzzleRun(goals, ctxs).count === goals.length;
      }

      set({
        totalScore: state.totalScore + roundScore,
        spinLogs: nextSpinLogs,
        currentResult: finalResult,
        previousResult: finalResult,
        nextMultiplier: specials.nextMultiplier,
        extraRulePickCount: state.extraRulePickCount + (specials.zeroDraw ? 1 : 0),
        status: 'spin-result',
        puzzleCleared,
        pendingSelection: null,
        revealStream,
        // Carry this spin's parking holds to the NEXT spin's preHeld pass. This
        // REPLACES the value just consumed by spin(): a spin whose cascade left
        // frame.nextHold [] (no 유료 주차) clears it, so a hold never lingers.
        nextHoldCells: [...frame.nextHold],
      });
    };

    return {
    ...freshState(''),
    // Mirror of the private runConfig closure, exposed for pool-aware UI. Kept in
    // sync by configureRun/reset. Not read by the engine (the closure is).
    runConfig: null,

    setNickname: (name: string) => set({ nickname: name }),

    beginRun: (seed: string, runId: string, slug: string) => {
      rng = createSeededRng(seed);
      activeFrame = null;
      activeCtx = null;
      activeSlots = null;
      set({ runId, eventSlug: slug });
    },

    configureRun: (config: RunConfig | null) => {
      runConfig = config;
      // Mirror into state so pool-aware UI (StatusBar) reacts. Server replay also
      // calls configureRun; mirroring is a pure state write with no engine effect.
      set({ runConfig: config });
    },

    startGame: () => {
      const { nickname } = get();
      if (!nickname || nickname.trim().length === 0) return;
      recorded = [];
      const ruleSlots = emptySlots();
      const startBoard = runConfig?.initialBoard
        ? [...runConfig.initialBoard]
        : [...ZERO_RESULT];
      const maxSpins = runConfig?.maxSpins ?? MAX_SPINS;

      if (runConfig?.provisioning === 'fixed') {
        // Puzzle-style: rules pre-loaded into the bag, no per-turn offers. The
        // player drags them into slots, then spins. Straight to ready-to-spin.
        set({
          spinIndex: 0,
          maxSpins,
          totalScore: 0,
          nextMultiplier: 1,
          previousResult: startBoard,
          currentResult: [...startBoard],
          ruleSlots,
          bag: rulesFromIds(runConfig.rulePoolIds ?? []),
          extraRulePickCount: 0,
          picksLeft: 0,
          pendingRule: null,
          spinLogs: [],
          offeredRules: [],
          status: 'ready-to-spin',
        });
        return;
      }

      const bag: Rule[] = [];
      set({
        spinIndex: 0,
        maxSpins,
        totalScore: 0,
        nextMultiplier: 1,
        previousResult: startBoard,
        currentResult: [...startBoard],
        ruleSlots,
        bag,
        extraRulePickCount: 0,
        // engine (엔진): +1 rule pick before the FIRST spin of each stage. Only
        // startGame; subsequent spins via next() are unchanged. Config-driven.
        picksLeft: 1 + (runConfig?.artifacts?.includes('engine') ? 1 : 0),
        pendingRule: null,
        spinLogs: [],
        offeredRules: offerRules(rng, ruleSlots, bag, offerPool(), offerCount(), bagWeights(), isOfferProvisioning()),
        status: 'choosing-rule',
      });
    },

    selectRule: (rule: Rule) => {
      if (get().status !== 'choosing-rule') return;
      record({ type: 'selectRule', ruleId: rule.id });
      set({ pendingRule: rule, status: 'placing' });
    },

    cancelSelection: () => {
      if (get().status !== 'placing') return;
      // Must be recorded: RulePicker is hidden during 'placing', so re-picking a
      // rule REQUIRES cancelling first. Without this, replay would keep the first
      // pendingRule (the second selectRule no-ops in 'placing') and diverge.
      record({ type: 'cancelSelection' });
      set({ pendingRule: null, status: 'choosing-rule' });
    },

    placePending: (target: PlaceTarget) => {
      const { pendingRule, ruleSlots, bag, picksLeft } = get();
      if (pendingRule == null) return;

      let nextSlots = ruleSlots;
      let nextBag = bag;

      if (target.type === 'bag') {
        nextBag = [...bag, pendingRule];
      } else {
        const { index } = target;
        if (index < 0 || index >= SLOT_COUNT) return;
        nextSlots = ruleSlots.slice();
        const displaced = nextSlots[index];
        nextSlots[index] = pendingRule;
        nextBag = displaced != null ? [...bag, displaced] : bag;
      }

      record({ type: 'placePending', target });

      const remaining = picksLeft - 1;
      if (remaining > 0) {
        // Zero-draw bonus: more rules to place this turn. Offer a fresh card and
        // stay in the choosing phase (no extra spin — still one spin per turn).
        set({
          ruleSlots: nextSlots,
          bag: nextBag,
          pendingRule: null,
          picksLeft: remaining,
          offeredRules: offerRules(rng, nextSlots, nextBag, offerPool(), offerCount(), bagWeights(), isOfferProvisioning()),
          status: 'choosing-rule',
        });
      } else {
        set({
          ruleSlots: nextSlots,
          bag: nextBag,
          pendingRule: null,
          picksLeft: 0,
          status: 'ready-to-spin',
        });
      }
    },

    moveRule: (from: RuleLocation, to: RuleLocation) => {
      const state = get();
      // Allow rearranging in every non-spinning state (the spin reveal /
      // awaiting-selection cover the board with the stage overlay anyway).
      const canArrange =
        state.status === 'choosing-rule' ||
        state.status === 'placing' ||
        state.status === 'ready-to-spin' ||
        state.status === 'spin-result';
      if (!canArrange) return;

      // Record at the top: replay reconstructs the identical state, so the same
      // (from,to) yields the same commit-or-no-op outcome as the original.
      record({ type: 'moveRule', from, to });

      const slots = state.ruleSlots.slice();
      const bag = state.bag.slice();

      // slot <-> slot: swap
      if (from.zone === 'slot' && to.zone === 'slot') {
        if (from.index < 0 || from.index >= SLOT_COUNT) return;
        if (to.index < 0 || to.index >= SLOT_COUNT) return;
        const tmp = slots[from.index];
        slots[from.index] = slots[to.index];
        slots[to.index] = tmp;
        set({ ruleSlots: slots });
        return;
      }

      // slot -> bag: clear slot, insert into bag at index
      if (from.zone === 'slot' && to.zone === 'bag') {
        if (from.index < 0 || from.index >= SLOT_COUNT) return;
        const moving = slots[from.index];
        if (moving == null) return;
        slots[from.index] = null;
        const insertAt = Math.max(0, Math.min(to.index, bag.length));
        bag.splice(insertAt, 0, moving);
        set({ ruleSlots: slots, bag });
        return;
      }

      // bag -> slot: place; if slot occupied, occupant goes to bag
      if (from.zone === 'bag' && to.zone === 'slot') {
        if (from.index < 0 || from.index >= bag.length) return;
        if (to.index < 0 || to.index >= SLOT_COUNT) return;
        const [moving] = bag.splice(from.index, 1);
        if (moving == null) return;
        const occupant = slots[to.index];
        slots[to.index] = moving;
        if (occupant != null) bag.push(occupant);
        set({ ruleSlots: slots, bag });
        return;
      }

      // bag <-> bag: reorder
      if (from.zone === 'bag' && to.zone === 'bag') {
        if (from.index < 0 || from.index >= bag.length) return;
        const [moving] = bag.splice(from.index, 1);
        const insertAt = Math.max(0, Math.min(to.index, bag.length));
        bag.splice(insertAt, 0, moving);
        set({ bag });
        return;
      }
    },

    spin: () => {
      const state = get();
      if (state.status !== 'ready-to-spin') return;
      record({ type: 'spin' });

      const { ruleSlots, previousResult } = state;
      // bean-blessing (콩의 가호): apply slot 1's rule one more time this spin by
      // duplicating it into a derived effective slot list. Drives weights, the
      // roll, the cascade, and (via activeSlots) scoring — all consistently. A
      // no-op without the artifact, so non-artifact runs are byte-identical.
      const slots = effectiveSlots(ruleSlots, runConfig?.artifacts);

      let weights = computeWeights(slots, runConfig?.baseWeights ?? BASE_WEIGHTS);
      // melted-cat (녹아버린 고양이): no cat symbols on the stage's FIRST spin
      // (spinIndex 0). Clone the weights and zero every cat-set symbol BEFORE
      // rolling. Numbers/other sets still have weight, so the bag is never fully
      // zeroed. Deterministic (config + spinIndex driven) → replays identically.
      if (runConfig?.artifacts?.includes('melted-cat') && state.spinIndex === 0) {
        weights = { ...weights };
        for (const cat of CATS) weights[cat] = 0;
      }
      const base = rollBoard(slots, weights, previousResult, rng);
      const ctx: ApplyCtx = { previousResult, weights, rng };
      // Cross-spin HOLD: cells flagged by the previous spin's next-spin rule
      // (유료 주차) are held to previousResult at this spin's first roll. Pure
      // engine state (deterministic), so replay reproduces it exactly.
      const frame = beginCascade(base, slots, ctx, { preHeld: state.nextHoldCells });

      activeFrame = frame;
      activeCtx = ctx;
      activeSlots = slots;

      // Open a fresh reveal stream for this spin (new id → the hook rolls anew).
      const id = nextId();
      const revealStream = {
        id,
        baseResult: frame.baseResult,
        steps: [...frame.steps],
        done: frame.done,
      };

      if (frame.pending) {
        // Cascade reached a `select` rule that needs player input. PAUSE: show
        // the partial board and wait for selectCells(). The reveal animates the
        // steps so far and pauses for the picker.
        const p = frame.pending;
        set({
          currentResult: [...frame.working],
          revealStream,
          pendingSelection: {
            kind: p.kind,
            ruleName: p.ruleName,
            count: p.count,
            selectable: [...p.selectable],
          },
          status: 'awaiting-selection',
        });
        return;
      }

      set({ currentResult: [...frame.working], revealStream });
      finalize(frame);
    },

    selectCells: (indices: number[]) => {
      const state = get();
      if (state.status !== 'awaiting-selection') return;
      if (!activeFrame || !activeFrame.pending || !activeCtx) return;

      // Resume the cascade on the SAME effective slots spin() ran on (slot 1
      // duplicated under bean-blessing), so a select rule in slot 1 pauses/resumes
      // for BOTH of its occurrences exactly as recorded.
      const slots = activeSlots ?? state.ruleSlots;
      const pending = activeFrame.pending;
      const expectedCount = pending.count;

      // Validate count: park (유료 주차) is "최대 N칸" — any 1..N selection is valid
      // (player confirms with a button); every other kind needs exactly `count`.
      // Then: all distinct, all selectable.
      if (pending.kind === 'park') {
        if (indices.length < 1 || indices.length > expectedCount) return;
      } else if (indices.length !== expectedCount) {
        return;
      }
      const seen = new Set<number>();
      for (const i of indices) {
        if (i < 0 || i >= pending.selectable.length) return;
        if (!pending.selectable[i]) return;
        if (seen.has(i)) return;
        seen.add(i);
      }

      record({ type: 'selectCells', indices: [...indices] });
      const frame = resolveSelection(activeFrame, slots, activeCtx, indices);
      activeFrame = frame;

      // SAME-id revealStream, now with MORE steps: the hook continues animating
      // the appended steps from where it left off (no re-roll, no replay).
      const prevStream = state.revealStream;
      const revealStream =
        prevStream != null
          ? { ...prevStream, steps: [...frame.steps], done: frame.done }
          : {
              id: revealId,
              baseResult: frame.baseResult,
              steps: [...frame.steps],
              done: frame.done,
            };

      if (frame.pending) {
        // Another select rule paused: keep awaiting input on the new board.
        const p = frame.pending;
        set({
          currentResult: [...frame.working],
          revealStream,
          pendingSelection: {
            kind: p.kind,
            ruleName: p.ruleName,
            count: p.count,
            selectable: [...p.selectable],
          },
          status: 'awaiting-selection',
        });
        return;
      }

      set({ currentResult: [...frame.working], revealStream });
      finalize(frame);
    },

    next: () => {
      const state = get();
      if (state.status !== 'spin-result') return;
      record({ type: 'next' });

      // Puzzle: once cleared, 결과 보기 ends the run immediately (don't force the
      // player through the remaining spins).
      if (state.puzzleCleared) {
        set({ status: 'finished' });
        return;
      }

      const nextSpinIndex = state.spinIndex + 1;
      if (nextSpinIndex >= state.maxSpins) {
        set({ spinIndex: nextSpinIndex, status: 'finished' });
        return;
      }

      // Fixed-provisioning (puzzle): no new offers — keep the arranged rules and
      // go straight to the next spin.
      if (runConfig?.provisioning === 'fixed') {
        set({
          spinIndex: nextSpinIndex,
          picksLeft: 0,
          extraRulePickCount: 0,
          pendingRule: null,
          status: 'ready-to-spin',
        });
        return;
      }

      // Advance the turn. A zero-draw from the spin just finished grants extra
      // rule placements THIS upcoming turn (still a single spin for the turn).
      set({
        spinIndex: nextSpinIndex,
        picksLeft: 1 + state.extraRulePickCount,
        extraRulePickCount: 0,
        offeredRules: offerRules(rng, state.ruleSlots, state.bag, offerPool(), offerCount(), bagWeights(), isOfferProvisioning()),
        pendingRule: null,
        status: 'choosing-rule',
      });
    },

    reset: () => {
      const { nickname } = get();
      activeFrame = null;
      activeCtx = null;
      activeSlots = null;
      recorded = [];
      runConfig = null;
      set({ ...freshState(nickname), runConfig: null });
    },

    getActions: () => [...recorded],
    };
  };
}

/**
 * Factory so tests can inject a deterministic rng. Returns a zustand vanilla store.
 */
export function createGameStore(rng: Rng = defaultRng): StoreApi<GameStore> {
  return createStore<GameStore>(buildInitializer(rng));
}

/** Default React hook bound to the real (Math.random-backed) rng. */
export const useGameStore = create<GameStore>(buildInitializer(defaultRng));
