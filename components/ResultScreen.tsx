"use client";

import { useGameStore } from "@/store/gameStore";

function tierMessage(score: number): string {
  if (score < 0) return "규칙이 당신을 버렸습니다";
  if (score <= 499) return "아쉽지만 감은 잡았습니다";
  if (score <= 999) return "꽤 괜찮은 슬롯 감각입니다";
  if (score <= 1499) return "RULE MASTER";
  return "JACKPOT CONTENDER";
}

export default function ResultScreen() {
  const nickname = useGameStore((s) => s.nickname);
  const totalScore = useGameStore((s) => s.totalScore);
  const reset = useGameStore((s) => s.reset);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
        GAME RESULT
      </h1>

      <div className="w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Player</p>
          <p className="text-xl font-bold text-emerald-400">{nickname}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Final Score
          </p>
          <p className="font-mono text-5xl font-black text-amber-300">
            {totalScore}
          </p>
        </div>

        <p className="text-lg font-semibold text-zinc-200">
          {tierMessage(totalScore)}
        </p>
      </div>

      {/* TODO: Ranking registration goes here (separate localStorage task). */}

      <button
        type="button"
        onClick={reset}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
      >
        다시 하기
      </button>
    </main>
  );
}
