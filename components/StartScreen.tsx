"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import RankingPanel from "@/components/RankingPanel";
import ReferenceModal from "@/components/ReferenceModal";
import { loadRankings, clearRankings } from "@/lib/ranking";
import type { RankingRecord } from "@/types";
import { FRUITS, GEMS } from "@/data/symbols";
import SymbolView from "@/components/SymbolView";

export default function StartScreen() {
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const startGame = useGameStore((s) => s.startGame);
  const [showRef, setShowRef] = useState(false);
  const [rankings, setRankings] = useState<RankingRecord[]>([]);

  const refreshRankings = () => {
    setRankings(loadRankings());
  };

  useEffect(() => {
    // Load persisted rankings after mount so SSR/client markup matches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshRankings();
  }, []);

  const handleResetRankings = () => {
    clearRankings();
    refreshRankings();
  };

  const canStart = nickname.trim().length > 0;

  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-400 sm:text-base">
          규칙을 위→아래 순서로 배치하고, 7번의 스핀으로 최고 점수를 노려라.
        </p>
      </header>

      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canStart) startGame();
        }}
      >
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임을 입력하세요"
          maxLength={16}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none transition focus:border-emerald-400"
        />
        <button
          type="submit"
          disabled={!canStart}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          GAME START
        </button>
      </form>

      <section className="w-full max-w-sm">
        <h2 className="mb-2 text-center text-sm font-semibold tracking-wide text-zinc-400">
          TOP 5 RANKING
        </h2>
        <RankingPanel
          records={rankings}
          limit={5}
          onReset={rankings.length > 0 ? handleResetRankings : undefined}
        />
      </section>

      <section className="w-full max-w-sm space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          {[...FRUITS, ...GEMS].map((s) => (
            <SymbolView key={s} symbol={s} size="sm" />
          ))}
          {(["seven", "zero", "four"] as const).map((s) => (
            <SymbolView key={s} symbol={s} size="sm" />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowRef(true)}
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800/60"
        >
          규칙 &amp; 점수표 보기
        </button>
      </section>

      <ReferenceModal open={showRef} onClose={() => setShowRef(false)} />
    </main>
  );
}
