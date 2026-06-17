"use client";

import { useGameStore } from "@/store/gameStore";

/**
 * Puzzle-mode replacement for ScorePanel. Puzzle scoring per spin is irrelevant —
 * only whether the current board clears the goal matters — so this shows just the
 * clear / not-yet state and advances (결과 보기 when cleared or out of spins, else
 * 다음 스핀). next() ends the run immediately once puzzleCleared is set.
 */
export default function PuzzlePanel() {
  const puzzleCleared = useGameStore((s) => s.puzzleCleared);
  const spinIndex = useGameStore((s) => s.spinIndex);
  const maxSpins = useGameStore((s) => s.maxSpins);
  const next = useGameStore((s) => s.next);

  const isLastSpin = spinIndex >= maxSpins - 1;
  const spinsLeft = Math.max(0, maxSpins - (spinIndex + 1));
  const showResult = puzzleCleared || isLastSpin;

  return (
    <section className="panel-pop space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
      {puzzleCleared ? (
        <div className="space-y-1">
          <p className="text-2xl font-black tracking-tight text-emerald-300">
            🎉 클리어!
          </p>
          <p className="text-sm text-zinc-300">목표 조합을 완성했습니다.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-lg font-bold text-zinc-200">
            아직 목표 조합이 아닙니다
          </p>
          <p className="text-sm text-zinc-400">
            {isLastSpin
              ? "마지막 스핀이었습니다."
              : `남은 스핀 ${spinsLeft}회`}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={next}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.98]"
      >
        {showResult ? "결과 보기" : "다음 스핀"}
      </button>
    </section>
  );
}
