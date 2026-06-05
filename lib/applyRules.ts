import type { Rule, SpinLogStep, SymbolType } from '@/types';
import { FRUITS, GEMS } from '@/data/symbols';
import { rollSymbol, rollSymbolFrom, type Rng } from '@/lib/rng';

type ApplyCtx = {
  previousResult: SymbolType[];
  weights: Record<SymbolType, number>;
  rng: Rng;
};

const FRUIT_SET = new Set<SymbolType>(FRUITS);
const GEM_SET = new Set<SymbolType>(GEMS);
const NUMBERS: SymbolType[] = ['seven', 'zero', 'four'];

/**
 * Apply equipped slot rules to a freshly-rolled board.
 *
 * MODEL: "upper wins" (first-claim). Rules are applied top -> bottom (slot 0..4).
 * The FIRST rule to write a cell "claims" it; any later rule that would write the
 * same cell is skipped. So a `lock` only protects a cell when placed ABOVE the
 * reroll/transform it wants to block (the lock claims the cell first). Conversely
 * a reroll/transform placed above a lock claims the cell, and the lock then skips.
 *
 * `weight` and `score` rules have no post-roll effect here. `claimed[]` tracks the
 * first-claim state; `locked[]` tracks only cells frozen by an actual lock rule
 * (used by the UI to render them greyed-out as the reveal cascades down).
 */
export function applyRules(
  base: SymbolType[],
  rules: (Rule | null)[],
  ctx: ApplyCtx,
): { finalResult: SymbolType[]; steps: SpinLogStep[]; locked: boolean[] } {
  const working: SymbolType[] = [...base];
  const steps: SpinLogStep[] = [];
  const claimed: boolean[] = [false, false, false, false, false];
  const locked: boolean[] = [false, false, false, false, false];

  for (let slotIndex = 0; slotIndex < rules.length; slotIndex++) {
    const rule = rules[slotIndex];
    if (!rule || rule.type === 'weight' || rule.type === 'score') continue;

    if (rule.id === 'copy-above') {
      const above = slotIndex > 0 ? rules[slotIndex - 1] : null;
      if (
        !above ||
        above.type === 'weight' ||
        above.type === 'score' ||
        above.id === 'copy-above'
      ) {
        steps.push({ label: 'COPY ABOVE → (none)', result: [...working], locked: [...locked] });
      } else {
        applyOne(above, working, claimed, locked, ctx);
        steps.push({ label: `COPY ABOVE → ${above.name}`, result: [...working], locked: [...locked] });
      }
      continue;
    }

    applyOne(rule, working, claimed, locked, ctx);
    steps.push({ label: rule.name, result: [...working], locked: [...locked] });
  }

  return { finalResult: [...working], steps, locked };
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
  const { weights, rng, previousResult } = ctx;
  switch (rule.id) {
    // ---- reroll ----
    case 'four-shield':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four' && !claimed[i]) write(working, claimed, i, rollSymbol(weights, rng));
      }
      break;
    case 'zero-break':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'zero' && !claimed[i]) write(working, claimed, i, rollSymbol(weights, rng));
      }
      break;
    case 'four-parry': {
      const idx = working.findIndex((s, i) => s === 'four' && !claimed[i]);
      if (idx !== -1) write(working, claimed, idx, rollSymbol(weights, rng));
      break;
    }
    case 'gem-shuffle': {
      const idx = working.findIndex((s, i) => GEM_SET.has(s) && !claimed[i]);
      if (idx !== -1) write(working, claimed, idx, rollSymbol(weights, rng));
      break;
    }
    case 'fruit-fish': {
      const idx = working.findIndex((s, i) => !FRUIT_SET.has(s) && !claimed[i]);
      if (idx !== -1) write(working, claimed, idx, rollSymbol(weights, rng));
      break;
    }
    case 'number-spin':
      for (let i = 0; i < working.length; i++) {
        if (!claimed[i] && (working[i] === 'seven' || working[i] === 'zero' || working[i] === 'four')) {
          write(working, claimed, i, rollSymbolFrom(NUMBERS, weights, rng));
        }
      }
      break;
    case 'unique-second': {
      if (claimed[1]) break;
      let iter = 0;
      while (iter < 30 && working.some((s, i) => i !== 1 && s === working[1])) {
        working[1] = rollSymbol(weights, rng);
        iter += 1;
      }
      claimed[1] = true;
      break;
    }

    // ---- transform ----
    case 'edge-mirror':
      write(working, claimed, 4, working[0]);
      break;
    case 'left-pair':
      write(working, claimed, 1, working[0]);
      break;
    case 'center-echo':
      write(working, claimed, 3, working[1]);
      break;
    case 'third-first':
      write(working, claimed, 2, working[0]);
      break;
    case 'first-cherry':
      write(working, claimed, 0, 'cherry');
      break;
    case 'lucky-convert': {
      const idx = working.findIndex((s, i) => s === 'zero' && !claimed[i]);
      if (idx !== -1) write(working, claimed, idx, 'seven');
      break;
    }
    case 'safe-convert': {
      const idx = working.findIndex((s, i) => s === 'four' && !claimed[i]);
      if (idx !== -1) write(working, claimed, idx, 'zero');
      break;
    }
    case 'zero-to-seven':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'zero' && !claimed[i]) write(working, claimed, i, 'seven');
      }
      break;
    case 'diamond-to-lemon':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'diamond' && !claimed[i]) write(working, claimed, i, 'lemon');
      }
      break;
    case 'grape-to-sapphire':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'grape' && !claimed[i]) write(working, claimed, i, 'sapphire');
      }
      break;
    case 'red-dye':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'ruby' && !claimed[i]) write(working, claimed, i, 'cherry');
      }
      break;

    // ---- lock (claims the cell only if not already claimed = must be ABOVE to win) ----
    case 'center-lock':
      if (write(working, claimed, 2, previousResult[2])) locked[2] = true;
      break;
    case 'fourth-lock':
      if (write(working, claimed, 3, previousResult[3])) locked[3] = true;
      break;
    case 'last-lock':
      if (write(working, claimed, 4, previousResult[4])) locked[4] = true;
      break;

    default:
      break;
  }
}
