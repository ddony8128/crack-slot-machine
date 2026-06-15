"use client";

import { useCountUp } from "@/hooks/useCountUp";
import type { SeasonScoreChange } from "@/lib/season/scoring";

/**
 * Slot-style "your season score rose" feedback for a point-granting submit.
 * Counts up previousSeasonScore → newSeasonScore (~900ms, ease-out via
 * useCountUp) and shows the rank movement. When nothing changed it renders a
 * compact one-liner instead of replaying the count-up.
 */
export default function SeasonScoreRise({ change }: { change: SeasonScoreChange }) {
  const { newSeasonScore, delta, previousRank, newRank } = change;

  // No movement at all → quiet one-liner (no count-up drama).
  if (delta === 0 && previousRank === newRank) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-center text-sm text-zinc-300">
        시즌 점수 <span className="font-mono font-bold text-emerald-300">{newSeasonScore}</span>
        {newRank != null && (
          <>
            {" · "}
            <span className="font-mono font-bold text-amber-300">{newRank}위</span>
          </>
        )}
      </div>
    );
  }

  return <SeasonScoreRiseAnimated change={change} />;
}

function SeasonScoreRiseAnimated({ change }: { change: SeasonScoreChange }) {
  const { previousSeasonScore, newSeasonScore, delta, previousRank, newRank } = change;
  // Start at the previous total and count up to the new one over ~900ms.
  const value = useCountUp(newSeasonScore, 900, previousSeasonScore);

  return (
    <div className="w-full max-w-sm space-y-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 px-4 py-5 text-center">
      <p className="text-xs uppercase tracking-wide text-emerald-300/80">시즌 점수</p>
      <p className="font-mono text-4xl font-black text-emerald-300">{value}</p>
      {delta > 0 && (
        <p className="font-mono text-lg font-bold text-emerald-400">+{delta}</p>
      )}
      <RankLine previousRank={previousRank} newRank={newRank} />
    </div>
  );
}

function RankLine({
  previousRank,
  newRank,
}: {
  previousRank: number | null;
  newRank: number | null;
}) {
  if (newRank == null) return null;

  let text: string;
  if (previousRank == null) {
    text = `시즌 랭킹 진입! ${newRank}위`;
  } else if (newRank < previousRank) {
    text = `${previousRank}위 → ${newRank}위 (▲${previousRank - newRank}계단)`;
  } else {
    text = `현재 ${newRank}위`;
  }

  return <p className="text-sm font-semibold text-amber-200">{text}</p>;
}
