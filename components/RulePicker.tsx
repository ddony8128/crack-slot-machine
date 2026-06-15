"use client";

import { useGameStore } from "@/store/gameStore";
import { RULE_PHASE_LABELS, RULE_BUILD_LABELS } from "@/data/rules";

export default function RulePicker() {
  const offeredRules = useGameStore((s) => s.offeredRules);
  const selectRule = useGameStore((s) => s.selectRule);
  const picksLeft = useGameStore((s) => s.picksLeft);

  return (
    <section className="fade-rise space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">장착할 규칙을 선택하세요</h2>
        {picksLeft > 1 && (
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/40">
            🎁 0 보너스 · 이번 턴 {picksLeft}장 선택
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {offeredRules.map((rule) => (
          <button
            key={rule.id}
            type="button"
            onClick={() => selectRule(rule)}
            className="flex flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-zinc-800/60 hover:shadow-lg hover:shadow-emerald-500/10 active:translate-y-0 active:scale-[0.99]"
          >
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-bold text-emerald-300">
                {rule.name}
              </span>
              <span className="rounded-full border border-indigo-700/60 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-indigo-300">
                {RULE_PHASE_LABELS[rule.phase]}
              </span>
              {rule.build && RULE_BUILD_LABELS[rule.build] && (
                <span className="rounded-full border border-zinc-600/60 bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-zinc-300">
                  {RULE_BUILD_LABELS[rule.build]}
                </span>
              )}
            </span>
            <span className="text-sm leading-snug text-zinc-400">
              {rule.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
