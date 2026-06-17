"use client";

import type { SymbolType } from "@/types";
import SlotMachine from "@/components/SlotMachine";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type SpinStageProps = {
  /** Symbols to display on the big reels. */
  symbols: SymbolType[];
  /** Per-reel rolling flags. */
  reelRolling: boolean[];
  /** Cells flashing as a rule rewrites them. */
  flashIndices: number[];
  /** Cells that just landed. */
  landIndices: number[];
  /** Current rule-step label, announced prominently above the reels. */
  stepLabel: string | null;
  /** Cells frozen by a lock rule. */
  lockedIndices: number[];
  /** Cells haunted this spin (RULE SLOT monster-haunt) — rendered with a 👻 badge. */
  hauntedIndices?: number[];

  /** True during 'awaiting-selection' — reels become clickable. */
  picking: boolean;
  /** Cells the player may pick. */
  selectable: number[];
  /** Cells the player has already picked. */
  chosen: number[];
  /** Click handler for a selectable cell. */
  onPick: (i: number) => void;
  /** Picking prompt text (e.g. "복사할 칸을 선택하세요"). */
  promptText: string;
  /** Rule name driving the current selection. */
  pickRuleName?: string;
  /** Variable-count select (park 유료 주차): show a confirm button instead of auto-resolving. */
  confirmable?: boolean;
  /** Disable the confirm button (e.g. nothing picked yet). */
  confirmDisabled?: boolean;
  /** Confirm button label. */
  confirmLabel?: string;
  /** Commit the current selection (variable-count select only). */
  onConfirm?: () => void;
};

/**
 * Cinematic, full-screen centered overlay that takes over while a spin is
 * actively revealing OR while the player must pick cells. Dims/blurs the rest
 * of the UI and shows large reels with prominent per-rule announcements.
 *
 * All extra motion (shake/blur/glow) is gated behind prefers-reduced-motion via
 * CSS; the SlotMachine itself already respects reduced motion for cell roll.
 */
export default function SpinStage({
  symbols,
  reelRolling,
  flashIndices,
  landIndices,
  stepLabel,
  lockedIndices,
  hauntedIndices,
  picking,
  selectable,
  chosen,
  onPick,
  promptText,
  pickRuleName,
  confirmable,
  confirmDisabled,
  confirmLabel,
  onConfirm,
}: SpinStageProps) {
  const reduced = useReducedMotion();

  // Screen shake only while reels are actively rolling and not picking.
  const rolling = !picking && reelRolling.some((r) => r);
  const shakeClass = !reduced && rolling ? "stage-shake" : "";
  const riseClass = reduced ? "" : "stage-rise";

  // Inner content (announce area + large reels) is identical in both paths —
  // only the surrounding chrome differs.
  const inner = (
    <div className={`w-full max-w-3xl ${riseClass}`}>
      <div className={shakeClass}>
          {/* Prominent announce area ABOVE the reels. */}
          <div className="mb-6 flex min-h-[4.5rem] items-center justify-center sm:min-h-[5.5rem]">
            {picking ? (
              <div className="text-center">
                {pickRuleName && (
                  <span className="mb-2 inline-block rounded-full bg-amber-400/90 px-4 py-1 text-sm font-black uppercase tracking-wide text-zinc-950 shadow-lg shadow-amber-500/40 ring-1 ring-amber-200/60">
                    {pickRuleName}
                  </span>
                )}
                <p className="text-lg font-bold text-amber-100 sm:text-2xl">
                  {promptText}
                </p>
              </div>
            ) : stepLabel ? (
              <div
                key={stepLabel + symbols.join(",")}
                className={`text-center ${reduced ? "" : "stage-announce"}`}
              >
                <span className="inline-block rounded-2xl bg-amber-400/95 px-6 py-2 text-2xl font-black uppercase tracking-wide text-zinc-950 shadow-2xl shadow-amber-500/50 ring-2 ring-amber-200/70 sm:text-4xl">
                  {stepLabel}
                </span>
              </div>
            ) : (
              <p className="text-2xl font-black uppercase tracking-[0.3em] text-amber-300/80 sm:text-3xl">
                SPINNING
              </p>
            )}
          </div>

          {/* Large centered reels. */}
          <SlotMachine
            symbols={symbols}
            reelRolling={reelRolling}
            flashIndices={flashIndices}
            landIndices={landIndices}
            stepLabel={null}
            lockedIndices={lockedIndices}
            hauntedIndices={hauntedIndices}
            revealing
            picking={picking}
            selectable={selectable}
            chosen={chosen}
            onPick={onPick}
            stage
            hideSpinButton
          />

          {/* Variable-count select (유료 주차): confirm the chosen cells (1..max). */}
          {picking && confirmable && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled}
                className="rounded-xl bg-amber-400 px-8 py-3 text-lg font-black uppercase tracking-wide text-zinc-950 shadow-lg shadow-amber-500/40 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {confirmLabel ?? "확인"}
              </button>
            </div>
          )}
      </div>
    </div>
  );

  // Reduced-motion: skip the full-screen takeover (no fixed overlay, dimming, or
  // backdrop blur). Render a calm inline reveal in the normal document flow so
  // the rest of the UI — including the StatusBar 규칙/점수표 buttons — stays
  // visible and reachable in every status. Still a labelled region for AT.
  if (reduced) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900/60 px-4 py-6"
        role="group"
        aria-label={picking ? "칸 선택" : "스핀 진행 중"}
      >
        {inner}
      </div>
    );
  }

  // Full-motion: cinematic full-screen centered overlay that dims/blurs the rest
  // of the UI.
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm stage-in"
      role="dialog"
      aria-modal="true"
      aria-label={picking ? "칸 선택" : "스핀 진행 중"}
    >
      {inner}
    </div>
  );
}
