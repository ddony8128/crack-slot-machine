"use client";

import { useEffect, useRef } from "react";
import { RULES, RULE_PHASE_LABELS } from "@/data/rules";
import type { Rule, SymbolType } from "@/types";
import { BASE_WEIGHTS } from "@/data/symbols";
import { rulePlayable } from "@/lib/rules/playable";
import { LEGACY_EXCLUDED_BUILDS } from "@/store/gameStore";
import {
  SEVEN_SCORE,
  HAND_PAIR,
  HAND_TWO_PAIR,
  HAND_TRIPLE,
  HAND_FULL_HOUSE,
  HAND_FOUR_KIND,
  HAND_FIVE_KIND,
  FOUR_PENALTY_PER,
  FOURS_4_MULT,
  FOURS_5_MULT,
} from "@/data/scoreTable";
import {
  SYMBOL_SETS,
  SYMBOL_SETS_BY_ID,
  type SetBonus,
  type SymbolSet,
} from "@/lib/symbols/sets";
import { PAIR_RULES } from "@/lib/pairRules";

/** Does this set have ≥1 symbol that can roll in `weights`? */
function setRollable(set: SymbolSet, weights: Record<SymbolType, number>): boolean {
  return set.symbols.some((s) => (weights[s.id as SymbolType] ?? 0) > 0);
}

type PerEventTag = Extract<SetBonus, { type: "per-event" }>["event"];

// moved/rerolled/copied -> the Korean wording used in lib/score.ts.
const PER_EVENT_LABEL: Record<PerEventTag, string> = {
  moved: "이동",
  rerolled: "재굴림",
  copied: "복사",
};

/**
 * Label + display value for a single set bonus row. Pure data so the 점수표 stays
 * in lockstep with lib/score.ts's `setBonuses` wording (single source of truth).
 * Returns `negative: true` for penalty rows so the caller can color them.
 */
export function bonusRowLabel(
  set: SymbolSet,
  bonus: SetBonus,
): { label: string; value: string; negative: boolean } {
  switch (bonus.type) {
    case "all-types":
      return { label: `${set.name} 3종`, value: `+${bonus.points}`, negative: false };
    case "all-symbols":
      return { label: `올 ${set.name}`, value: `+${bonus.points}`, negative: false };
    case "per-symbol":
      return { label: `${set.name} 1개당`, value: `+${bonus.points}`, negative: false };
    case "adjacent-penalty":
      return {
        label: `이웃 ${set.name} 1개당`,
        value: `${bonus.points}`,
        negative: true,
      };
    case "per-event":
      return {
        label: `${set.name} ${PER_EVENT_LABEL[bonus.event]} 1개당`,
        value: `+${bonus.points}`,
        negative: false,
      };
  }
}

// Build keys -> clean Korean section headers.
const BUILD_ORDER = [
  "7",
  "fruit",
  "gem",
  "color",
  "order",
  "safe",
  "score",
  "cat",
  "vehicle",
  "monster",
  "combo",
  "pair",
];
const BUILD_LABEL: Record<string, string> = {
  "7": "7/잭팟",
  fruit: "과일",
  gem: "보석",
  color: "컬러",
  order: "순서",
  safe: "안전",
  score: "점수",
  cat: "고양이",
  vehicle: "교통수단",
  monster: "괴물",
  combo: "콤보 (2세트)",
  pair: "페어 (2세트)",
};

function groupByBuild(rules: Rule[]) {
  const groups = new Map<string, Rule[]>();
  for (const rule of rules) {
    const key = rule.build ?? "기타";
    const arr = groups.get(key) ?? [];
    arr.push(rule);
    groups.set(key, arr);
  }
  const ordered: Array<[string, typeof RULES]> = [];
  for (const key of BUILD_ORDER) {
    const arr = groups.get(key);
    if (arr) {
      ordered.push([key, arr]);
      groups.delete(key);
    }
  }
  for (const [key, arr] of groups) ordered.push([key, arr]);
  return ordered as Array<[string, Rule[]]>;
}

function ScoreRow({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-zinc-300">{label}</span>
      <span
        className={`font-mono font-bold ${
          negative ? "text-rose-400" : "text-emerald-300"
        }`}
      >
        {value}
      </span>
    </li>
  );
}

function ScoreCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </h4>
      {note && (
        <p className="mb-2 text-sm font-medium leading-snug text-amber-200/90">
          {note}
        </p>
      )}
      <ul className="space-y-1 text-sm">{children}</ul>
    </div>
  );
}

export default function ReferenceModal({
  open,
  onClose,
  view = "rules",
  weights = BASE_WEIGHTS,
}: {
  open: boolean;
  onClose: () => void;
  view?: "rules" | "scores";
  /**
   * The active run's symbol bag (as weights). Defaults to BASE_WEIGHTS = the
   * legacy 빠른 게임/이벤트 bag, so existing callers (StartScreen,
   * DailySetupPreview, SpireClient) compile and render unchanged. The reference
   * is filtered to match what the run actually offers/scores: only rules whose
   * symbols can roll (rulePlayable), only set bonuses for rollable sets, and —
   * on the legacy bag — combo/pair rules are hidden (mirrors the offer filter).
   */
  weights?: Record<SymbolType, number>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the dialog for accessibility.
    closeRef.current?.focus();
    // Prevent background scroll while open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Legacy = the default BASE_WEIGHTS bag (빠른 게임/이벤트). On that bag we hide
  // combo/pair rules so the reference matches the offer filter (gameStore's
  // LEGACY_EXCLUDED_BUILDS); season runs pass their own baseWeights → shown.
  const legacy = weights === BASE_WEIGHTS;
  const visibleRules = RULES.filter(
    (r) =>
      rulePlayable(r, weights) &&
      !(legacy && LEGACY_EXCLUDED_BUILDS.has(r.build ?? "")),
  );
  const groups = groupByBuild(visibleRules);

  // 세트 보너스 / 페어 보너스 are shown only for sets/pairs that can roll in this
  // run's bag, so the 점수표 reflects only achievable bonuses.
  const visibleSets = SYMBOL_SETS.filter(
    (set) => !set.isNumberSet && set.bonuses.length > 0 && setRollable(set, weights),
  );
  const visiblePairs = PAIR_RULES.filter((pair) => {
    const a = SYMBOL_SETS_BY_ID[pair.setA];
    const b = SYMBOL_SETS_BY_ID[pair.setB];
    return !!a && !!b && setRollable(a, weights) && setRollable(b, weights);
  });

  const isRules = view === "rules";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isRules ? "규칙" : "점수표"}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="panel-pop relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-black tracking-tight">
            {isRules ? (
              <span className="text-emerald-400">규칙</span>
            ) : (
              <span className="text-amber-300">점수표</span>
            )}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
          >
            닫기 (Esc)
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Rules grouped by build */}
          {isRules && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-400">
              규칙 ({visibleRules.length})
            </h3>
            {groups.map(([build, rules]) => (
              <div key={build} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {BUILD_LABEL[build] ?? build}
                </h4>
                <ul className="space-y-1.5">
                  {rules.map((rule) => (
                    <li
                      key={rule.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-emerald-300">
                          {rule.name}
                        </span>
                        <span className="rounded-full border border-indigo-700/60 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-indigo-300">
                          {RULE_PHASE_LABELS[rule.phase]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-zinc-400">
                        {rule.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          )}

          {/* Score table */}
          {!isRules && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-300">
              점수표
            </h3>

            <ScoreCard
              title="7 점수"
              note="보드에 나온 7의 개수만큼 점수를 얻는다. 많을수록 폭발적으로 커지며, 5개(잭팟)면 777점이다."
            >
              <ScoreRow label="7이 1개" value={`+${SEVEN_SCORE[1]}`} />
              <ScoreRow label="7이 2개" value={`+${SEVEN_SCORE[2]}`} />
              <ScoreRow label="7이 3개" value={`+${SEVEN_SCORE[3]}`} />
              <ScoreRow label="7이 4개" value={`+${SEVEN_SCORE[4]}`} />
              <ScoreRow label="7이 5개 (잭팟)" value={`+${SEVEN_SCORE[5]}`} />
            </ScoreCard>

            <ScoreCard
              title="족보"
              note="숫자(0·4·7)를 제외한 같은 심볼이 N개 모이면 성립한다. 과일·보석·고양이 등 세트 심볼이 대상이며, 가장 높은 족보 하나만 점수로 계산된다."
            >
              <ScoreRow label="페어 — 같은 심볼 2개" value={`+${HAND_PAIR}`} />
              <ScoreRow label="투페어 — 2개짜리 페어 2쌍" value={`+${HAND_TWO_PAIR}`} />
              <ScoreRow label="트리플 — 같은 심볼 3개" value={`+${HAND_TRIPLE}`} />
              <ScoreRow label="풀하우스 — 트리플 + 페어" value={`+${HAND_FULL_HOUSE}`} />
              <ScoreRow label="포카드 — 같은 심볼 4개" value={`+${HAND_FOUR_KIND}`} />
              <ScoreRow label="파이브카드 — 같은 심볼 5개" value={`+${HAND_FIVE_KIND}`} />
            </ScoreCard>

            {visibleSets.length > 0 && (
            <ScoreCard
              title="세트 보너스"
              note="같은 세트(과일/보석/고양이/교통수단/괴물) 심볼이 모이면 추가 점수. 세트별 효과는 아래와 같다."
            >
              {visibleSets.map((set) => (
                  <li key={set.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-xs font-bold text-zinc-400">
                      <span>{set.name}</span>
                      <span className="flex flex-wrap items-center gap-2 font-normal text-zinc-500">
                        {set.symbols.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-0.5"
                            title={s.name}
                            aria-label={s.name}
                          >
                            <span aria-hidden="true">{s.emoji}</span>
                            <span>{s.name}</span>
                          </span>
                        ))}
                      </span>
                    </div>
                    <ul className="space-y-1 pl-2">
                      {set.bonuses.map((bonus, i) => {
                        const row = bonusRowLabel(set, bonus);
                        return (
                          <ScoreRow
                            key={i}
                            label={row.label}
                            value={row.value}
                            negative={row.negative}
                          />
                        );
                      })}
                    </ul>
                  </li>
                ),
              )}
            </ScoreCard>
            )}

            {visiblePairs.length > 0 && (
            <ScoreCard
              title="페어 보너스"
              note="서로 다른 두 세트가 보드에 각각 하나 이상 있으면 주어지는 보너스."
            >
              {visiblePairs.map((pair) => (
                <li key={pair.id} className="space-y-0.5">
                  <ScoreRow label={pair.name} value={`+${pair.points}`} />
                  <p className="text-xs text-zinc-500">
                    {SYMBOL_SETS_BY_ID[pair.setA].name}+
                    {SYMBOL_SETS_BY_ID[pair.setB].name} 모두 있으면
                  </p>
                </li>
              ))}
            </ScoreCard>
            )}

            <ScoreCard
              title="4 페널티"
              note="보드의 4는 불운의 숫자다. 4 하나당 점수가 깎인다. (일부 규칙은 이 페널티를 보너스로 뒤집기도 한다.)"
            >
              <ScoreRow
                label="4 1개당"
                value={`-${FOUR_PENALTY_PER}`}
                negative
              />
            </ScoreCard>

            <ScoreCard
              title="특수 족보"
              note="특정 숫자가 일정 개수 이상 나오면 발동하는 특수 효과. ※ 효과는 모두 다음 스핀에만 적용됩니다."
            >
              <ScoreRow label="0이 3개 이상 → 규칙 추첨 1장 더" value="규칙 1장 추가" />
              <ScoreRow label="4가 4개 → 다음 스핀 점수 배수" value={`점수 ×${FOURS_4_MULT}`} />
              <ScoreRow label="4가 5개 → 다음 스핀 점수 배수" value={`점수 ×${FOURS_5_MULT}`} />
            </ScoreCard>
          </section>
          )}
        </div>
      </div>
    </div>
  );
}
