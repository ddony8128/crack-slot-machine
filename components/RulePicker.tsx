"use client";

import { useGameStore } from "@/store/gameStore";

export default function RulePicker() {
  const offeredRules = useGameStore((s) => s.offeredRules);
  const selectRule = useGameStore((s) => s.selectRule);
  const extraRulePickCount = useGameStore((s) => s.extraRulePickCount);

  return (
    <section className="fade-rise space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">
          이번 스핀에 장착할 규칙을 선택하세요
        </h2>
        {extraRulePickCount > 0 && (
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/40">
            RULE DRAW 추가 선택 x{extraRulePickCount}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {offeredRules.map((rule) => (
          <button
            key={rule.id}
            type="button"
            onClick={() => selectRule(rule)}
            className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-zinc-800/60 hover:shadow-lg hover:shadow-emerald-500/10 active:translate-y-0 active:scale-[0.99]"
          >
            <span className="text-base font-bold text-emerald-300">
              {rule.name}
            </span>
            <span className="mt-1 text-sm leading-snug text-zinc-400">
              {rule.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
