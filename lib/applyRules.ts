import type { Rule, SpinLogStep, SymbolType } from '@/types';
import { rollSymbol, type Rng } from '@/lib/rng';

type ApplyCtx = {
  previousResult: SymbolType[];
  weights: Record<SymbolType, number>;
  rng: Rng;
};

export function applyRules(
  base: SymbolType[],
  rules: (Rule | null)[],
  ctx: { previousResult: SymbolType[]; weights: Record<SymbolType, number>; rng: Rng },
): { finalResult: SymbolType[]; steps: SpinLogStep[] } {
  const working: SymbolType[] = [...base];
  const steps: SpinLogStep[] = [];

  for (const rule of rules) {
    if (!rule || rule.type === 'weight') continue;

    applyOne(rule, working, ctx);
    steps.push({ label: rule.name, result: [...working] });
  }

  return { finalResult: [...working], steps };
}

function applyOne(rule: Rule, working: SymbolType[], ctx: ApplyCtx): void {
  switch (rule.id) {
    case 'four-shield':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four') working[i] = rollSymbol(ctx.weights, ctx.rng);
      }
      break;
    case 'zero-break':
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'zero') working[i] = rollSymbol(ctx.weights, ctx.rng);
      }
      break;
    case 'edge-mirror':
      working[4] = working[0];
      break;
    case 'left-pair':
      working[1] = working[0];
      break;
    case 'center-echo':
      working[3] = working[1];
      break;
    case 'center-lock':
      working[2] = ctx.previousResult[2];
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
    default:
      break;
  }
}
