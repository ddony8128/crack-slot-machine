"use client";

import { useState } from "react";
import type { DailySetup } from "@/lib/client/dailyApi";
import { SYMBOL_SETS_BY_ID } from "@/lib/symbols/sets";
import { buildRulePool } from "@/lib/modes/config";
import { RULES_BY_ID } from "@/data/rules";
import RuleCard from "@/components/RuleCard";
import ReferenceModal from "@/components/ReferenceModal";

/**
 * §5 pre-game preview for 일일 도전: shows the day's symbol sets, the rule pool
 * the run draws from, and a link to the 족보·보너스 reference — all visible
 * BEFORE starting, so players enter knowing the day's conditions.
 */
export default function DailySetupPreview({ setup }: { setup: DailySetup }) {
  const [scoresOpen, setScoresOpen] = useState(false);

  // Always include the base number set, like the actual daily run does.
  const setIds = ["number", setup.groupASetId, setup.groupBSetId];
  const symbolSets = [setup.groupASetId, setup.groupBSetId]
    .map((id) => SYMBOL_SETS_BY_ID[id])
    .filter(Boolean);
  const ruleIds = buildRulePool(setIds, setup.basicRuleSetId);
  const rules = ruleIds.map((id) => RULES_BY_ID[id]).filter(Boolean);

  return (
    <div className="w-full space-y-4 text-left">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          오늘의 심볼 세트
        </p>
        <div className="flex flex-wrap gap-2">
          {symbolSets.map((set) => (
            <span
              key={set.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-200"
            >
              <span className="font-semibold">{set.name}</span>
              <span aria-hidden>
                {set.symbols.map((s) => s.emoji).join("")}
              </span>
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          오늘의 규칙 ({rules.length}개)
        </p>
        <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/40 p-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5"
            >
              <RuleCard rule={rule} dense />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          오늘의 족보 · 보너스
        </p>
        <button
          type="button"
          onClick={() => setScoresOpen(true)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          족보 · 점수표 보기
        </button>
      </section>

      <ReferenceModal
        open={scoresOpen}
        onClose={() => setScoresOpen(false)}
        view="scores"
      />
    </div>
  );
}
