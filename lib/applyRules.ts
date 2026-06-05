import type { Rule, SpinLogStep, SymbolType } from '@/types';
import { beginCascade, type ApplyCtx } from '@/lib/cascade';

export type { ApplyCtx } from '@/lib/cascade';

/**
 * Apply equipped slot rules to a freshly-rolled board — the PURE, non-interactive
 * path. A thin wrapper over the resumable cascade engine (lib/cascade.ts) that
 * runs begin -> advance to completion with `autoSkipSelect: true`, so any
 * `select` rule is auto-skipped (no pause). The interactive store path uses
 * beginCascade/advanceCascade/resolveSelection directly to PAUSE for input.
 *
 * MODEL: locks are PRE-ROLL HOLD (absolute); every other rule applies top→bottom
 * and a LATER rule overwrites whatever an earlier rule wrote (pure sequential —
 * no first-claim). The only cells a rule may never touch are the pre-roll locked
 * ones. See docs/RULESLOT_SPEC.md §5 for the full semantics.
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
  const frame = beginCascade(base, rules, ctx, { autoSkipSelect: true });
  return {
    finalResult: [...frame.working],
    steps: frame.steps,
    locked: frame.locked,
    baseResult: frame.baseResult,
  };
}
