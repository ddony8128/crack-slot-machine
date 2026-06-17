"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import ReferenceModal from "@/components/ReferenceModal";
import { BASE_WEIGHTS } from "@/data/symbols";

export default function StatusBar({
  hideReference = false,
}: {
  /** Hide the 규칙/점수표 buttons (puzzle mode shows its symbol pool instead). */
  hideReference?: boolean;
} = {}) {
  const nickname = useGameStore((s) => s.nickname);
  const spinIndex = useGameStore((s) => s.spinIndex);
  const maxSpins = useGameStore((s) => s.maxSpins);
  const totalScore = useGameStore((s) => s.totalScore);
  const nextMultiplier = useGameStore((s) => s.nextMultiplier);
  // The active run's symbol bag drives the pool-aware ReferenceModal. Legacy
  // (빠른 게임/이벤트) runs have no config → BASE_WEIGHTS (combo/pair hidden).
  const baseWeights = useGameStore((s) => s.runConfig?.baseWeights) ?? BASE_WEIGHTS;

  const [refView, setRefView] = useState<"rules" | "scores" | null>(null);

  const currentSpin = Math.min(spinIndex + 1, maxSpins);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Player
          </span>
          <span className="text-lg font-bold text-emerald-400">{nickname}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Spin
          </span>
          <span className="font-mono text-lg font-bold">
            {currentSpin}
            <span className="text-zinc-500"> / {maxSpins}</span>
          </span>
          {nextMultiplier > 1 && (
            <span className="value-pop rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-zinc-950 shadow shadow-amber-500/40">
              ×{nextMultiplier}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Score
          </span>
          <span className="font-mono text-lg font-bold text-amber-300">
            {totalScore}
          </span>
        </div>

        {!hideReference && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefView("rules")}
              className="rounded-lg border border-zinc-600 bg-zinc-800/70 px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-zinc-700"
            >
              규칙
            </button>
            <button
              type="button"
              onClick={() => setRefView("scores")}
              className="rounded-lg border border-zinc-600 bg-zinc-800/70 px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-zinc-700"
            >
              점수표
            </button>
          </div>
        )}
      </div>

      <ReferenceModal
        open={refView !== null}
        view={refView ?? "rules"}
        weights={baseWeights}
        onClose={() => setRefView(null)}
      />
    </>
  );
}
