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
  FOURS_4_MULT,
  FOURS_5_MULT,
} from "@/data/scoreTable";

// Build keys -> clean Korean section headers.
const BUILD_ORDER = ["7", "fruit", "gem", "color", "order", "safe", "score"];
const BUILD_LABEL: Record<string, string> = {
  "7": "7/잭팟",
  fruit: "과일",
  gem: "보석",
  color: "컬러",
  order: "순서",
  safe: "안전",
  score: "점수",
};

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

function ScoreCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </h4>
      <ul className="space-y-1 text-sm">{children}</ul>
    </div>
  );
}

export default function ReferenceModal({
  open,
  onClose,
  view = "rules",
}: {
  open: boolean;
  onClose: () => void;
  view?: "rules" | "scores";
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
              규칙 ({RULES.length})
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
                      <span className="text-sm font-bold text-emerald-300">
                        {rule.name}
                      </span>
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

            <ScoreCard title="7 점수">
              <ScoreRow label="1개" value={`+${SEVEN_SCORE[1]}`} />
              <ScoreRow label="2개" value={`+${SEVEN_SCORE[2]}`} />
              <ScoreRow label="3개" value={`+${SEVEN_SCORE[3]}`} />
              <ScoreRow label="4개" value={`+${SEVEN_SCORE[4]}`} />
              <ScoreRow label="5개" value={`+${SEVEN_SCORE[5]}`} />
            </ScoreCard>

            <ScoreCard title="족보">
              <ScoreRow label="페어" value={`+${HAND_PAIR}`} />
              <ScoreRow label="투페어" value={`+${HAND_TWO_PAIR}`} />
              <ScoreRow label="트리플" value={`+${HAND_TRIPLE}`} />
              <ScoreRow label="풀하우스" value={`+${HAND_FULL_HOUSE}`} />
              <ScoreRow label="포카드" value={`+${HAND_FOUR_KIND}`} />
              <ScoreRow label="파이브카드" value={`+${HAND_FIVE_KIND}`} />
              <li className="pt-1 text-[11px] leading-snug text-zinc-500">
                ※ 족보는 과일과 보석에 대해서만 적용됩니다 (숫자 7·0·4 제외).
              </li>
            </ScoreCard>

            <ScoreCard title="색·종류 보너스">
              <ScoreRow label="과일 3종" value={`+${BONUS_ALL_FRUIT_TYPES}`} />
              <ScoreRow label="보석 3종" value={`+${BONUS_ALL_GEM_TYPES}`} />
              <ScoreRow label="올 과일" value={`+${BONUS_ONLY_FRUITS}`} />
              <ScoreRow label="올 보석" value={`+${BONUS_ONLY_GEMS}`} />
              <ScoreRow
                label="올 블루 (사파이어🔵·포도🍇)"
                value={`+${BONUS_ALL_BLUE}`}
              />
              <ScoreRow
                label="올 레드 (루비🔴·체리🍒)"
                value={`+${BONUS_ALL_RED}`}
              />
            </ScoreCard>

            <ScoreCard title="4 페널티">
              <ScoreRow
                label="개당"
                value={`-${FOUR_PENALTY_PER}`}
                negative
              />
            </ScoreCard>

            <ScoreCard title="특수 족보">
              <ScoreRow label="0이 3개 이상" value="규칙 1장 추가" />
              <ScoreRow label="4가 4개" value={`점수 ×${FOURS_4_MULT}`} />
              <ScoreRow label="4가 5개" value={`점수 ×${FOURS_5_MULT}`} />
              <li className="pt-1 text-[11px] leading-snug text-zinc-500">
                ※ 특수 족보의 효과는 다음 스핀에만 적용됩니다.
              </li>
            </ScoreCard>
          </section>
          )}
        </div>
      </div>
    </div>
  );
}
