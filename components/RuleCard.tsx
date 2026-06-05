"use client";

import type { Rule } from "@/types";

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
      <span className="text-sm font-bold text-emerald-300">{rule.name}</span>
      {!dense && (
        <span className="text-xs leading-snug text-zinc-400">
          {rule.description}
        </span>
      )}
    </div>
  );
}
