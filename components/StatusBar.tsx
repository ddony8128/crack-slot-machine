"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import ReferenceModal from "@/components/ReferenceModal";

export default function StatusBar() {
  const nickname = useGameStore((s) => s.nickname);
  const spinIndex = useGameStore((s) => s.spinIndex);
  const maxSpins = useGameStore((s) => s.maxSpins);
  const totalScore = useGameStore((s) => s.totalScore);
  const nextMultiplier = useGameStore((s) => s.nextMultiplier);

  const [showRef, setShowRef] = useState(false);

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

        <button
          type="button"
          onClick={() => setShowRef(true)}
          className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          규칙/족보
        </button>
      </div>

      <ReferenceModal open={showRef} onClose={() => setShowRef(false)} />
    </>
  );
}
