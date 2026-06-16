"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { fetchMe } from "@/lib/client/authApi";
import { ensureGuest, startQuick } from "@/lib/client/quickApi";
import GameScreen from "@/components/GameScreen";
import QuickResultScreen from "@/components/QuickResultScreen";
import ModeIntro from "@/components/ModeIntro";

function startErrorMessage(code: string): string {
  if (code === "no_active_season") return "진행 중인 시즌이 없습니다.";
  return "게임을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

// Quick play: a server-backed run that needs no login. Identity is resolved at
// start — a logged-in member plays under their nickname; everyone else gets a
// persistent guest identity (localStorage-backed). The run is started/seeded by
// the server (POST /api/quick/start) so the score can be verified and ranked on
// the fast-game leaderboard. Quick uses the DEFAULT engine (no configureRun):
// 00000 start, full random offers, all base symbols.
export default function QuickClient() {
  const status = useGameStore((s) => s.status);
  const setNickname = useGameStore((s) => s.setNickname);
  const beginRun = useGameStore((s) => s.beginRun);
  const startGame = useGameStore((s) => s.startGame);
  const reset = useGameStore((s) => s.reset);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Whether the active run is a guest run (drives the signup CTA on results).
  const [isGuest, setIsGuest] = useState(false);

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
      // Member if logged in; otherwise a persistent guest. fetchMe throws when
      // unauthenticated, which is the normal guest path (not an error).
      const me = await fetchMe().catch(() => null);
      let name: string;
      if (me) {
        name = me.nickname;
        setIsGuest(false);
      } else {
        const guest = await ensureGuest();
        name = guest.displayName;
        setIsGuest(true);
      }
      setNickname(name);
      const run = await startQuick(name);
      beginRun(run.seed, run.runId, "quick");
      startGame();
    } catch (err) {
      setStartError(startErrorMessage(err instanceof Error ? err.message : ""));
    } finally {
      setStarting(false);
    }
  }

  if (status === "finished") return <QuickResultScreen isGuest={isGuest} />;

  if (status !== "start") return <GameScreen />;

  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <ModeIntro
        storageKey="quick"
        title="빠른 게임"
        lines={[
          "매 스핀마다 규칙을 고르고 배치해 높은 점수를 노리는 모드입니다.",
          "빠른 게임 점수는 시즌 랭킹에 반영되지 않습니다.",
        ]}
      />
      <header className="text-center">
        <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">
          빠른 게임 (로그인 불필요)
        </p>
        <p className="mt-3 text-sm text-zinc-400 sm:text-base">
          바로 한 판. 빠른 게임 랭킹에 기록되지만 시즌 점수에는 반영되지
          않습니다.
        </p>
      </header>

      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="w-full max-w-sm rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
      >
        {starting ? "준비 중…" : "게임 시작"}
      </button>

      {startError && <p className="text-sm text-rose-400">{startError}</p>}

      <Link
        href="/quick/leaderboard"
        className="flex w-full max-w-sm items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        빠른 게임 랭킹 보기
      </Link>

      <Link
        href="/season"
        className="flex w-full max-w-sm items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        시즌으로 돌아가기
      </Link>
    </main>
  );
}
