"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import RankingPanel from "@/components/RankingPanel";
import { addRankingFromGame, bestSpinScore, getRank } from "@/lib/ranking";
import type { RankingRecord } from "@/types";

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
  const spinLogs = useGameStore((s) => s.spinLogs);
  const ruleSlots = useGameStore((s) => s.ruleSlots);
  const reset = useGameStore((s) => s.reset);

  const [rankings, setRankings] = useState<RankingRecord[]>([]);
  const [recordId, setRecordId] = useState<string>("");
  const registeredRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke in dev.
    if (registeredRef.current) return;
    registeredRef.current = true;

    const best = bestSpinScore(spinLogs.map((log) => log.roundScore));
    const finalRules = ruleSlots
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => r.name);

    const updated = addRankingFromGame({
      nickname,
      score: totalScore,
      bestSpinScore: best,
      finalRules,
    });
    const newest = updated.find(
      (r) => r.score === totalScore && r.nickname === nickname,
    );
    setRankings(updated);
    setRecordId(newest?.id ?? "");
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rank = recordId ? getRank(rankings, recordId) : -1;

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

        {rank > 0 && (
          <p className="text-2xl font-black text-emerald-300">랭킹 {rank}위!</p>
        )}
      </div>

      <section className="w-full">
        <h2 className="mb-2 text-center text-sm font-semibold tracking-wide text-zinc-400">
          RANKING
        </h2>
        <RankingPanel records={rankings} highlightId={recordId} limit={10} />
      </section>

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
