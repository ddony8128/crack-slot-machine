"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchQuickLeaderboard, type QuickLeaderboard as QuickLeaderboardData } from "@/lib/client/quickApi";

type QuickRankItem = QuickLeaderboardData["items"][number];

// The fast-game ranking view (guests + members). Reads GET /api/quick/leaderboard,
// which needs no auth, and renders the top 100 rows (rank / nickname / score).
// Mirrors LeaderboardView styling but is purpose-built for the quick bucket.
export default function QuickLeaderboard() {
  const [items, setItems] = useState<QuickRankItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchQuickLeaderboard()
      .then((r) => {
        if (alive) setItems(r.items);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="fade-rise mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-2 text-lg font-bold text-zinc-100">빠른 게임 랭킹</p>
        <p className="mt-1 text-xs text-zinc-500">
          빠른 게임 점수는 시즌 랭킹에 반영되지 않습니다.
        </p>
      </header>

      <div className="min-h-[24rem]">
        {items === null && !failed ? (
          <p className="py-12 text-center text-sm text-zinc-500">불러오는 중…</p>
        ) : failed ? (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-12 text-center text-sm text-zinc-500">
            랭킹을 불러오지 못했습니다
          </div>
        ) : items && items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-12 text-center text-sm text-zinc-500">
            아직 기록이 없습니다
          </div>
        ) : (
          <ol className="space-y-1">
            {items?.map((item) => (
              <li
                key={`${item.rank}-${item.nickname}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-7 text-center font-mono font-bold text-amber-300">
                    {item.rank}
                  </span>
                  <span className="truncate font-semibold text-zinc-200">
                    {item.nickname}
                  </span>
                </span>
                <span className="font-mono font-bold text-emerald-300">
                  {item.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="text-center">
        <Link
          href="/quick"
          className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
        >
          ← 빠른 게임으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
