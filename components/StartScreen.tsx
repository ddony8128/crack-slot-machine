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
  const [refView, setRefView] = useState<"rules" | "scores" | null>(null);
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
          규칙을 조작하고 레버를 당겨 최고 점수를 노려라.
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

      <section className="w-full max-w-md space-y-3">
        <div className="grid grid-cols-9 place-items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-3 sm:gap-2 sm:px-4">
          {[...FRUITS, ...GEMS, "seven", "zero", "four"].map((s) => (
            <SymbolView key={s} symbol={s as never} size="sm" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRefView("rules")}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            규칙 보기
          </button>
          <button
            type="button"
            onClick={() => setRefView("scores")}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            점수표 보기
          </button>
        </div>
      </section>

      <ReferenceModal
        open={refView !== null}
        view={refView ?? "rules"}
        onClose={() => setRefView(null)}
      />
    </main>
  );
}
