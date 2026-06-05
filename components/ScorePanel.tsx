"use client";

import type { SpinLog } from "@/types";
import { useGameStore } from "@/store/gameStore";
import { useCountUp } from "@/hooks/useCountUp";

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export default function ScorePanel({ log }: { log: SpinLog }) {
  const totalScore = useGameStore((s) => s.totalScore);
  const spinIndex = useGameStore((s) => s.spinIndex);
  const maxSpins = useGameStore((s) => s.maxSpins);
  const extraRulePickCount = useGameStore((s) => s.extraRulePickCount);
  const next = useGameStore((s) => s.next);

  const isLastSpin = spinIndex === maxSpins - 1;
  const animatedTotal = useCountUp(totalScore, 700);

  let nextLabel = "다음 스핀";
  if (extraRulePickCount > 0) {
    nextLabel = "추가 규칙 선택";
  } else if (isLastSpin) {
    nextLabel = "결과 보기";
  }

  const negative = log.roundScore < 0;
  const roundMotion = negative
    ? "score-shake"
    : log.roundScore >= 100
      ? "value-pop"
      : "";

  const multiplied = log.multiplier > 1;

  return (
    <section className="panel-pop space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Spin Result
        </h2>
        <span className="rounded-lg bg-zinc-800 px-3 py-1 text-sm font-bold text-emerald-300">
          {log.hand}
        </span>
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-400">족보 {log.hand !== "No Hand" ? `(${log.hand})` : ""}</dt>
          <dd className="font-mono text-emerald-300">{fmt(log.handScore)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">7 점수</dt>
          <dd className="font-mono text-amber-300">{fmt(log.sevenScore)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">보너스</dt>
          <dd className="font-mono text-emerald-300">{fmt(log.bonusScore)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">페널티</dt>
          <dd className="font-mono text-rose-400">
            {log.penalty > 0 ? `-${log.penalty}` : "0"}
          </dd>
        </div>

        {multiplied && (
          <div className="flex justify-between border-t border-zinc-800 pt-1.5">
            <dt className="text-zinc-400">
              기본 {fmt(log.baseRoundScore)} × 배수
            </dt>
            <dd className="font-mono font-bold text-amber-300">
              ×{log.multiplier}
            </dd>
          </div>
        )}

        <div className="flex justify-between border-t border-zinc-800 pt-1.5">
          <dt className="font-semibold text-zinc-200">이번 스핀 점수</dt>
          <dd
            className={`inline-block font-mono font-bold ${roundMotion} ${
              negative ? "text-rose-400" : "text-amber-300"
            }`}
          >
            {fmt(log.roundScore)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">누적 점수</dt>
          <dd className="font-mono font-bold text-amber-300">{animatedTotal}</dd>
        </div>
      </dl>

      {log.zeroDraw && (
        <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-center text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/40">
          0 3개+! 다음 스핀 전 규칙 1장 추가
        </div>
      )}
      {log.multiplierSet > 1 && (
        <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-center text-sm font-bold text-amber-300 ring-1 ring-amber-400/40">
          4 {log.multiplierSet === 4 ? 5 : 4}개! 다음 스핀 점수 ×{log.multiplierSet}
        </div>
      )}

      <button
        type="button"
        onClick={next}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.98]"
      >
        {nextLabel}
      </button>
    </section>
  );
}
