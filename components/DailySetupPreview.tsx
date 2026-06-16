"use client";

import { useState } from "react";
import type { DailySetup } from "@/lib/client/dailyApi";
import type { SymbolType } from "@/types";
import { SYMBOL_SETS_BY_ID } from "@/lib/symbols/sets";
import { buildRulePool } from "@/lib/modes/config";
import { RULES_BY_ID } from "@/data/rules";
import { PAIR_RULES_BY_ID } from "@/lib/pairRules";
import { COMBO_RULE_SETS } from "@/lib/rules/combos";
import { GENERAL_RULE_IDS, RULE_SETS_BY_ID } from "@/lib/rules/sets";
import { dailySeed } from "@/lib/daily/challenge";
import { dailyBagWeights } from "@/lib/daily/run";
import { initialBoardFor } from "@/lib/board/initialBoard";
import RuleCard from "@/components/RuleCard";
import ReferenceModal from "@/components/ReferenceModal";

/** Emoji for any symbol id across all sets (number + rotating sets). */
const EMOJI_BY_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.values(SYMBOL_SETS_BY_ID).flatMap((set) =>
    set.symbols.map((s) => [s.id, s.emoji] as const),
  ),
);

/** Which "kind" a rule belongs to, for the 기본/세트/조합 grouping. */
type RuleKind = "basic" | "set" | "combo";

function classifyRule(
  ruleId: string,
  basicRuleSetId: string,
  setIds: string[],
): RuleKind {
  // 조합(A–B): pair-bonus rules and combo board-effect rules join only when both
  // of two sets are present.
  if (PAIR_RULES_BY_ID[ruleId] || COMBO_RULE_SETS[ruleId]) return "combo";
  // 기본: the named basic rule set's rules (incl. the general fallbacks).
  const basicIds =
    RULE_SETS_BY_ID[basicRuleSetId]?.ruleIds ?? GENERAL_RULE_IDS;
  if (basicIds.includes(ruleId)) return "basic";
  // 세트: a rule contributed by one of the day's symbol sets.
  for (const setId of setIds) {
    if (SYMBOL_SETS_BY_ID[setId]?.ruleIds.includes(ruleId)) return "set";
  }
  return "set";
}

const KIND_LABEL: Record<RuleKind, string> = {
  basic: "기본 규칙",
  set: "세트 규칙",
  combo: "조합 규칙 (A·B)",
};
const KIND_ORDER: RuleKind[] = ["basic", "set", "combo"];

/**
 * §5 pre-game preview for 일일 도전: shows the day's THREE symbol sets (숫자 + A +
 * B) with each symbol's emoji and Korean name, the seeded 시작 조합 (initial
 * board), the rule pool grouped into 기본/세트/조합(A·B), and a link to the
 * 족보·보너스 reference — all visible BEFORE starting.
 */
export default function DailySetupPreview({
  setup,
  dateKey,
}: {
  setup: DailySetup;
  dateKey: string;
}) {
  const [scoresOpen, setScoresOpen] = useState(false);

  // Always include the base number set, like the actual daily run does.
  const setIds = ["number", setup.groupASetId, setup.groupBSetId];
  const sets = setIds.map((id) => SYMBOL_SETS_BY_ID[id]).filter(Boolean);

  // The seeded starting board (same derivation as the run): seed + the day's bag.
  const seed = dailySeed(dateKey);
  const weights = dailyBagWeights(setup.groupASetId, setup.groupBSetId);
  const initialBoard = initialBoardFor(seed, weights) as SymbolType[];

  const ruleIds = buildRulePool(setIds, setup.basicRuleSetId);
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    rules: ruleIds
      .filter(
        (id) =>
          RULES_BY_ID[id] &&
          classifyRule(id, setup.basicRuleSetId, setIds) === kind,
      )
      .map((id) => RULES_BY_ID[id]),
  })).filter((g) => g.rules.length > 0);

  return (
    <div className="w-full space-y-4 text-left">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          오늘의 심볼 세트 (숫자 + 2세트)
        </p>
        <div className="space-y-2">
          {sets.map((set) => (
            <div
              key={set.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5"
            >
              <p className="mb-1 text-sm font-semibold text-zinc-200">
                {set.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {set.symbols.map((sym) => (
                  <span
                    key={sym.id}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-sm text-zinc-200"
                  >
                    <span aria-hidden>{sym.emoji}</span>
                    <span>{sym.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          시작 조합 (시드 고정)
        </p>
        <div className="flex justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-2">
          {initialBoard.map((sym, i) => (
            <span
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 text-xl"
              aria-label={sym}
            >
              {EMOJI_BY_SYMBOL[sym] ?? sym}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          오늘의 규칙 ({ruleIds.filter((id) => RULES_BY_ID[id]).length}개)
        </p>
        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/40 p-2">
          {grouped.map((group) => (
            <div key={group.kind} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/80">
                {KIND_LABEL[group.kind]}
              </p>
              {group.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5"
                >
                  <RuleCard rule={rule} dense />
                </div>
              ))}
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
