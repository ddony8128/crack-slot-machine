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

export function applyRules(
  base: SymbolType[],
  rules: (Rule | null)[],
  ctx: { previousResult: SymbolType[]; weights: Record<SymbolType, number>; rng: Rng },
): { finalResult: SymbolType[]; steps: SpinLogStep[] } {
  const working: SymbolType[] = [...base];
  const steps: SpinLogStep[] = [];
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
        // no-op: nothing applicable above; still push a step noting no effect.
        steps.push({ label: 'COPY ABOVE → (none)', result: [...working] });
      } else {
        applyOne(above, working, locked, ctx);
        steps.push({ label: `COPY ABOVE → ${above.name}`, result: [...working] });
      }
      continue;
    }

    applyOne(rule, working, locked, ctx);
    steps.push({ label: rule.name, result: [...working] });
  }

  return { finalResult: [...working], steps };
}

function applyOne(
  rule: Rule,
  working: SymbolType[],
  locked: boolean[],
  ctx: ApplyCtx,
): void {
  switch (rule.id) {
    // ---- reroll ----
    case 'four-shield':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four' && !locked[i]) {
          working[i] = rollSymbol(ctx.weights, ctx.rng);
        }
      }
      break;
    case 'zero-break':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'zero' && !locked[i]) {
          working[i] = rollSymbol(ctx.weights, ctx.rng);
        }
      }
      break;
    case 'four-parry': {
      const idx = working.findIndex((s, i) => s === 'four' && !locked[i]);
      if (idx !== -1) working[idx] = rollSymbol(ctx.weights, ctx.rng);
      break;
    }
    case 'gem-shuffle': {
      const idx = working.findIndex((s, i) => GEM_SET.has(s) && !locked[i]);
      if (idx !== -1) working[idx] = rollSymbol(ctx.weights, ctx.rng);
      break;
    }
    case 'fruit-fish': {
      const idx = working.findIndex((s, i) => !FRUIT_SET.has(s) && !locked[i]);
      if (idx !== -1) working[idx] = rollSymbol(ctx.weights, ctx.rng);
      break;
    }
    case 'number-spin':
      for (let i = 0; i < working.length; i++) {
        if (!locked[i] && (working[i] === 'seven' || working[i] === 'zero' || working[i] === 'four')) {
          working[i] = rollSymbolFrom(NUMBERS, ctx.weights, ctx.rng);
        }
      }
      break;
    case 'unique-second': {
      if (locked[1]) break;
      let iter = 0;
      while (
        iter < 30 &&
        working.some((s, i) => i !== 1 && s === working[1])
      ) {
        working[1] = rollSymbol(ctx.weights, ctx.rng);
        iter += 1;
      }
      break;
    }

    // ---- transform ----
    case 'edge-mirror':
      working[4] = working[0];
      break;
    case 'left-pair':
      working[1] = working[0];
      break;
    case 'center-echo':
      working[3] = working[1];
      break;
    case 'third-first':
      working[2] = working[0];
      break;
    case 'first-cherry':
      working[0] = 'cherry';
      break;
    case 'lucky-convert': {
      const idx = working.indexOf('zero');
      if (idx !== -1) working[idx] = 'seven';
      break;
    }
    case 'safe-convert': {
      const idx = working.indexOf('four');
      if (idx !== -1) working[idx] = 'zero';
      break;
    }
    case 'zero-to-seven':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'zero') working[i] = 'seven';
      }
      break;
    case 'diamond-to-lemon':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'diamond') working[i] = 'lemon';
      }
      break;
    case 'grape-to-sapphire':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'grape') working[i] = 'sapphire';
      }
      break;
    case 'red-dye':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'ruby') working[i] = 'cherry';
      }
      break;

    // ---- lock ----
    case 'center-lock':
      working[2] = ctx.previousResult[2];
      locked[2] = true;
      break;
    case 'fourth-lock':
      working[3] = ctx.previousResult[3];
      locked[3] = true;
      break;
    case 'last-lock':
      working[4] = ctx.previousResult[4];
      locked[4] = true;
      break;

    default:
      break;
  }
}
