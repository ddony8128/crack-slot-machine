"use client";

import type { SpinLog } from "@/types";
import { useGameStore } from "@/store/gameStore";

export default function ScorePanel({ log }: { log: SpinLog }) {
  const totalScore = useGameStore((s) => s.totalScore);
  const spinIndex = useGameStore((s) => s.spinIndex);
  const maxSpins = useGameStore((s) => s.maxSpins);
  const extraRulePickCount = useGameStore((s) => s.extraRulePickCount);
  const next = useGameStore((s) => s.next);

  const isLastSpin = spinIndex === maxSpins - 1;

  let nextLabel = "다음 스핀";
  if (extraRulePickCount > 0) {
    nextLabel = "추가 규칙 선택";
  } else if (isLastSpin) {
    nextLabel = "결과 보기";
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
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
          <dt className="text-zinc-400">족보 점수</dt>
          <dd className="font-mono text-emerald-300">+{log.handScore}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">페널티</dt>
          <dd className="font-mono text-rose-400">
            {log.penalty > 0 ? `-${log.penalty}` : "0"}
          </dd>
        </div>
        <div className="flex justify-between border-t border-zinc-800 pt-1.5">
          <dt className="font-semibold text-zinc-200">이번 스핀 점수</dt>
          <dd
            className={`font-mono font-bold ${
              log.roundScore < 0 ? "text-rose-400" : "text-amber-300"
            }`}
          >
            {log.roundScore >= 0 ? `+${log.roundScore}` : log.roundScore}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">누적 점수</dt>
          <dd className="font-mono font-bold text-amber-300">{totalScore}</dd>
        </div>
      </dl>

      {log.ruleDraw && (
        <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-center text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/40">
          RULE DRAW!{" "}
          {isLastSpin ? "보너스 점수 획득" : "추가 규칙 선택 기회 획득"}
        </div>
      )}

      <button
        type="button"
        onClick={next}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400"
      >
        {nextLabel}
      </button>
    </section>
  );
}
