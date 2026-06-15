"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import {
  submitQuick,
  fetchQuickLeaderboard,
  type SubmitQuickResponse,
  type QuickLeaderboard,
} from "@/lib/client/quickApi";
import { buildClientResults } from "@/lib/clientResults";
import { useCountUp } from "@/hooks/useCountUp";

type SubmitState =
  | { phase: "submitting" }
  | { phase: "done"; result: SubmitQuickResponse }
  | { phase: "error" };

const RANKING_NOTE =
  "빠른 게임 랭킹은 시즌 기간 동안만 유지되며 시즌 점수에 반영되지 않습니다.";

export default function QuickResultScreen({ isGuest }: { isGuest: boolean }) {
  const nickname = useGameStore((s) => s.nickname);
  const totalScore = useGameStore((s) => s.totalScore);
  const spinLogs = useGameStore((s) => s.spinLogs);
  const runId = useGameStore((s) => s.runId);
  const getActions = useGameStore((s) => s.getActions);
  const reset = useGameStore((s) => s.reset);

  const [state, setState] = useState<SubmitState>({ phase: "submitting" });
  const [board, setBoard] = useState<QuickLeaderboard | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const loadBoard = () =>
      fetchQuickLeaderboard()
        .then(setBoard)
        .catch(() => setBoard(null));

    if (!runId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ phase: "error" });
      loadBoard();
      return;
    }

    const clientResults = buildClientResults(spinLogs, totalScore);
    submitQuick(runId, { nickname, actions: getActions(), clientResults })
      .then((result) => setState({ phase: "done", result }))
      .catch(() => setState({ phase: "error" }))
      // Fetch the ranking after submit so this run is reflected in it.
      .finally(loadBoard);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rejected = state.phase === "done" && state.result.status === "rejected";
  const rejectReason =
    state.phase === "done" && state.result.status === "rejected"
      ? state.result.reason
      : null;
  // A version mismatch means an old build was loaded (e.g. a tab left open across
  // a deploy) — NOT cheating. Prompt a refresh instead of accusing the player.
  const staleVersion = rejectReason === "version_mismatch";
  const submitted =
    state.phase === "done" && state.result.status === "submitted";
  const animatedScore = useCountUp(rejected ? 0 : totalScore, 900, 0);

  if (staleVersion) {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <h1 className="text-2xl font-black tracking-tight text-amber-300 sm:text-3xl">
          새 버전이 배포되었어요
        </h1>
        <p className="text-zinc-300">
          페이지를 새로고침한 뒤 다시 플레이해 주세요. (이번 기록은 등록되지
          않았습니다)
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          새로고침
        </button>
      </main>
    );
  }

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="celebrate-pop text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
        QUICK RESULT
      </h1>

      <div className="panel-pop w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Player</p>
          <p className="text-xl font-bold text-emerald-400">{nickname}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Final Score
          </p>
          <p className="font-mono text-5xl font-black text-amber-300">
            {animatedScore}
          </p>
        </div>

        <p className="text-sm text-zinc-400">
          {state.phase === "submitting" && "기록 등록 중…"}
          {submitted && "빠른 게임 랭킹에 등록되었습니다!"}
          {rejected && "치팅이 감지되어 기록이 등록되지 않았습니다."}
          {state.phase === "error" && "기록 등록에 실패했습니다."}
        </p>
      </div>

      {isGuest && (
        <div className="panel-pop w-full space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <p className="text-base font-bold text-amber-200">
            시즌 랭킹에 도전하려면 회원가입하세요
          </p>
          <p className="text-sm text-amber-100/80">
            회원이 되면 첨탑 오르기·퍼즐·일일 도전 등 시즌 랭킹에 참여할 수
            있습니다.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/signup"
              className="flex items-center justify-center rounded-xl bg-amber-400 px-4 py-2.5 text-base font-bold text-zinc-950 transition hover:bg-amber-300"
            >
              회원가입
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center rounded-xl border border-amber-400/60 bg-transparent px-4 py-2.5 text-base font-semibold text-amber-200 transition hover:bg-amber-500/20"
            >
              로그인
            </Link>
          </div>
        </div>
      )}

      <section className="w-full space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
          빠른 게임 랭킹 TOP
        </h2>
        {board && board.items.length > 0 ? (
          <ol className="space-y-1.5">
            {board.items.map((item) => (
              <li
                key={`${item.rank}-${item.nickname}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 font-mono font-bold text-amber-300">
                    {item.rank}
                  </span>
                  <span className="font-semibold text-zinc-200">
                    {item.nickname}
                  </span>
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {item.score}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-500">
            {board ? "아직 기록이 없습니다." : "랭킹을 불러오는 중…"}
          </p>
        )}
        <p className="text-xs leading-relaxed text-zinc-500">{RANKING_NOTE}</p>
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
