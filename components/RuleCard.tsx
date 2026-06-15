"use client";

import type { Rule } from "@/types";
import { RULE_PHASE_LABELS, RULE_BUILD_LABELS } from "@/data/rules";

/** Compact, static rule card body (name + clean description). Used inside slots/bag. */
export default function RuleCard({
  rule,
  dense = false,
}: {
  rule: Rule;
  dense?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-emerald-300">{rule.name}</span>
        <span className="rounded-full border border-indigo-700/60 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-indigo-300">
          {RULE_PHASE_LABELS[rule.phase]}
        </span>
        {rule.build && RULE_BUILD_LABELS[rule.build] && (
          <span className="rounded-full border border-zinc-600/60 bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-zinc-300">
            {RULE_BUILD_LABELS[rule.build]}
          </span>
        )}
      </div>
      {!dense && (
        <span className="text-xs leading-snug text-zinc-400">
          {rule.description}
        </span>
      )}
    </div>
  );
}
