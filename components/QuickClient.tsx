"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import GameScreen from "@/components/GameScreen";

// Quick play: a purely local run. No server run is started, no score is
// submitted, and no login is required. We seed the store with a locally
// generated seed, set a throwaway nickname (startGame() no-ops on an empty
// nickname), then drive the existing GameScreen exactly like a real run.
export default function QuickClient() {
  const status = useGameStore((s) => s.status);
  const totalScore = useGameStore((s) => s.totalScore);
  const setNickname = useGameStore((s) => s.setNickname);
  const beginRun = useGameStore((s) => s.beginRun);
  const startGame = useGameStore((s) => s.startGame);
  const reset = useGameStore((s) => s.reset);

  // The store is a module singleton that survives client navigations, so reset
  // to a clean 'start' state whenever this page mounts.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    reset();
  }, [reset]);

  function handleStart() {
    const seed = `quick-${crypto.randomUUID()}`;
    // No server run for quick play: runId is empty (the store's runId field is
    // `string | null`; beginRun's signature wants a string, so '' is the
    // type-safe "no run" value).
    beginRun(seed, "", "quick");
    // startGame() returns early when nickname is empty; give the local run a
    // throwaway name so it actually starts.
    setNickname("빠른 게임");
    startGame();
  }

  if (status === "finished") {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-zinc-200">결과</h1>
          <p className="mt-4 text-5xl font-black text-emerald-400">
            {totalScore}
            <span className="ml-1 text-2xl text-zinc-400">점</span>
          </p>
        </header>

        <p className="max-w-md rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 text-center text-sm leading-relaxed text-zinc-400">
          빠른 게임은 시즌 랭킹에 반영되지 않습니다. 로그인하면 첨탑 오르기·퍼즐·일일
          도전에 참여할 수 있습니다.
        </p>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
          >
            다시 하기
          </button>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/login"
              className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
            >
              회원가입
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (status === "start") {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <header className="text-center">
          <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </h1>
          <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">
            빠른 게임 (로그인 불필요)
          </p>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base">
            기록 없이 바로 한 판. 시즌 랭킹에는 반영되지 않습니다.
          </p>
        </header>

        <button
          type="button"
          onClick={handleStart}
          className="w-full max-w-sm rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          게임 시작
        </button>
      </main>
    );
  }

  return <GameScreen />;
}
