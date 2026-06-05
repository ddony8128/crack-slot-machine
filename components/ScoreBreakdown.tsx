"use client";

import type { SpinLog } from "@/types";

/**
 * Itemized "why these points" breakdown for a spin, styled like the
 * rule-application log (label left, points right). Reads log.scoreItems
 * (pre-multiplier); shows the multiplier line and the final round score.
 */
export default function ScoreBreakdown({ log }: { log: SpinLog }) {
  const items = log.scoreItems;

  return (
    <div className="fade-in space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        점수 내역
      </h3>

      {items.length === 0 && (
        <p className="text-sm text-zinc-500">획득 점수 없음</p>
      )}

      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">{it.label}</span>
          <span
            className={`font-mono ${
              it.points >= 0 ? "text-emerald-300" : "text-rose-400"
            }`}
          >
            {it.points >= 0 ? `+${it.points}` : it.points}
          </span>
        </div>
      ))}

      {log.multiplier > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-1.5 text-sm">
          <span className="text-zinc-300">배수</span>
          <span className="font-mono font-bold text-amber-300">
            ×{log.multiplier}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-800 pt-1.5">
        <span className="text-sm font-semibold text-zinc-200">이번 스핀 점수</span>
        <span
          className={`font-mono font-bold ${
            log.roundScore < 0 ? "text-rose-400" : "text-amber-300"
          }`}
        >
          {log.roundScore >= 0 ? `+${log.roundScore}` : log.roundScore}
        </span>
      </div>
    </div>
  );
}
