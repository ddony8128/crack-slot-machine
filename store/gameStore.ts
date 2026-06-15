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
import { scoreResult, scoreItems } from '@/lib/score';
import { detectSpecials } from '@/lib/specials';
import { RULES, RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';

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

export type GameStore = GameState & GameActions;

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
 * Offer 3 distinct rules (by id) that are NOT currently in a slot OR the bag.
 * Shuffles the allowed pool with the injected rng and takes the first 3.
 * With 26 rules this never starves a 3-card offer.
 */
function offerRules(
  rng: Rng,
  slots: Array<Rule | null>,
  bag: Rule[],
  pool: Rule[] = RULES,
): Rule[] {
  const usedIds = new Set<string>();
  for (const r of slots) if (r != null) usedIds.add(r.id);
  for (const r of bag) usedIds.add(r.id);
  const allowed = pool.filter((r) => !usedIds.has(r.id));
  return shuffle(allowed, rng).slice(0, OFFER_COUNT);
}

/** Resolve a rule-id list to Rule objects (skips unknown ids). */
function rulesFromIds(ids: string[]): Rule[] {
  return ids.map((id) => RULES_BY_ID[id]).filter((r): r is Rule => r != null);
}

function emptySlots(): Array<Rule | null> {
  return [null, null, null, null, null];
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

  // The in-progress cascade frame is kept OUT of GameState (it carries the live
  // working/locked arrays threaded across the pause). It only ever
  // matters between spin() and selectCells()/finalize().
  let activeFrame: CascadeFrame | null = null;
  let activeCtx: ApplyCtx | null = null;

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
      const { ruleSlots, spinIndex } = state;
      const finalResult = [...frame.working];

      // The spin's engine events (same list attached to the SpinLog below) feed
      // per-event SET bonuses (vehicle moved/rerolled, monster copied, ...).
      const events = frame.events ?? [];
      // scoreBoards lets position-sensitive rules (CLEAN SWEEP) score against the
      // board at their slot moment, not the final board.
      const boards = frame.scoreBoards ?? [];
      // haunted cells (E1-lite) add a phantom 'ghost' to the hand counts. Threaded
      // exactly like `boards`: frame field -> finalize -> scoreResult/scoreItems.
      const haunted = frame.haunted ?? [];
      const score = scoreResult(finalResult, ruleSlots, events, boards, haunted);
      const items = scoreItems(finalResult, ruleSlots, events, boards, haunted);
      const specials = detectSpecials(finalResult);
      const multiplier = state.nextMultiplier;
      const roundScore = score.baseRoundScore * multiplier;

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
      };

      activeFrame = null;
      activeCtx = null;

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

      set({
        totalScore: state.totalScore + roundScore,
        spinLogs: [...state.spinLogs, log],
        currentResult: finalResult,
        previousResult: finalResult,
        nextMultiplier: specials.nextMultiplier,
        extraRulePickCount: state.extraRulePickCount + (specials.zeroDraw ? 1 : 0),
        status: 'spin-result',
        pendingSelection: null,
        revealStream,
      });
    };

    return {
    ...freshState(''),

    setNickname: (name: string) => set({ nickname: name }),

    beginRun: (seed: string, runId: string, slug: string) => {
      rng = createSeededRng(seed);
      activeFrame = null;
      activeCtx = null;
      set({ runId, eventSlug: slug });
    },

    configureRun: (config: RunConfig | null) => {
      runConfig = config;
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
        picksLeft: 1,
        pendingRule: null,
        spinLogs: [],
        offeredRules: offerRules(rng, ruleSlots, bag, offerPool()),
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
          offeredRules: offerRules(rng, nextSlots, nextBag),
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

      const weights = computeWeights(ruleSlots, runConfig?.baseWeights ?? BASE_WEIGHTS);
      const base = rollBoard(ruleSlots, weights, previousResult, rng);
      const ctx: ApplyCtx = { previousResult, weights, rng };
      const frame = beginCascade(base, ruleSlots, ctx);

      activeFrame = frame;
      activeCtx = ctx;

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
            count: p.kind === 'swap' ? 2 : 1,
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

      const { ruleSlots } = state;
      const pending = activeFrame.pending;
      const expectedCount = pending.kind === 'swap' ? 2 : 1;

      // Validate: right count, all distinct, all selectable.
      if (indices.length !== expectedCount) return;
      const seen = new Set<number>();
      for (const i of indices) {
        if (i < 0 || i >= pending.selectable.length) return;
        if (!pending.selectable[i]) return;
        if (seen.has(i)) return;
        seen.add(i);
      }

      record({ type: 'selectCells', indices: [...indices] });
      const frame = resolveSelection(activeFrame, ruleSlots, activeCtx, indices);
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
            count: p.kind === 'swap' ? 2 : 1,
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
        offeredRules: offerRules(rng, state.ruleSlots, state.bag, offerPool()),
        pendingRule: null,
        status: 'choosing-rule',
      });
    },

    reset: () => {
      const { nickname } = get();
      activeFrame = null;
      activeCtx = null;
      recorded = [];
      runConfig = null;
      set({ ...freshState(nickname) });
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
