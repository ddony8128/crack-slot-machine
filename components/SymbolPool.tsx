"use client";

import type { SymbolType } from "@/types";
import { SYMBOL_SETS } from "@/lib/symbols/sets";
import SymbolView from "@/components/SymbolView";

/**
 * Shows which symbols can roll in a run, grouped by set (only sets with at least
 * one symbol at weight > 0). Used where the 점수표 isn't relevant — puzzle mode and
 * the 첨탑 심볼 주머니 — so the player can see the actual symbol pool + names.
 *
 * `showWeights` surfaces each symbol's roll WEIGHT (count) and its share of the
 * total bag, e.g. "0 ×9 (45%)". The weight IS the probability — essential for the
 * 첨탑 주머니 where counts vary (0×9, 7×3, 세트심볼 ×1); puzzle bags are uniform so
 * it's left off there.
 */
export default function SymbolPool({
  weights,
  showWeights = false,
  className = "",
}: {
  weights: Record<SymbolType, number>;
  showWeights?: boolean;
  className?: string;
}) {
  const total = (Object.values(weights) as number[]).reduce(
    (a, w) => a + (w > 0 ? w : 0),
    0,
  );
  const presentSets = SYMBOL_SETS.map((set) => ({
    set,
    symbols: set.symbols.filter((s) => (weights[s.id as SymbolType] ?? 0) > 0),
  })).filter((g) => g.symbols.length > 0);

  if (presentSets.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {presentSets.map(({ set, symbols }) => (
        <div key={set.id} className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
            {set.name}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {symbols.map((s) => {
              const w = weights[s.id as SymbolType] ?? 0;
              const pct = total > 0 ? Math.round((w / total) * 100) : 0;
              return (
                <span key={s.id} className="flex flex-col items-center gap-0.5">
                  <SymbolView symbol={s.id as SymbolType} size="sm" />
                  <span className="text-[10px] leading-none text-zinc-500">
                    {s.name}
                  </span>
                  {showWeights && (
                    <span className="text-[10px] font-bold leading-none text-amber-300/80">
                      ×{w} ({pct}%)
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
