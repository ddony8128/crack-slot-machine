"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { submitRun, type SubmitResponse } from "@/lib/client/api";
import { buildClientResults } from "@/lib/clientResults";
import { useCountUp } from "@/hooks/useCountUp";
import { ACHIEVEMENT_META, CREDIT_LABELS } from "@/data/achievements";

type Props = { slug: string };

type SubmitState =
  | { phase: "submitting" }
  | { phase: "done"; result: SubmitResponse }
  | { phase: "error" };

function tierMessage(score: number): string {
  if (score < 0) return "규칙이 당신을 버렸습니다";
  if (score <= 499) return "아쉽지만 감은 잡았습니다";
  if (score <= 999) return "꽤 괜찮은 슬롯 감각입니다";
  if (score <= 1499) return "RULE MASTER";
  return "JACKPOT CONTENDER";
}

export default function ResultScreen({ slug }: Props) {
  const nickname = useGameStore((s) => s.nickname);
  const totalScore = useGameStore((s) => s.totalScore);
  const spinLogs = useGameStore((s) => s.spinLogs);
  const runId = useGameStore((s) => s.runId);
  const getActions = useGameStore((s) => s.getActions);
  const reset = useGameStore((s) => s.reset);

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
    submitRun(runId, { nickname, actions: getActions(), clientResults })
      .then((result) => setState({ phase: "done", result }))
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
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          다시 플레이하기
        </button>
      </main>
    );
  }

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="celebrate-pop text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
        GAME RESULT
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
          {state.phase === "done" &&
            state.result.status === "submitted" &&
            "랭킹에 등록되었습니다!"}
          {state.phase === "error" && "기록 등록에 실패했습니다."}
        </p>
      </div>

      {state.phase === "done" && state.result.status === "submitted" && (
        <RewardSummary result={state.result} score={totalScore} />
      )}

      <section className="w-full">
        <Link
          href={`/e/${slug}/leaderboard`}
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          전체 랭킹 보기
        </Link>
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

/**
 * Credit breakdown + personal-best + newly-unlocked achievements for a
 * successfully submitted run. Pure presentation of the server's SubmitResponse.
 */
function RewardSummary({
  result,
  score,
}: {
  result: Extract<SubmitResponse, { status: "submitted" }>;
  score: number;
}) {
  const { credits, newAchievements, allAchievementsComplete, previousBest } =
    result;
  const newBest = previousBest === null || score > previousBest;

  return (
    <div className="panel-pop w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-left">
      {/* Personal best */}
      <p className="text-center text-sm font-semibold text-emerald-300">
        {newBest ? "개인 최고 점수 갱신!" : `개인 최고 점수: ${previousBest}`}
      </p>

      {/* Credits */}
      <div className="space-y-2">
        {credits.total > 0 ? (
          <>
            <p className="text-center text-lg font-bold text-amber-300">
              이번 플레이로 받을 크레딧: {credits.total}개
            </p>
            <ul className="space-y-1">
              {credits.awards.map((award) => (
                <li
                  key={award.reason}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">
                    {CREDIT_LABELS[award.reason]}
                  </span>
                  <span className="font-mono font-bold text-emerald-300">
                    +{award.amount}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-center text-sm font-semibold text-amber-200">
              스태프에게 이 화면을 보여주세요.
            </p>
          </>
        ) : (
          <p className="text-center text-sm text-zinc-400">
            이번에 새로 받을 크레딧은 없습니다. 다시 도전해보세요.
          </p>
        )}
      </div>

      {/* Newly unlocked achievements */}
      {newAchievements.length > 0 && (
        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <p className="text-center text-base font-black tracking-tight text-amber-300 horror-glow">
            업적 달성!
          </p>
          <ul className="space-y-1">
            {newAchievements.map((key) => (
              <li
                key={key}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-center text-sm font-semibold text-amber-200"
              >
                {ACHIEVEMENT_META[key].title}
              </li>
            ))}
          </ul>
          {allAchievementsComplete && (
            <p className="text-center text-sm font-bold text-emerald-300">
              모든 업적 달성!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
