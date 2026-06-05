"use client";

import type { Rule } from "@/types";

const BUILD_TAG_STYLE: Record<string, string> = {
  "7": "bg-amber-500/15 text-amber-300 ring-amber-400/40",
  fruit: "bg-lime-500/15 text-lime-300 ring-lime-400/40",
  gem: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/40",
  "gem/blue": "bg-cyan-500/15 text-cyan-300 ring-cyan-400/40",
  red: "bg-rose-500/15 text-rose-300 ring-rose-400/40",
  order: "bg-violet-500/15 text-violet-300 ring-violet-400/40",
  safe: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40",
  "7/safe": "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40",
  "anti-gem": "bg-orange-500/15 text-orange-300 ring-orange-400/40",
  score: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/40",
  "score/safe": "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/40",
};

const TYPE_LABEL: Record<Rule["type"], string> = {
  weight: "확률",
  reroll: "리롤",
  transform: "변환",
  lock: "고정",
  score: "점수",
  meta: "메타",
};

export function BuildTag({ rule }: { rule: Rule }) {
  const tagStyle =
    (rule.build && BUILD_TAG_STYLE[rule.build]) ??
    "bg-zinc-700/40 text-zinc-300 ring-zinc-500/40";
  return (
    <span className="flex flex-wrap items-center gap-1">
      {rule.build && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${tagStyle}`}
        >
          {rule.build}
        </span>
      )}
      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-zinc-700">
        {TYPE_LABEL[rule.type]}
      </span>
    </span>
  );
}

/** Compact, static rule card body (name + desc + tags). Used inside slots/bag. */
export default function RuleCard({
  rule,
  dense = false,
}: {
  rule: Rule;
  dense?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-emerald-300">{rule.name}</span>
        <BuildTag rule={rule} />
      </div>
      {!dense && (
        <span className="text-xs leading-snug text-zinc-400">
          {rule.description}
        </span>
      )}
    </div>
  );
}
