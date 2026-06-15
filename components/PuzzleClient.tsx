"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { startPuzzle } from "@/lib/client/puzzleApi";
import { puzzleRunConfig } from "@/lib/puzzle/run";
import { PUZZLES_BY_KEY } from "@/lib/puzzle/config";
import { fetchMe } from "@/lib/client/authApi";
import GameScreen from "@/components/GameScreen";
import PuzzleResultScreen from "@/components/PuzzleResultScreen";
import ModeIntro from "@/components/ModeIntro";

function startErrorMessage(code: string): string {
  if (code === "unauthorized") return "로그인이 필요합니다.";
  if (code === "puzzle_not_found") return "없는 퍼즐입니다.";
  if (code === "no_active_season") return "진행 중인 시즌이 없습니다.";
  return "퍼즐을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export default function PuzzleClient({ puzzleKey }: { puzzleKey: string }) {
  const status = useGameStore((s) => s.status);
  const setNickname = useGameStore((s) => s.setNickname);
  const beginRun = useGameStore((s) => s.beginRun);
  const configureRun = useGameStore((s) => s.configureRun);
  const startGame = useGameStore((s) => s.startGame);
  const reset = useGameStore((s) => s.reset);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const puzzle = PUZZLES_BY_KEY[puzzleKey];

  // The store is a module singleton that survives client navigations, so reset
  // to a clean 'start' state whenever this page mounts.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    reset();
  }, [reset]);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const run = await startPuzzle(puzzleKey);
      // Apply the puzzle's fixed board / rule bag / spin limit BEFORE startGame()
      // so the client run matches the server replay.
      configureRun(puzzleRunConfig(puzzleKey));
      beginRun(run.seed, run.runId, "puzzle");
      // startGame() gates on a non-empty nickname; the record is stored under the
      // server-side player nickname regardless, but we set it so the gate passes.
      const me = await fetchMe();
      setNickname(me.nickname);
      startGame();
    } catch (err) {
      setStartError(startErrorMessage(err instanceof Error ? err.message : ""));
    } finally {
      setStarting(false);
    }
  }

  if (status === "finished") {
    return <PuzzleResultScreen puzzleKey={puzzleKey} />;
  }

  if (status !== "start") {
    return (
      <div className="flex w-full flex-1 flex-col">
        {puzzle && (
          <div className="mx-auto w-full max-w-md px-4 pt-4">
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
              <p className="text-sm font-bold text-amber-200">
                목표: {puzzle.goalText}
              </p>
              <p className="text-xs text-amber-200/80">
                스핀 제한 {puzzle.spinLimit}회 · 규칙은 가방에서 시작합니다 —
                슬롯으로 드래그해 배치하세요.
              </p>
            </div>
          </div>
        )}
        <GameScreen />
      </div>
    );
  }

  if (!puzzle) {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-sm text-zinc-400">
          없는 퍼즐입니다.
        </p>
        <Link
          href="/season/puzzle"
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          퍼즐 목록
        </Link>
      </main>
    );
  }

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <ModeIntro
        storageKey="puzzle"
        title="퍼즐 모드"
        lines={[
          "주어진 규칙을 사용해 제한된 횟수 안에 목표 조합을 달성하세요.",
          "규칙은 랜덤으로 나오지 않고, 처음부터 가방에 들어 있습니다.",
        ]}
      />
      <header className="space-y-2">
        <span className="font-mono text-xs font-bold text-emerald-400">
          #{puzzle.index}
        </span>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          <span className="text-zinc-100">{puzzle.title}</span>
        </h1>
        <p className="text-sm text-zinc-400">
          규칙을 슬롯에 배치하고 목표를 달성하세요.
        </p>
      </header>

      <div className="panel-pop w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">목표</p>
          <p className="text-base font-semibold text-zinc-200">
            {puzzle.goalText}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            스핀 제한
          </p>
          <p className="font-mono text-lg font-bold text-amber-300">
            {puzzle.spinLimit}스핀
          </p>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {starting ? "준비 중…" : "퍼즐 시작"}
        </button>

        {startError && <p className="text-sm text-rose-400">{startError}</p>}
      </div>

      <Link
        href="/season/puzzle"
        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        퍼즐 목록
      </Link>
    </main>
  );
}
