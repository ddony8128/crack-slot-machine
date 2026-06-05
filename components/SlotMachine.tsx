"use client";

import type { SymbolType } from "@/types";
import { useGameStore } from "@/store/gameStore";
import SymbolView from "@/components/SymbolView";

type SlotMachineProps = {
  /** Controlled symbol array to display. Falls back to store currentResult. */
  symbols?: SymbolType[];
  /** Per-reel rolling flags (cells spinning). */
  reelRolling?: boolean[];
  /** Cells that should flash (rewritten by a rule step). */
  flashIndices?: number[];
  /** Cells that just landed (pop-in). */
  landIndices?: number[];
  /** Floating rule-step label to overlay, or null. */
  stepLabel?: string | null;
  /** Cells frozen by a lock rule — rendered greyed with a lock badge. */
  lockedIndices?: number[];
  /** True while the reveal sequence runs — hides the SPIN button. */
  revealing?: boolean;
};

export default function SlotMachine({
  symbols,
  reelRolling = [],
  flashIndices = [],
  landIndices = [],
  stepLabel = null,
  lockedIndices = [],
  revealing = false,
}: SlotMachineProps) {
  const currentResult = useGameStore((s) => s.currentResult);
  const status = useGameStore((s) => s.status);
  const spin = useGameStore((s) => s.spin);

  const display = symbols ?? currentResult;
  // SPIN is available only when idle and ready, never during the reveal.
  const canSpin = status === "ready-to-spin" && !revealing;

  const flashSet = new Set(flashIndices);
  const landSet = new Set(landIndices);
  const lockedSet = new Set(lockedIndices);

  return (
    <section className="space-y-4 fade-rise">
      {/* Reel housing — slot-machine feel: accent frame, inner shadow, payline. */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 p-4 shadow-[inset_0_2px_18px_rgba(0,0,0,0.8),inset_0_-2px_12px_rgba(0,0,0,0.6)] sm:p-6">
        {/* center payline highlight */}
        <div
          aria-hidden
          className="payline-pulse pointer-events-none absolute inset-x-6 top-1/2 -z-0 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
        />

        {/* floating rule-step label */}
        {stepLabel && (
          <div
            key={stepLabel + display.join(",")}
            className="rule-label-float pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2"
          >
            <span className="rounded-full bg-amber-400/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-zinc-950 shadow-lg shadow-amber-500/40 ring-1 ring-amber-200/60">
              {stepLabel}
            </span>
          </div>
        )}

        <div className="relative flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {display.map((symbol, i) => {
            const isLocked = lockedSet.has(i);
            // A locked (held) cell never rolls, even if a stale rolling flag lingers.
            const rolling = reelRolling[i] && !isLocked;
            const flashing = flashSet.has(i);
            const landed = landSet.has(i);
            const motion = [
              rolling ? "reel-rolling" : "",
              flashing ? "reel-flash" : "",
              !rolling && landed ? "reel-land" : "",
              isLocked ? "reel-locked" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={i} data-reel-index={i} className="relative">
                <SymbolView symbol={symbol} size="lg" className={motion} />
                {isLocked && (
                  <span
                    aria-label="고정됨"
                    title="고정됨"
                    className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[11px] text-zinc-200 shadow ring-1 ring-zinc-500"
                  >
                    🔒
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {canSpin && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={spin}
            className="btn-breathe rounded-xl bg-amber-400 px-10 py-4 text-xl font-black tracking-wide text-zinc-950 transition hover:scale-105 hover:bg-amber-300 active:scale-95"
          >
            SPIN
          </button>
        </div>
      )}
    </section>
  );
}
