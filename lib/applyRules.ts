import type { Rule, SpinLogStep, SymbolType } from '@/types';
import { FRUITS, GEMS } from '@/data/symbols';
import { rollSymbol, type Rng } from '@/lib/rng';

type ApplyCtx = {
  previousResult: SymbolType[];
  weights: Record<SymbolType, number>;
  rng: Rng;
};

const FRUIT_SET = new Set<SymbolType>(FRUITS);
const GEM_SET = new Set<SymbolType>(GEMS);

/** Max reroll iterations for loop-until-condition rules (fish/shuffle). */
const REROLL_CAP = 30;

/**
 * Apply equipped slot rules to a freshly-rolled board.
 *
 * MODEL: locks are PRE-ROLL HOLD; everything else is "upper wins" (first-claim).
 *
 * 1. PRE-ROLL HOLD pass (before the cascade): scan ALL slot rules and for each
 *    `lock` rule freeze its cell to `previousResult` (center-lock -> cell2,
 *    last-lock -> cell4, fruit-freeze -> leftmost two FRUIT cells of
 *    previousResult), mark it claimed + locked. A held cell never spins and
 *    is ABSOLUTE — order-independent, no reroll/transform can ever touch it
 *    regardless of slot position. Locks push no steps.
 * 2. `baseResult` is captured right after the hold pass: held cells = previous
 *    value, all other cells = the raw roll. This is the effective landing board.
 * 3. Cascade pass: iterate non-lock slot rules top -> bottom, each claiming cells
 *    first-claim style among themselves ("the topmost rule touching a cell wins").
 *
 * `weight` and `score` rules have no post-roll effect here. `claimed[]` tracks the
 * first-claim state; `locked[]` tracks only cells frozen by a lock rule (used by
 * the UI to render them frozen for the entire reveal).
 */
export function applyRules(
  base: SymbolType[],
  rules: (Rule | null)[],
  ctx: ApplyCtx,
): {
  finalResult: SymbolType[];
  steps: SpinLogStep[];
  locked: boolean[];
  baseResult: SymbolType[];
} {
  const working: SymbolType[] = [...base];
  const steps: SpinLogStep[] = [];
  const claimed: boolean[] = [false, false, false, false, false];
  const locked: boolean[] = [false, false, false, false, false];

  // --- PRE-ROLL HOLD pass: freeze locked cells to the previous spin value. ---
  // Order among locks is irrelevant (different cells); locks push no steps.
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
      // Hold the leftmost two cells of previousResult whose symbol is a FRUIT.
      // If fewer than two fruits exist, hold however many there are (0/1/2).
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

  // Effective landing board: held cells = previous value, others = raw roll.
  const baseResult: SymbolType[] = [...working];

  // --- Cascade pass: non-lock rules, top -> bottom, first-claim among themselves. ---
  for (let slotIndex = 0; slotIndex < rules.length; slotIndex++) {
    const rule = rules[slotIndex];
    if (
      !rule ||
      rule.type === 'weight' ||
      rule.type === 'score' ||
      rule.type === 'lock'
    ) {
      continue;
    }

    if (rule.id === 'copy-above') {
      const above = slotIndex > 0 ? rules[slotIndex - 1] : null;
      if (!above || above.type === 'lock' || above.id === 'copy-above') {
        // lock is pre-roll (already held); nothing to duplicate on the board.
        steps.push({ label: 'COPY ABOVE → (none)', result: [...working], locked: [...locked] });
      } else {
        // weight/score rules are duplicated in computeWeights / scoreResult (no
        // board change here); only board-changing types apply a post-roll effect.
        if (above.type !== 'weight' && above.type !== 'score') {
          applyOne(above, working, claimed, locked, ctx);
        }
        steps.push({ label: `COPY ABOVE → ${above.name}`, result: [...working], locked: [...locked] });
      }
      continue;
    }

    applyOne(rule, working, claimed, locked, ctx);
    steps.push({ label: rule.name, result: [...working], locked: [...locked] });
  }

  return { finalResult: [...working], steps, locked, baseResult };
}

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

function applyOne(
  rule: Rule,
  working: SymbolType[],
  claimed: boolean[],
  locked: boolean[],
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
      // leftmost non-claimed cell == four -> reroll until it is NOT a four (cap 30), then claim.
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
      // leftmost non-claimed GEM cell -> reroll until it is NOT a gem (cap 30), then claim.
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
      // leftmost non-claimed NON-fruit cell -> reroll until it IS a fruit (cap 30), then claim.
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
      // leftmost non-claimed NON-gem cell -> reroll until it IS a gem (cap 30), then claim.
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

    default:
      break;
  }
}
