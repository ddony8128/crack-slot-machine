"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import RankingPanel from "@/components/RankingPanel";
import { loadRankings, clearRankings } from "@/lib/ranking";
import type { RankingRecord } from "@/types";
import { SYMBOL_EMOJI, FRUITS, GEMS } from "@/data/symbols";
import {
  JACKPOT,
  FIVE_OF_A_KIND,
  FOUR_OF_A_KIND,
  THREE_OF_A_KIND,
  PAIR,
  ALL_FRUITS,
  ALL_GEMS,
  FOUR_PENALTY_PER,
} from "@/data/scoreTable";
import SymbolView from "@/components/SymbolView";

export default function StartScreen() {
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const startGame = useGameStore((s) => s.startGame);
  const [showHelp, setShowHelp] = useState(false);
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-400 sm:text-base">
          규칙을 장착하고 슬롯을 굴려, 5번의 스핀으로 최고 점수를 노려라.
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

      <section className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800/60"
        >
          <span>게임 도움말 (심볼 &amp; 점수표)</span>
          <span className="text-zinc-500">{showHelp ? "▲" : "▼"}</span>
        </button>

        {showHelp && (
          <div className="mt-2 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
            <div>
              <h3 className="mb-2 font-semibold text-emerald-400">심볼</h3>
              <div className="flex flex-wrap gap-2">
                {FRUITS.map((s) => (
                  <SymbolView key={s} symbol={s} size="sm" />
                ))}
                {GEMS.map((s) => (
                  <SymbolView key={s} symbol={s} size="sm" />
                ))}
                {(["seven", "zero", "four"] as const).map((s) => (
                  <SymbolView key={s} symbol={s} size="sm" />
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {SYMBOL_EMOJI.four} 는 페널티 심볼입니다.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-amber-300">점수표</h3>
              <ul className="space-y-1 text-zinc-300">
                <li className="flex justify-between">
                  <span>JACKPOT (7 7 7 7 7)</span>
                  <span className="font-mono text-emerald-300">+{JACKPOT}</span>
                </li>
                <li className="flex justify-between">
                  <span>5 of a kind</span>
                  <span className="font-mono text-emerald-300">
                    +{FIVE_OF_A_KIND}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>올 보석</span>
                  <span className="font-mono text-emerald-300">+{ALL_GEMS}</span>
                </li>
                <li className="flex justify-between">
                  <span>올 과일</span>
                  <span className="font-mono text-emerald-300">
                    +{ALL_FRUITS}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>4 of a kind</span>
                  <span className="font-mono text-emerald-300">
                    +{FOUR_OF_A_KIND}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>3 of a kind</span>
                  <span className="font-mono text-emerald-300">
                    +{THREE_OF_A_KIND}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Pair</span>
                  <span className="font-mono text-emerald-300">+{PAIR}</span>
                </li>
                <li className="flex justify-between">
                  <span>4 페널티 (개당)</span>
                  <span className="font-mono text-rose-400">
                    -{FOUR_PENALTY_PER}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
