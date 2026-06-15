"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { submitSpire, type SubmitSpireResponse } from "@/lib/client/spireApi";
import { buildClientResults } from "@/lib/clientResults";
import { SPIRE_STAGES, SPIRE_STAGE_COUNT } from "@/lib/spire/config";

type SubmitState =
  | { phase: "submitting" }
  | { phase: "done"; result: SubmitSpireResponse }
  | { phase: "error" };

export default function SpireResultScreen({
  chosenSetId,
}: {
  chosenSetId: string;
}) {
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
    submitSpire(runId, { chosenSetId, actions: getActions(), clientResults })
      .then((result) => setState({ phase: "done", result }))
      .catch(() => setState({ phase: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rejectReason =
    state.phase === "done" && state.result.status === "rejected"
      ? state.result.reason
      : null;

  if (rejectReason === "version_mismatch") {
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

  if (rejectReason) {
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
          다시 도전
        </button>
      </main>
    );
  }

  const done =
    state.phase === "done" && state.result.status === "submitted"
      ? state.result
      : null;

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="celebrate-pop text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
        SPIRE RESULT
      </h1>

      <div className="panel-pop w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        {done ? (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                도달 스테이지
              </p>
              <p className="font-mono text-4xl font-black text-amber-300">
                {done.stagesCleared} / {SPIRE_STAGE_COUNT}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                총점
              </p>
              <p className="font-mono text-3xl font-black text-emerald-300">
                {done.totalScore}
              </p>
            </div>
            <p className="text-sm font-semibold text-amber-200">
              시즌 점수 +{done.seasonPoints} <span className="text-zinc-500">(최대 1000)</span>
            </p>
            <div className="space-y-1 text-left">
              <p className="text-xs uppercase tracking-wide text-zinc-500">스테이지별 점수</p>
              {done.stageScores.map((sc, i) => {
                const target = SPIRE_STAGES[i].targetScore;
                const ok = sc >= target;
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">스테이지 {i + 1}</span>
                    <span className={ok ? "text-emerald-300" : "text-rose-400"}>
                      {sc} / {target} {ok ? "✓" : "✗"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-400">
            {state.phase === "submitting" && "기록 등록 중…"}
            {state.phase === "error" && "기록 등록에 실패했습니다."}
          </p>
        )}
      </div>

      <Link
        href="/season"
        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        시즌 허브
      </Link>
      <button
        type="button"
        onClick={reset}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
      >
        다시 도전
      </button>
    </main>
  );
}
