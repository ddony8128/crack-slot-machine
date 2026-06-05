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
 * the player may pick (computed per-rule from the current claimed/locked state).
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
  claimed: boolean[];
  locked: boolean[];
  steps: SpinLogStep[];
  baseResult: SymbolType[];
  slotIndex: number;
  pending: Pending | null;
  done: boolean;
  interactive: boolean;
};

/** Write a cell only if unclaimed; returns true if it actually wrote (and claimed). */
function write(
  working: SymbolType[],
  claimed: boolean[],
  i: number,
  value: SymbolType,
): boolean {
  if (claimed[i]) return false;
  working[i] = value;
  claimed[i] = true;
  return true;
}

/**
 * Apply a single non-lock, non-select, non-meta board rule (reroll/transform).
 * Mirrors the original applyRules switch. `select` and `lock` are handled
 * elsewhere; weight/score have no board effect.
 */
function applyOne(
  rule: Rule,
  working: SymbolType[],
  claimed: boolean[],
  _locked: boolean[],
  ctx: ApplyCtx,
): void {
  const { weights, rng } = ctx;
  switch (rule.id) {
    // ---- reroll ----
    case 'four-shield':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four' && !claimed[i]) write(working, claimed, i, rollSymbol(weights, rng));
      }
      break;
    case 'four-parry': {
      const idx = working.findIndex((s, i) => s === 'four' && !claimed[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && working[idx] === 'four') {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        claimed[idx] = true;
      }
      break;
    }
    case 'gem-shuffle': {
      const idx = working.findIndex((s, i) => GEM_SET.has(s) && !claimed[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        claimed[idx] = true;
      }
      break;
    }
    case 'fruit-fish': {
      const idx = working.findIndex((s, i) => !FRUIT_SET.has(s) && !claimed[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && !FRUIT_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        claimed[idx] = true;
      }
      break;
    }
    case 'gem-fish': {
      const idx = working.findIndex((s, i) => !GEM_SET.has(s) && !claimed[i]);
      if (idx !== -1) {
        let iter = 0;
        while (iter < REROLL_CAP && !GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        claimed[idx] = true;
      }
      break;
    }

    // ---- transform ----
    case 'left-pair':
      write(working, claimed, 1, working[0]);
      break;
    case 'center-echo':
      write(working, claimed, 3, working[1]);
      break;
    case 'third-mirror':
      write(working, claimed, 2, working[4]);
      break;
    case 'first-cherry':
      write(working, claimed, 0, 'cherry');
      break;
    case 'safe-convert':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four' && !claimed[i]) write(working, claimed, i, 'ruby');
      }
      break;
    case 'zero-to-seven':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'zero' && !claimed[i]) write(working, claimed, i, 'seven');
      }
      break;
    case 'red-dye':
      for (let i = 0; i < working.length; i++) {
        if ((working[i] === 'lemon' || working[i] === 'diamond') && !claimed[i])
          write(working, claimed, i, 'cherry');
      }
      break;
    case 'blue-dye':
      for (let i = 0; i < working.length; i++) {
        if ((working[i] === 'lemon' || working[i] === 'diamond') && !claimed[i])
          write(working, claimed, i, 'sapphire');
      }
      break;

    // ---- lock rules are handled in the PRE-ROLL HOLD pass, not here. ----
    // ---- select rules are interactive — handled via Pending, not here. ----

    default:
      break;
  }
}

const SELECT_KIND: Record<string, SelectKind> = {
  'select-copy': 'copy',
  'select-swap': 'swap',
  'select-reroll': 'reroll',
};

/** Cells the player may pick for the given select rule, per the constraints. */
function selectableFor(kind: SelectKind, claimed: boolean[]): boolean[] {
  const out = claimed.map((c) => !c);
  if (kind === 'copy') {
    // eligible = unclaimed AND index >= 1 (cell[i] = cell[i-1]).
    out[0] = false;
  }
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
  const claimed: boolean[] = [false, false, false, false, false];
  const locked: boolean[] = [false, false, false, false, false];

  // --- PRE-ROLL HOLD pass: freeze locked cells to the previous spin value. ---
  for (const rule of rules) {
    if (!rule || rule.type !== 'lock') continue;
    if (rule.id === 'center-lock') {
      working[2] = ctx.previousResult[2];
      claimed[2] = true;
      locked[2] = true;
    } else if (rule.id === 'last-lock') {
      working[4] = ctx.previousResult[4];
      claimed[4] = true;
      locked[4] = true;
    } else if (rule.id === 'fruit-freeze') {
      let held = 0;
      for (let i = 0; i < ctx.previousResult.length && held < 2; i++) {
        if (FRUIT_SET.has(ctx.previousResult[i])) {
          working[i] = ctx.previousResult[i];
          claimed[i] = true;
          locked[i] = true;
          held += 1;
        }
      }
    }
  }

  const baseResult: SymbolType[] = [...working];

  const frame: CascadeFrame = {
    working,
    claimed,
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
 * Process slots from `frame.slotIndex` onward (top -> bottom), first-claim
 * semantics. PAUSES (returns with `frame.pending` set, slotIndex left on the
 * select rule) when it reaches a `select` rule that needs input. Auto-skips a
 * select rule whose constraint can't be met (pushes a "(건너뜀)" step). When all
 * slots are processed, sets `frame.done = true`.
 */
export function advanceCascade(
  frame: CascadeFrame,
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  opts: { autoSkipSelect?: boolean } = {},
): CascadeFrame {
  const { working, claimed, locked, steps } = frame;

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
      const selectable = selectableFor(kind, claimed);
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
      if (!above || above.type === 'lock' || above.id === 'copy-above') {
        steps.push({ label: 'COPY ABOVE → (none)', result: [...working], locked: [...locked] });
      } else {
        // weight/score/select rules are not board-changing here; only
        // reroll/transform re-apply a post-roll board effect.
        if (above.type === 'reroll' || above.type === 'transform') {
          applyOne(above, working, claimed, locked, ctx);
        }
        steps.push({ label: `COPY ABOVE → ${above.name}`, result: [...working], locked: [...locked] });
      }
      continue;
    }

    applyOne(rule, working, claimed, locked, ctx);
    steps.push({ label: rule.name, result: [...working], locked: [...locked] });
  }

  frame.done = true;
  return frame;
}

/**
 * Apply the pending select rule at `frame.slotIndex` with the player's chosen
 * `indices`, claim the written cell(s), push a step, then resume advancing to
 * the next pause or completion. Assumes `indices` were validated by the caller.
 */
export function resolveSelection(
  frame: CascadeFrame,
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  indices: number[],
): CascadeFrame {
  const pending = frame.pending;
  if (!pending) return frame;

  const { working, claimed, locked, steps } = frame;
  const rule = rules[frame.slotIndex];
  const ruleName = rule?.name ?? pending.ruleName;

  switch (pending.kind) {
    case 'copy': {
      const i = indices[0];
      // cell[i] = cell[i-1]; claim i.
      working[i] = working[i - 1];
      claimed[i] = true;
      break;
    }
    case 'swap': {
      const [a, b] = indices;
      const tmp = working[a];
      working[a] = working[b];
      working[b] = tmp;
      claimed[a] = true;
      claimed[b] = true;
      break;
    }
    case 'reroll': {
      const i = indices[0];
      working[i] = rollSymbol(ctx.weights, ctx.rng);
      claimed[i] = true;
      break;
    }
  }

  steps.push({ label: ruleName, result: [...working], locked: [...locked] });
  frame.interactive = true;
  frame.pending = null;
  frame.slotIndex += 1; // advance past the resolved select rule
  return advanceCascade(frame, rules, ctx);
}
