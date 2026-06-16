"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { submitDaily, type SubmitDailyResponse } from "@/lib/client/dailyApi";
import { buildClientResults } from "@/lib/clientResults";
import { useCountUp } from "@/hooks/useCountUp";
import SeasonScoreRise from "@/components/SeasonScoreRise";
import type { SeasonScoreChange } from "@/lib/season/scoring";

type SubmitState =
  | { phase: "submitting" }
  | { phase: "done"; result: SubmitDailyResponse }
  | { phase: "error" };

function tierMessage(score: number): string {
  if (score < 0) return "규칙이 당신을 버렸습니다";
  if (score <= 499) return "아쉽지만 감은 잡았습니다";
  if (score <= 999) return "꽤 괜찮은 슬롯 감각입니다";
  if (score <= 1499) return "RULE MASTER";
  return "JACKPOT CONTENDER";
}

export default function DailyResultScreen({
  scoreChange,
}: {
  /** Optional override; otherwise read from this screen's own submit response. */
  scoreChange?: SeasonScoreChange;
} = {}) {
  const nickname = useGameStore((s) => s.nickname);
  const totalScore = useGameStore((s) => s.totalScore);
  const spinLogs = useGameStore((s) => s.spinLogs);
  const runId = useGameStore((s) => s.runId);
  const getActions = useGameStore((s) => s.getActions);
  const reset = useGameStore((s) => s.reset);
  const router = useRouter();

  const [state, setState] = useState<SubmitState>({ phase: "submitting" });
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    if (!runId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ phase: "error" });
      return;
    }

    const clientResults = buildClientResults(spinLogs, totalScore);
    submitDaily(runId, { actions: getActions(), clientResults })
      .then((result) => {
        setState({ phase: "done", result });
        // Bust the cached server render of the daily ranking/leaderboard so the
        // just-submitted best score is reflected without a manual refresh.
        if (result.status === "submitted") router.refresh();
      })
      .catch(() => setState({ phase: "error" }));
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rejected = state.phase === "done" && state.result.status === "rejected";
  const rejectReason =
    state.phase === "done" && state.result.status === "rejected"
      ? state.result.reason
      : null;
  // A version mismatch means the player loaded an old build (e.g. a tab left open
  // across a deploy) — NOT cheating. Show a refresh prompt instead of accusing them.
  const staleVersion = rejectReason === "version_mismatch";
  const attemptsLeft =
    state.phase === "done" ? (state.result.attemptsLeft ?? 0) : 0;
  const animatedScore = useCountUp(rejected ? 0 : totalScore, 900, 0);

  if (staleVersion) {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <h1 className="text-2xl font-black tracking-tight text-amber-300 sm:text-3xl">
          새 버전이 배포되었어요
        </h1>
        <p className="text-zinc-300">
          페이지를 새로고침한 뒤 다시 플레이해 주세요. (이번 기록은 등록되지 않았습니다)
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

  if (rejected) {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <h1 className="text-3xl font-black tracking-tight text-rose-400 sm:text-4xl">
          치팅이 감지되었습니다
        </h1>
        <p className="text-zinc-300">기록이 등록되지 않았습니다.</p>
        {attemptsLeft > 0 && (
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
          >
            다시 도전 ({attemptsLeft}회 남음)
          </button>
        )}
        <Link
          href="/season/daily/leaderboard"
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          오늘의 랭킹 보기
        </Link>
        <Link
          href="/season"
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          시즌 허브로
        </Link>
      </main>
    );
  }

  const submitted =
    state.phase === "done" && state.result.status === "submitted";
  const resultChange =
    state.phase === "done" && state.result.status === "submitted"
      ? state.result.scoreChange
      : undefined;
  const change = scoreChange ?? resultChange;

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="celebrate-pop text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
        DAILY RESULT
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

        <p className="text-lg font-semibold text-zinc-200">
          {tierMessage(totalScore)}
        </p>

        <p className="text-sm text-zinc-400">
          {state.phase === "submitting" && "기록 등록 중…"}
          {submitted && "오늘의 랭킹에 등록되었습니다!"}
          {state.phase === "error" && "기록 등록에 실패했습니다."}
        </p>

        {submitted && (
          <p className="text-sm text-zinc-400">
            남은 도전: <span className="font-bold text-zinc-200">{attemptsLeft}</span>회
          </p>
        )}
      </div>

      {submitted && change && <SeasonScoreRise change={change} />}

      <section className="w-full space-y-3">
        <Link
          href="/season/daily/leaderboard"
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          오늘의 랭킹 보기
        </Link>
        <Link
          href="/season"
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          시즌 허브로
        </Link>
      </section>

      {(state.phase === "error" || (submitted && attemptsLeft > 0)) && (
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          다시 도전
        </button>
      )}
    </main>
  );
}
