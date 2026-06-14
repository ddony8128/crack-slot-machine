import type { Rule, SelectKind, SpinLogStep, SymbolType } from '@/types';
import { FRUITS, GEMS } from '@/data/symbols';
import { rollSymbol, type Rng } from '@/lib/rng';

export type ApplyCtx = {
  previousResult: SymbolType[];
  weights: Record<SymbolType, number>;
  rng: Rng;
};

const FRUIT_SET = new Set<SymbolType>(FRUITS);
const GEM_SET = new Set<SymbolType>(GEMS);

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
};

/**
 * Write a cell UNLESS it is frozen by a lock. Under the PURE SEQUENTIAL model a
 * later rule freely overwrites whatever an earlier rule wrote — the ONLY cell a
 * rule may never touch is a `locked` (pre-roll held) cell. Returns true if it
 * actually wrote.
 */
function write(
  working: SymbolType[],
  locked: boolean[],
  i: number,
  value: SymbolType,
): boolean {
  if (locked[i]) return false;
  working[i] = value;
  return true;
}

/**
 * Apply a single non-lock, non-select, non-meta board rule (reroll/transform).
 * Mirrors the original applyRules switch. `select` and `lock` are handled
 * elsewhere; weight/score have no board effect.
 *
 * PURE SEQUENTIAL: each rule writes its target(s) freely, overwriting any earlier
 * change; the only off-limits cells are `locked` (pre-roll held) ones. "leftmost
 * X" targeting therefore skips only LOCKED cells, never previously-written ones.
 *
 * Returns the indices that were given a FRESH RANDOM ROLL (reroll rules only) so
 * the reveal can animate them even when the value repeats. Transforms return [].
 */
function applyOne(
  rule: Rule,
  working: SymbolType[],
  locked: boolean[],
  ctx: ApplyCtx,
): number[] {
  const { weights, rng } = ctx;
  switch (rule.id) {
    // ---- reroll ----
    case 'four-shield': {
      const rolled: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four' && !locked[i]) {
          write(working, locked, i, rollSymbol(weights, rng));
          rolled.push(i);
        }
      }
      return rolled;
    }
    case 'four-parry': {
      const idx = working.findIndex((s, i) => s === 'four' && !locked[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && working[idx] === 'four') {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        return [idx];
      }
      return [];
    }
    case 'gem-shuffle': {
      const idx = working.findIndex((s, i) => GEM_SET.has(s) && !locked[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        return [idx];
      }
      return [];
    }
    case 'fruit-fish': {
      const idx = working.findIndex((s, i) => !FRUIT_SET.has(s) && !locked[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && !FRUIT_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        return [idx];
      }
      return [];
    }
    case 'gem-fish': {
      const idx = working.findIndex((s, i) => !GEM_SET.has(s) && !locked[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && !GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        return [idx];
      }
      return [];
    }

    // ---- transform ----
    case 'left-pair':
      write(working, locked, 1, working[0]);
      return [];
    case 'center-echo':
      write(working, locked, 3, working[1]);
      return [];
    case 'third-mirror':
      write(working, locked, 2, working[4]);
      return [];
    case 'first-cherry':
      write(working, locked, 0, 'cherry');
      return [];
    case 'safe-convert':
      for (let i = 0; i < working.length; i++) {
        if ((working[i] === 'four' || working[i] === 'zero') && !locked[i])
          write(working, locked, i, 'ruby');
      }
      return [];
    case 'zero-to-seven':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'zero' && !locked[i]) write(working, locked, i, 'seven');
      }
      return [];
    case 'red-dye':
      for (let i = 0; i < working.length; i++) {
        if ((working[i] === 'lemon' || working[i] === 'diamond') && !locked[i])
          write(working, locked, i, 'cherry');
      }
      return [];
    case 'blue-dye':
      for (let i = 0; i < working.length; i++) {
        if ((working[i] === 'lemon' || working[i] === 'diamond') && !locked[i])
          write(working, locked, i, 'sapphire');
      }
      return [];

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

/**
 * Cells the player may pick for the given select rule. The player can act on ANY
 * cell that is not FROZEN by a lock rule. Under the pure sequential model the
 * select rule simply overwrites whatever earlier rules wrote — only the greyed/🔒
 * locked cells are off-limits. (`select-copy` also excludes index 0, which has no
 * left neighbour to copy.)
 */
function selectableFor(kind: SelectKind, locked: boolean[]): boolean[] {
  const out = locked.map((l) => !l);
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

  // --- PRE-ROLL HOLD pass: freeze locked cells to the previous spin value. ---
  // A `copy-above` whose slot above is a lock re-applies that lock here too
  // (idempotent for center/last-lock; fruit-freeze then holds the NEXT 2 fruits).
  const prev = ctx.previousResult;
  const applyLock = (lockRule: Rule) => {
    if (lockRule.id === 'center-lock') {
      if (!locked[2]) { working[2] = prev[2]; locked[2] = true; }
    } else if (lockRule.id === 'last-lock') {
      if (!locked[4]) { working[4] = prev[4]; locked[4] = true; }
    } else if (lockRule.id === 'fruit-freeze') {
      let held = 0;
      for (let i = 0; i < prev.length && held < 2; i++) {
        if (FRUIT_SET.has(prev[i]) && !locked[i]) {
          working[i] = prev[i];
          locked[i] = true;
          held += 1;
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
  };

  return advanceCascade(frame, rules, ctx, opts);
}

/**
 * Process slots from `frame.slotIndex` onward (top -> bottom) under PURE
 * SEQUENTIAL semantics: each rule overwrites whatever earlier rules wrote, the
 * only off-limits cells being pre-roll `locked` ones. PAUSES (returns with
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
        steps.push({ label: `${rule.name} → (none)`, result: [...working], locked: [...locked] });
        continue;
      }
      if (above.type === 'lock') {
        // The lock (and this copy of it) were already applied in the pre-roll
        // HOLD pass; just acknowledge it here (board already reflects the hold).
        steps.push({ label: `${rule.name} → ${above.name}`, result: [...working], locked: [...locked] });
        continue;
      }
      if (above.type === 'select') {
        // Re-run the above SELECT rule: another interactive pick (or auto-skip).
        const kind = SELECT_KIND[above.id];
        const selectable = selectableFor(kind, locked);
        if (opts.autoSkipSelect || !isApplicable(kind, selectable)) {
          steps.push({ label: `${rule.name} → ${above.name} (건너뜀)`, result: [...working], locked: [...locked] });
          continue;
        }
        // Pause here (slotIndex stays on the copy-above slot) for the player.
        frame.pending = { kind, ruleName: `${rule.name} → ${above.name}`, selectable };
        return frame;
      }
      // weight/score rules are not board-changing here; only reroll/transform
      // re-apply a post-roll board effect.
      let copyRolled: number[] = [];
      if (above.type === 'reroll' || above.type === 'transform') {
        copyRolled = applyOne(above, working, locked, ctx);
      }
      const copyStep: SpinLogStep = { label: `${rule.name} → ${above.name}`, result: [...working], locked: [...locked] };
      if (copyRolled.length) copyStep.rerolled = copyRolled;
      steps.push(copyStep);
      continue;
    }

    const rolled = applyOne(rule, working, locked, ctx);
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
 * Assumes `indices` were validated by the caller (selectable cells exclude locked
 * ones, so the write is always safe). Under the pure sequential model the select
 * rule simply overwrites the chosen cells.
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

  // SELECT REROLL gives the chosen cell a fresh random roll, so it must animate
  // even if the value repeats. copy/swap are deterministic — a no-visible-change
  // there genuinely means the board is identical, so no rerolled hint is needed.
  let rerolled: number[] | undefined;
  switch (pending.kind) {
    case 'copy': {
      const i = indices[0];
      // cell[i] = cell[i-1].
      working[i] = working[i - 1];
      break;
    }
    case 'swap': {
      const [a, b] = indices;
      const tmp = working[a];
      working[a] = working[b];
      working[b] = tmp;
      break;
    }
    case 'reroll': {
      const i = indices[0];
      working[i] = rollSymbol(ctx.weights, ctx.rng);
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
