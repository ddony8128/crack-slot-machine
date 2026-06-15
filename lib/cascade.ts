import type { EngineEvent, Rule, SelectKind, SpinLogStep, SymbolType } from '@/types';
import { CATS, FRUITS, GEMS, VEHICLES } from '@/data/symbols';
import { rollSymbol, type Rng } from '@/lib/rng';

export type ApplyCtx = {
  previousResult: SymbolType[];
  weights: Record<SymbolType, number>;
  rng: Rng;
};

const FRUIT_SET = new Set<SymbolType>(FRUITS);
const GEM_SET = new Set<SymbolType>(GEMS);
const CAT_SET = new Set<SymbolType>(CATS);

// VEHICLES = [plane, ship, car]; plane/ship literals drive the vehicle rules.
const PLANE: SymbolType = VEHICLES[0];
const SHIP: SymbolType = VEHICLES[1];

/** Max reroll iterations for loop-until-condition rules (fish/shuffle). */
const REROLL_CAP = 30;

/**
 * A `select` rule waiting for player input. `selectable[i]` is true for cells
 * the player may pick (computed per-rule from the current locked state).
 */
export type Pending = {
  kind: SelectKind;
  ruleName: string;
  selectable: boolean[];
};

/**
 * The full, resumable state of a spin cascade. The same frame is threaded
 * through `beginCascade` -> `advanceCascade` -> `resolveSelection` so the
 * resolution can PAUSE at a `select` rule (interactive) and RESUME later.
 *
 * `interactive` records whether any select rule actually resolved (used by the
 * store to flag the SpinLog and let the reveal skip playback).
 */
export type CascadeFrame = {
  working: SymbolType[];
  locked: boolean[];
  steps: SpinLogStep[];
  baseResult: SymbolType[];
  slotIndex: number;
  pending: Pending | null;
  done: boolean;
  interactive: boolean;
  // ADDITIVE per-spin engine event log (reroll/move/copy/transform/lock), in
  // application order. Read-only data for later set-scoring; emitted alongside the
  // normal board writes and NEVER affects board/score/reveal/replay outcome.
  events: EngineEvent[];
  // Board snapshot AT each score-rule's slot position (in order), so position-
  // sensitive score rules (e.g. CLEAN SWEEP) evaluate against the board at their
  // moment, not the final board. Includes copy-above re-applications of score rules.
  scoreBoards: Array<{ ruleId: string; board: SymbolType[] }>;
};

/**
 * Write a cell. Under the PURE SEQUENTIAL + HOLD model a later rule freely
 * overwrites whatever an earlier rule wrote, INCLUDING a `locked` (pre-roll held)
 * cell — `locked` now means "held at the first roll (display only)", NOT immutable.
 * When a held cell is overwritten it is no longer held, so clear its flag. Always
 * writes; returns true.
 */
function write(
  working: SymbolType[],
  locked: boolean[],
  i: number,
  value: SymbolType,
): boolean {
  working[i] = value;
  if (locked[i]) locked[i] = false;
  return true;
}

/**
 * Apply a single non-lock, non-select, non-meta board rule (reroll/transform).
 * Mirrors the original applyRules switch. `select` and `lock` are handled
 * elsewhere; weight/score have no board effect.
 *
 * PURE SEQUENTIAL + HOLD: each rule writes its target(s) freely, overwriting any
 * earlier change, INCLUDING held (`locked`) cells — a held cell is only held on
 * the first roll, later rules may still change it. Writing a held cell clears its
 * held flag (un-greys it). "leftmost X" targeting therefore scans every cell.
 *
 * Returns the indices that were given a FRESH RANDOM ROLL (reroll rules only) so
 * the reveal can animate them even when the value repeats. Transforms return [].
 */
function applyOne(
  rule: Rule,
  working: SymbolType[],
  locked: boolean[],
  ctx: ApplyCtx,
  events: EngineEvent[],
): number[] {
  const { weights, rng } = ctx;
  // ADDITIVE event helpers. They only PUSH to `events`; they never read or change
  // any board value, so removing them would leave the cascade outcome identical.
  const emitReroll = (symbolId: SymbolType, index: number) => {
    events.push({ type: 'symbol_rerolled', symbolId, index, byRuleId: rule.id });
  };
  const emitCopy = (symbolId: SymbolType, fromIndex: number, toIndex: number) => {
    events.push({ type: 'symbol_copied', symbolId, fromIndex, toIndex, byRuleId: rule.id });
  };
  const emitTransform = (
    fromSymbolId: SymbolType,
    toSymbolId: SymbolType,
    index: number,
  ) => {
    events.push({ type: 'symbol_transformed', fromSymbolId, toSymbolId, index, byRuleId: rule.id });
  };
  const emitMove = (symbolId: SymbolType, fromIndex: number, toIndex: number) => {
    events.push({ type: 'symbol_moved', symbolId, fromIndex, toIndex, byRuleId: rule.id });
  };
  switch (rule.id) {
    // ---- reroll ----
    case 'four-shield': {
      const rolled: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four') {
          const old = working[i];
          write(working, locked, i, rollSymbol(weights, rng));
          emitReroll(old, i);
          rolled.push(i);
        }
      }
      return rolled;
    }
    case 'four-parry': {
      const idx = working.findIndex((s) => s === 'four');
      if (idx !== -1) {
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && working[idx] === 'four') {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        return [idx];
      }
      return [];
    }
    case 'gem-shuffle': {
      const idx = working.findIndex((s) => GEM_SET.has(s));
      if (idx !== -1) {
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        return [idx];
      }
      return [];
    }
    case 'fruit-fish': {
      const idx = working.findIndex((s) => !FRUIT_SET.has(s));
      if (idx !== -1) {
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && !FRUIT_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        return [idx];
      }
      return [];
    }
    case 'gem-fish': {
      const idx = working.findIndex((s) => !GEM_SET.has(s));
      if (idx !== -1) {
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && !GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        return [idx];
      }
      return [];
    }

    // ---- transform (COPY: a cell takes another cell's current symbol) ----
    case 'left-pair': {
      const src = working[0];
      if (write(working, locked, 1, src)) emitCopy(src, 0, 1);
      return [];
    }
    case 'center-echo': {
      const src = working[1];
      if (write(working, locked, 3, src)) emitCopy(src, 1, 3);
      return [];
    }
    case 'third-mirror': {
      const src = working[4];
      if (write(working, locked, 2, src)) emitCopy(src, 4, 2);
      return [];
    }
    // ---- transform (SET: a cell becomes a fixed symbol) ----
    case 'first-cherry': {
      const old = working[0];
      if (old !== 'cherry' && write(working, locked, 0, 'cherry')) emitTransform(old, 'cherry', 0);
      return [];
    }
    case 'safe-convert':
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'four' || old === 'zero') {
          if (write(working, locked, i, 'ruby')) emitTransform(old, 'ruby', i);
        }
      }
      return [];
    case 'zero-to-seven':
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'zero') {
          if (write(working, locked, i, 'seven')) emitTransform(old, 'seven', i);
        }
      }
      return [];
    case 'red-dye':
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'lemon' || old === 'diamond') {
          if (write(working, locked, i, 'cherry')) emitTransform(old, 'cherry', i);
        }
      }
      return [];
    case 'blue-dye':
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'lemon' || old === 'diamond') {
          if (write(working, locked, i, 'sapphire')) emitTransform(old, 'sapphire', i);
        }
      }
      return [];

    // ---- transform (MOVE: a cat relocates, shifting/swapping cells) ----
    case 'cat-zoomies': {
      // Rightmost cat moves to index 0; the cells between it shift right by one.
      let r = -1;
      for (let i = working.length - 1; i >= 0; i--) {
        if (CAT_SET.has(working[i])) {
          r = i;
          break;
        }
      }
      if (r > 0) {
        const cat = working[r];
        // Shift cells [0..r-1] right into [1..r] (highest first so we read before
        // overwriting), then drop the cat into index 0.
        for (let i = r - 1; i >= 0; i--) {
          const moved = working[i];
          write(working, locked, i + 1, moved);
          emitMove(moved, i, i + 1);
        }
        write(working, locked, 0, cat);
        emitMove(cat, r, 0);
      }
      return [];
    }
    case 'cat-jump': {
      // Leftmost cat swaps with the cell two to its left or two to its right
      // (uniformly random among the valid directions).
      const L = working.findIndex((s) => CAT_SET.has(s));
      if (L !== -1) {
        const targets: number[] = [];
        if (L - 2 >= 0) targets.push(L - 2);
        if (L + 2 <= working.length - 1) targets.push(L + 2);
        if (targets.length > 0) {
          const target = targets.length === 2 ? (rng() < 0.5 ? targets[0] : targets[1]) : targets[0];
          const a = working[L];
          const b = working[target];
          // SWAP: each cell's prior value leaves it and arrives at the other.
          write(working, locked, target, a);
          write(working, locked, L, b);
          emitMove(a, L, target);
          emitMove(b, target, L);
        }
      }
      return [];
    }

    // ---- transform (vehicle) ----
    case 'vehicle-logistics': {
      // Swap two distinct random cells, once per plane on the board. N===0 -> no-op.
      const planes = working.reduce((n, s) => (s === PLANE ? n + 1 : n), 0);
      const n = working.length;
      for (let p = 0; p < planes; p++) {
        const a = Math.floor(rng() * n);
        let b = Math.floor(rng() * n);
        // Reroll the second pick until it differs from the first (cap attempts).
        let iter = 0;
        while (b === a && iter < REROLL_CAP) {
          b = Math.floor(rng() * n);
          iter += 1;
        }
        if (b === a) continue; // could not find a distinct index; skip this swap
        const va = working[a];
        const vb = working[b];
        // SWAP: each cell's prior value leaves it and arrives at the other.
        write(working, locked, a, vb);
        write(working, locked, b, va);
        emitMove(va, a, b);
        emitMove(vb, b, a);
      }
      return [];
    }
    case 'vehicle-bigboat': {
      // Leftmost ship copies itself into its immediate neighbours (in range).
      const s = working.findIndex((sym) => sym === SHIP);
      if (s !== -1) {
        const ship = working[s];
        if (s - 1 >= 0) {
          write(working, locked, s - 1, ship);
          emitCopy(ship, s, s - 1);
        }
        if (s + 1 <= working.length - 1) {
          write(working, locked, s + 1, ship);
          emitCopy(ship, s, s + 1);
        }
      }
      return [];
    }

    // ---- lock rules are handled in the PRE-ROLL HOLD pass, not here. ----
    // ---- select rules are interactive — handled via Pending, not here. ----

    default:
      return [];
  }
}

const SELECT_KIND: Record<string, SelectKind> = {
  'select-copy': 'copy',
  'select-swap': 'swap',
  'select-reroll': 'reroll',
};

// Inverse of SELECT_KIND: the select rule id for a given kind. Used to tag the
// ADDITIVE engine events with the actual select rule's id (byRuleId).
const SELECT_RULE_ID: Record<SelectKind, string> = {
  copy: 'select-copy',
  swap: 'select-swap',
  reroll: 'select-reroll',
};

/**
 * Cells the player may pick for the given select rule. Under the PURE SEQUENTIAL +
 * HOLD model a select rule overwrites whatever earlier rules wrote, INCLUDING held
 * (`locked`) cells — held only means "held at the first roll", so every cell is
 * selectable. (`select-copy` still excludes index 0, which has no left neighbour to
 * copy.)
 */
function selectableFor(kind: SelectKind, locked: boolean[]): boolean[] {
  const out = locked.map(() => true);
  if (kind === 'copy') out[0] = false;
  return out;
}

/** True if the select rule can run at all (else it AUTO-SKIPS, no pause). */
function isApplicable(kind: SelectKind, selectable: boolean[]): boolean {
  const free = selectable.filter(Boolean).length;
  if (kind === 'swap') return free >= 2;
  // copy & reroll each need at least one eligible cell.
  return free >= 1;
}

/**
 * PRE-ROLL HOLD pass + frame setup, then advance to the first pause/completion.
 *
 * Locks freeze their cell(s) to `previousResult` (absolute, order-independent);
 * `baseResult` is captured right after, with held cells = previous value and all
 * others = the raw roll. Then the cascade advances until it either reaches a
 * `select` rule that needs player input (frame.pending set, paused) or finishes
 * (frame.done).
 */
export function beginCascade(
  base: SymbolType[],
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  opts: { autoSkipSelect?: boolean } = {},
): CascadeFrame {
  const working: SymbolType[] = [...base];
  const locked: boolean[] = [false, false, false, false, false];
  // ADDITIVE engine event log for the whole spin. Populated alongside (never
  // instead of) the normal board writes; read-only for later set-scoring.
  const events: EngineEvent[] = [];

  // --- PRE-ROLL HOLD pass: freeze locked cells to the previous spin value. ---
  // A `copy-above` whose slot above is a lock re-applies that lock here too
  // (idempotent for center/last-lock; fruit-freeze then holds the NEXT 2 fruits).
  const prev = ctx.previousResult;
  const applyLock = (lockRule: Rule) => {
    if (lockRule.id === 'center-lock') {
      if (!locked[2]) {
        working[2] = prev[2];
        locked[2] = true;
        events.push({ type: 'symbol_locked', symbolId: working[2], index: 2, byRuleId: lockRule.id });
      }
    } else if (lockRule.id === 'last-lock') {
      if (!locked[4]) {
        working[4] = prev[4];
        locked[4] = true;
        events.push({ type: 'symbol_locked', symbolId: working[4], index: 4, byRuleId: lockRule.id });
      }
    } else if (lockRule.id === 'fruit-freeze') {
      let held = 0;
      for (let i = 0; i < prev.length && held < 2; i++) {
        if (FRUIT_SET.has(prev[i]) && !locked[i]) {
          working[i] = prev[i];
          locked[i] = true;
          events.push({ type: 'symbol_locked', symbolId: working[i], index: i, byRuleId: lockRule.id });
          held += 1;
        }
      }
    } else if (lockRule.id === 'cat-hold') {
      // Hold EVERY cell whose previous value was a cat (no count limit).
      for (let i = 0; i < prev.length; i++) {
        if (CAT_SET.has(prev[i]) && !locked[i]) {
          working[i] = prev[i];
          locked[i] = true;
          events.push({ type: 'symbol_locked', symbolId: working[i], index: i, byRuleId: lockRule.id });
        }
      }
    }
  };
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    if (rule.type === 'lock') {
      applyLock(rule);
    } else if (rule.id === 'copy-above') {
      const above = i > 0 ? rules[i - 1] : null;
      if (above && above.type === 'lock') applyLock(above);
    }
  }

  const baseResult: SymbolType[] = [...working];

  const frame: CascadeFrame = {
    working,
    locked,
    steps: [],
    baseResult,
    slotIndex: 0,
    pending: null,
    done: false,
    interactive: false,
    events,
    scoreBoards: [],
  };

  return advanceCascade(frame, rules, ctx, opts);
}

/**
 * Process slots from `frame.slotIndex` onward (top -> bottom) under PURE
 * SEQUENTIAL + HOLD semantics: each rule overwrites whatever earlier rules wrote,
 * INCLUDING pre-roll held (`locked`) cells (held is first-roll only, modifiable;
 * writing a held cell un-holds it). PAUSES (returns with
 * `frame.pending` set, slotIndex left on the select rule) when it reaches a
 * `select` rule that needs input. Auto-skips a select rule whose constraint can't
 * be met (pushes a "(건너뜀)" step). When all slots are processed, sets
 * `frame.done = true`.
 */
export function advanceCascade(
  frame: CascadeFrame,
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  opts: { autoSkipSelect?: boolean } = {},
): CascadeFrame {
  const { working, locked, steps } = frame;

  for (; frame.slotIndex < rules.length; frame.slotIndex++) {
    const slotIndex = frame.slotIndex;
    const rule = rules[slotIndex];
    if (
      !rule ||
      rule.type === 'weight' ||
      rule.type === 'score' ||
      rule.type === 'lock'
    ) {
      // Score rules don't change the board, but their bonus may depend on the
      // board AT THIS POSITION (e.g. CLEAN SWEEP). Snapshot it here.
      if (rule && rule.type === 'score') {
        frame.scoreBoards.push({ ruleId: rule.id, board: [...working] });
      }
      continue;
    }

    if (rule.type === 'select') {
      const kind = SELECT_KIND[rule.id];
      const selectable = selectableFor(kind, locked);
      // The non-interactive (pure) path can never prompt: always auto-skip a
      // select rule there so applyRules stays pure & total.
      if (opts.autoSkipSelect || !isApplicable(kind, selectable)) {
        steps.push({ label: `${rule.name} (건너뜀)`, result: [...working], locked: [...locked] });
        continue;
      }
      // Needs player input: pause here. slotIndex stays on this rule.
      frame.pending = { kind, ruleName: rule.name, selectable };
      return frame;
    }

    if (rule.id === 'copy-above') {
      const above = slotIndex > 0 ? rules[slotIndex - 1] : null;
      if (!above || above.id === 'copy-above') {
        steps.push({ label: 'COPY ABOVE → (none)', result: [...working], locked: [...locked] });
        continue;
      }
      if (above.type === 'lock') {
        // The lock (and this copy of it) were already applied in the pre-roll
        // HOLD pass; just acknowledge it here (board already reflects the hold).
        steps.push({ label: `COPY ABOVE → ${above.name}`, result: [...working], locked: [...locked] });
        continue;
      }
      if (above.type === 'select') {
        // Re-run the above SELECT rule: another interactive pick (or auto-skip).
        const kind = SELECT_KIND[above.id];
        const selectable = selectableFor(kind, locked);
        if (opts.autoSkipSelect || !isApplicable(kind, selectable)) {
          steps.push({ label: `COPY ABOVE → ${above.name} (건너뜀)`, result: [...working], locked: [...locked] });
          continue;
        }
        // Pause here (slotIndex stays on the copy-above slot) for the player.
        frame.pending = { kind, ruleName: `COPY ABOVE → ${above.name}`, selectable };
        return frame;
      }
      // weight/score rules are not board-changing here; only reroll/transform
      // re-apply a post-roll board effect.
      // A copy-above of a SCORE rule re-applies that score rule at THIS position.
      if (above.type === 'score') {
        frame.scoreBoards.push({ ruleId: above.id, board: [...working] });
      }
      let copyRolled: number[] = [];
      if (above.type === 'reroll' || above.type === 'transform') {
        // Events emit NATURALLY from this call, tagged with the above rule's id
        // (the ACTUAL rule applied). No separate emit here -> no double-emit.
        copyRolled = applyOne(above, working, locked, ctx, frame.events);
      }
      const copyStep: SpinLogStep = { label: `COPY ABOVE → ${above.name}`, result: [...working], locked: [...locked] };
      if (copyRolled.length) copyStep.rerolled = copyRolled;
      steps.push(copyStep);
      continue;
    }

    const rolled = applyOne(rule, working, locked, ctx, frame.events);
    const step: SpinLogStep = { label: rule.name, result: [...working], locked: [...locked] };
    if (rolled.length) step.rerolled = rolled;
    steps.push(step);
  }

  frame.done = true;
  return frame;
}

/**
 * Apply the pending select rule at `frame.slotIndex` with the player's chosen
 * `indices`, push a step, then resume advancing to the next pause or completion.
 * Under the pure sequential + HOLD model the select rule overwrites the chosen
 * cells freely; a chosen cell that was held becomes un-held (display un-greys).
 */
export function resolveSelection(
  frame: CascadeFrame,
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  indices: number[],
): CascadeFrame {
  const pending = frame.pending;
  if (!pending) return frame;

  const { working, locked, steps } = frame;
  // Use the pending's own label so COPY ABOVE → SELECT shows correctly (the slot
  // rule may be `copy-above`, not the select rule itself).
  const ruleName = pending.ruleName;

  // byRuleId for the ADDITIVE engine events: the select rule's own id. The slot
  // rule may be `copy-above` but the applied effect is still the select rule.
  const selectRuleId = SELECT_RULE_ID[pending.kind];

  // SELECT REROLL gives the chosen cell a fresh random roll, so it must animate
  // even if the value repeats. copy/swap are deterministic — a no-visible-change
  // there genuinely means the board is identical, so no rerolled hint is needed.
  let rerolled: number[] | undefined;
  switch (pending.kind) {
    case 'copy': {
      const i = indices[0];
      const src = working[i - 1];
      // cell[i] = cell[i-1]. Modifying a held cell un-holds it (display un-greys).
      working[i] = src;
      if (locked[i]) locked[i] = false;
      frame.events.push({ type: 'symbol_copied', symbolId: src, fromIndex: i - 1, toIndex: i, byRuleId: selectRuleId });
      break;
    }
    case 'swap': {
      const [a, b] = indices;
      const tmp = working[a];
      working[a] = working[b];
      working[b] = tmp;
      // Modifying held cells un-holds them (display un-greys).
      if (locked[a]) locked[a] = false;
      if (locked[b]) locked[b] = false;
      // TWO moves: each cell's PRIOR value left it and arrived at the other cell.
      frame.events.push({ type: 'symbol_moved', symbolId: tmp, fromIndex: a, toIndex: b, byRuleId: selectRuleId });
      frame.events.push({ type: 'symbol_moved', symbolId: working[a], fromIndex: b, toIndex: a, byRuleId: selectRuleId });
      break;
    }
    case 'reroll': {
      const i = indices[0];
      const old = working[i];
      working[i] = rollSymbol(ctx.weights, ctx.rng);
      if (locked[i]) locked[i] = false; // un-hold the rerolled cell
      frame.events.push({ type: 'symbol_rerolled', symbolId: old, index: i, byRuleId: selectRuleId });
      rerolled = [i];
      break;
    }
  }

  const selStep: SpinLogStep = { label: ruleName, result: [...working], locked: [...locked] };
  if (rerolled) selStep.rerolled = rerolled;
  steps.push(selStep);
  frame.interactive = true;
  frame.pending = null;
  frame.slotIndex += 1; // advance past the resolved select rule
  return advanceCascade(frame, rules, ctx);
}
