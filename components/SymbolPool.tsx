"use client";

import type { SymbolType } from "@/types";
import { SYMBOL_SETS } from "@/lib/symbols/sets";
import SymbolView from "@/components/SymbolView";

/**
 * Shows which symbols can roll in a run, grouped by set (only sets with at least
 * one symbol at weight > 0). Used where the 점수표 isn't relevant — puzzle mode and
 * the 첨탑 심볼 주머니 — so the player can see the actual symbol pool + names.
 */
export default function SymbolPool({
  weights,
  className = "",
}: {
  weights: Record<SymbolType, number>;
  className?: string;
}) {
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
            {symbols.map((s) => (
              <span key={s.id} className="flex flex-col items-center gap-0.5">
                <SymbolView symbol={s.id as SymbolType} size="sm" />
                <span className="text-[10px] leading-none text-zinc-500">
                  {s.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
