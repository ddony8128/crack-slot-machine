"use client";

import { useGameStore } from "@/store/gameStore";
import SymbolView from "@/components/SymbolView";

export default function SlotMachine() {
  const currentResult = useGameStore((s) => s.currentResult);
  const status = useGameStore((s) => s.status);
  const spin = useGameStore((s) => s.spin);

  const canSpin = status === "ready-to-spin";

  return (
    <section className="space-y-4">
      {/* Reels — structured so animation can target each cell later. */}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:gap-3 sm:p-6">
        {currentResult.map((symbol, i) => (
          <div key={i} data-reel-index={i}>
            <SymbolView symbol={symbol} size="lg" />
          </div>
        ))}
      </div>

      {canSpin && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={spin}
            className="rounded-xl bg-amber-400 px-10 py-4 text-xl font-black tracking-wide text-zinc-950 transition hover:bg-amber-300"
          >
            SPIN
          </button>
        </div>
      )}
    </section>
  );
}
