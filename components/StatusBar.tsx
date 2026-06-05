"use client";

import { useGameStore } from "@/store/gameStore";

export default function StatusBar() {
  const nickname = useGameStore((s) => s.nickname);
  const spinIndex = useGameStore((s) => s.spinIndex);
  const maxSpins = useGameStore((s) => s.maxSpins);
  const totalScore = useGameStore((s) => s.totalScore);

  const currentSpin = Math.min(spinIndex + 1, maxSpins);

  return (
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
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Score
        </span>
        <span className="font-mono text-lg font-bold text-amber-300">
          {totalScore}
        </span>
      </div>
    </div>
  );
}
