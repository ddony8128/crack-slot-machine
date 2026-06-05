"use client";

import { useEffect, useRef } from "react";
import { RULES } from "@/data/rules";
import {
  SEVEN_SCORE,
  HAND_PAIR,
  HAND_TWO_PAIR,
  HAND_TRIPLE,
  HAND_FULL_HOUSE,
  HAND_FOUR_KIND,
  HAND_FIVE_KIND,
  BONUS_ALL_FRUIT_TYPES,
  BONUS_ALL_GEM_TYPES,
  BONUS_ONLY_FRUITS,
  BONUS_ONLY_GEMS,
  BONUS_ALL_BLUE,
  BONUS_ALL_RED,
  FOUR_PENALTY_PER,
  BONUS_77,
  CLEAN_BONUS,
  FOURS_4_MULT,
  FOURS_5_MULT,
} from "@/data/scoreTable";
import { BuildTag } from "@/components/RuleCard";

const BUILD_ORDER = ["7", "fruit", "gem", "color", "order", "safe", "score"];

function groupByBuild() {
  const groups = new Map<string, typeof RULES>();
  for (const rule of RULES) {
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
  return ordered;
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

export default function ReferenceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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

  const groups = groupByBuild();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="규칙 및 점수표"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="panel-pop relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-black tracking-tight">
            <span className="text-emerald-400">규칙</span>{" "}
            <span className="text-zinc-500">&amp;</span>{" "}
            <span className="text-amber-300">점수표</span>
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

        <div className="grid flex-1 gap-6 overflow-y-auto px-5 py-5 lg:grid-cols-2">
          {/* Rules grouped by build */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-400">
              규칙 ({RULES.length}) — 빌드별
            </h3>
            {groups.map(([build, rules]) => (
              <div key={build} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {build}
                </h4>
                <ul className="space-y-1.5">
                  {rules.map((rule) => (
                    <li
                      key={rule.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-emerald-300">
                          {rule.name}
                        </span>
                        <BuildTag rule={rule} />
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

          {/* Score table */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-300">
              점수표
            </h3>

            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                7 개수 점수
              </h4>
              <ul className="space-y-1 text-sm">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <ScoreRow
                    key={n}
                    label={`7 × ${n}`}
                    value={`+${SEVEN_SCORE[n]}`}
                  />
                ))}
              </ul>
            </div>

            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                족보 (색 심볼 기준)
              </h4>
              <ul className="space-y-1 text-sm">
                <ScoreRow label="Pair (페어)" value={`+${HAND_PAIR}`} />
                <ScoreRow label="Two Pair (투페어)" value={`+${HAND_TWO_PAIR}`} />
                <ScoreRow label="Triple (트리플)" value={`+${HAND_TRIPLE}`} />
                <ScoreRow
                  label="Full House (풀하우스)"
                  value={`+${HAND_FULL_HOUSE}`}
                />
                <ScoreRow
                  label="Four of a Kind"
                  value={`+${HAND_FOUR_KIND}`}
                />
                <ScoreRow
                  label="Five of a Kind"
                  value={`+${HAND_FIVE_KIND}`}
                />
              </ul>
            </div>

            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                색 / 종류 보너스
              </h4>
              <ul className="space-y-1 text-sm">
                <ScoreRow
                  label="과일 3종 모두"
                  value={`+${BONUS_ALL_FRUIT_TYPES}`}
                />
                <ScoreRow
                  label="보석 3종 모두"
                  value={`+${BONUS_ALL_GEM_TYPES}`}
                />
                <ScoreRow label="올 과일" value={`+${BONUS_ONLY_FRUITS}`} />
                <ScoreRow label="올 보석" value={`+${BONUS_ONLY_GEMS}`} />
                <ScoreRow label="올 블루" value={`+${BONUS_ALL_BLUE}`} />
                <ScoreRow label="올 레드" value={`+${BONUS_ALL_RED}`} />
              </ul>
            </div>

            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                규칙 보너스 / 페널티
              </h4>
              <ul className="space-y-1 text-sm">
                <ScoreRow label="LUCKY SEVEN-SEVEN" value={`+${BONUS_77}`} />
                <ScoreRow label="CLEAN SWEEP (4 없음)" value={`+${CLEAN_BONUS}`} />
                <ScoreRow
                  label="4 페널티 (개당)"
                  value={`-${FOUR_PENALTY_PER}`}
                  negative
                />
              </ul>
            </div>

            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                특수 (다음 스핀)
              </h4>
              <ul className="space-y-1 text-sm">
                <ScoreRow label="0 3개 이상" value="규칙 1장 추가" />
                <ScoreRow label="4 × 4" value={`×${FOURS_4_MULT} 배수`} />
                <ScoreRow label="4 × 5" value={`×${FOURS_5_MULT} 배수`} />
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
