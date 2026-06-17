"use client";

import type { SymbolType } from "@/types";
import { useGameStore } from "@/store/gameStore";
import SymbolView from "@/components/SymbolView";
import { play as playSound } from "@/lib/sound";

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
  /** Cells haunted this spin (RULE SLOT monster-haunt) — rendered with a 👻 badge. */
  hauntedIndices?: number[];
  /** True while the reveal sequence runs — hides the SPIN button. */
  revealing?: boolean;
  /** True during 'awaiting-selection' — cells become clickable for the player. */
  picking?: boolean;
  /** Cells the player may pick (highlight ring + cursor-pointer). */
  selectable?: number[];
  /** Cells the player has already picked (stronger accent). */
  chosen?: number[];
  /** Click handler for a selectable cell. */
  onPick?: (i: number) => void;
  /** Render bigger/heavier for the cinematic SpinStage overlay. */
  stage?: boolean;
  /** Hide the in-place SPIN button + housing chrome (used when not standalone). */
  hideSpinButton?: boolean;
};

export default function SlotMachine({
  symbols,
  reelRolling = [],
  flashIndices = [],
  landIndices = [],
  stepLabel = null,
  lockedIndices = [],
  hauntedIndices = [],
  revealing = false,
  picking = false,
  selectable = [],
  chosen = [],
  onPick,
  stage = false,
  hideSpinButton = false,
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
  const hauntedSet = new Set(hauntedIndices);
  const selectableSet = new Set(selectable);
  const chosenSet = new Set(chosen);

  // Any cell currently rolling? Drives the housing glow on the stage.
  const anyRolling = reelRolling.some((r, i) => r && !lockedSet.has(i));
  const symbolSize = stage ? "xl" : "lg";
  const rollClass = stage ? "reel-rolling-stage" : "reel-rolling";
  const housingGlow = stage && anyRolling ? "stage-housing-glow" : "";

  return (
    <section className={stage ? "space-y-4" : "space-y-4 fade-rise"}>
      {/* Reel housing — slot-machine feel: accent frame, inner shadow, payline. */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 shadow-[inset_0_2px_18px_rgba(0,0,0,0.8),inset_0_-2px_12px_rgba(0,0,0,0.6)] ${
          stage ? "p-6 sm:p-10" : "p-4 sm:p-6"
        } ${housingGlow}`}
      >
        {/* center payline highlight */}
        <div
          aria-hidden
          className="payline-pulse pointer-events-none absolute inset-x-6 top-1/2 -z-0 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
        />

        {/* floating rule-step label (stage renders its own announce area) */}
        {stepLabel && !stage && (
          <div
            key={stepLabel + display.join(",")}
            className="rule-label-float pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2"
          >
            <span className="rounded-full bg-amber-400/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-zinc-950 shadow-lg shadow-amber-500/40 ring-1 ring-amber-200/60">
              {stepLabel}
            </span>
          </div>
        )}

        <div className="relative flex flex-nowrap items-center justify-center gap-1.5 sm:gap-3">
          {display.map((symbol, i) => {
            const isLocked = lockedSet.has(i);
            const isHaunted = hauntedSet.has(i);
            // A locked (held) cell never rolls, even if a stale rolling flag lingers.
            const rolling = reelRolling[i] && !isLocked;
            const flashing = flashSet.has(i);
            const landed = landSet.has(i);
            const isSelectable = picking && selectableSet.has(i);
            const isChosen = picking && chosenSet.has(i);
            const motion = [
              rolling ? rollClass : "",
              flashing ? "reel-flash" : "",
              !rolling && landed ? "reel-land" : "",
              // Don't grey a held cell while it's a valid pick — the dimmed
              // 'reel-locked' look reads as "disabled", but held cells ARE
              // selectable (e.g. re-park, copy into/over a held cell).
              isLocked && !isSelectable ? "reel-locked" : "",
            ]
              .filter(Boolean)
              .join(" ");
            // While picking: selectable cells get a highlight ring + pointer;
            // chosen cells get a stronger accent; the rest are dimmed/inert.
            const pickClass = picking
              ? isChosen
                ? "cursor-pointer rounded-xl ring-4 ring-amber-400 ring-offset-2 ring-offset-zinc-950 scale-105"
                : isSelectable
                  ? "cursor-pointer rounded-xl ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-zinc-950 hover:ring-emerald-300 hover:scale-105 transition"
                  : "opacity-40"
              : "";
            return (
              <div
                key={i}
                data-reel-index={i}
                className={`relative ${pickClass}`}
                role={isSelectable ? "button" : undefined}
                tabIndex={isSelectable ? 0 : undefined}
                aria-pressed={isSelectable ? isChosen : undefined}
                onClick={isSelectable ? () => onPick?.(i) : undefined}
                onKeyDown={
                  isSelectable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPick?.(i);
                        }
                      }
                    : undefined
                }
              >
                <SymbolView symbol={symbol} size={symbolSize} className={motion} />
                {isLocked && (
                  <span
                    aria-label="고정됨"
                    title="고정됨"
                    className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[11px] text-zinc-200 shadow ring-1 ring-zinc-500"
                  >
                    🔒
                  </span>
                )}
                {isHaunted && (
                  <span
                    aria-label="유령 들림"
                    title="유령 들림"
                    className="pointer-events-none absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-violet-900/80 text-[11px] text-violet-100 shadow ring-1 ring-violet-400/70"
                  >
                    👻
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {canSpin && !hideSpinButton && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              // Lever pull + reels rolling, played on the user gesture.
              playSound("lever");
              playSound("spin");
              spin();
            }}
            className="btn-breathe rounded-xl bg-amber-400 px-10 py-4 text-xl font-black tracking-wide text-zinc-950 transition hover:scale-105 hover:bg-amber-300 active:scale-95"
          >
            SPIN
          </button>
        </div>
      )}
    </section>
  );
}
