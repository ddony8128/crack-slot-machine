"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import {
  submitPuzzle,
  type SubmitPuzzleResponse,
} from "@/lib/client/puzzleApi";
import { buildClientResults } from "@/lib/clientResults";
import SeasonScoreRise from "@/components/SeasonScoreRise";
import type { SeasonScoreChange } from "@/lib/season/scoring";
import type { PuzzleDistribution } from "@/lib/db/types";
import { PUZZLES_BY_KEY } from "@/lib/puzzle/config";

type SubmitState =
  | { phase: "submitting" }
  | { phase: "done"; result: SubmitPuzzleResponse }
  | { phase: "error" };

export default function PuzzleResultScreen({
  puzzleKey,
  scoreChange,
}: {
  puzzleKey: string;
  /** Optional override; otherwise read from this screen's own submit response. */
  scoreChange?: SeasonScoreChange;
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
    submitPuzzle(puzzleKey, runId, { actions: getActions(), clientResults })
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
          다시 도전
        </button>
        <Link
          href="/season/puzzle"
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          퍼즐 목록
        </Link>
      </main>
    );
  }

  const done =
    state.phase === "done" && state.result.status === "submitted"
      ? state.result
      : null;
  const change = scoreChange ?? done?.scoreChange;

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="celebrate-pop text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
        PUZZLE RESULT
      </h1>

      <div className="panel-pop w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        {done ? (
          <>
            <p
              className={`text-2xl font-black ${
                done.cleared ? "text-emerald-400" : "text-zinc-300"
              }`}
            >
              {done.cleared ? "클리어!" : "미클리어"}
            </p>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                달성 목표
              </p>
              <p className="font-mono text-4xl font-black text-amber-300">
                {done.goalsAchieved} / {done.totalGoals}
              </p>
            </div>

            <p className="text-sm text-zinc-400">
              사용 스핀:{" "}
              <span className="font-bold text-zinc-200">{done.spinCount}</span>회
            </p>

            <Distribution
              distribution={done.distribution}
              spinLimit={PUZZLES_BY_KEY[puzzleKey]?.spinLimit ?? done.spinCount}
              mineSpin={done.cleared ? done.spinCount : null}
            />
          </>
        ) : (
          <p className="text-sm text-zinc-400">
            {state.phase === "submitting" && "기록 등록 중…"}
            {state.phase === "error" && "기록 등록에 실패했습니다."}
          </p>
        )}
      </div>

      {change && <SeasonScoreRise change={change} />}

      <Link
        href="/season/puzzle"
        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        퍼즐 목록
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

/**
 * Clear-spin distribution: one "{n}스핀 클리어: {count}명" row per spin count
 * (1..spinLimit) plus a "미클리어: {count}명" row. The player's own bucket (their
 * clear spin, or 미클리어) is highlighted.
 */
function Distribution({
  distribution,
  spinLimit,
  mineSpin,
}: {
  distribution: PuzzleDistribution;
  spinLimit: number;
  mineSpin: number | null;
}) {
  const rows: Array<{ key: string; label: string; count: number; mine: boolean }> = [];
  let max = 1;
  for (let n = 1; n <= spinLimit; n++) {
    const count = distribution.bySpin[n] ?? 0;
    if (count > max) max = count;
    rows.push({ key: `s${n}`, label: `${n}스핀 클리어`, count, mine: mineSpin === n });
  }
  const notCleared = distribution.notCleared ?? 0;
  if (notCleared > max) max = notCleared;
  rows.push({
    key: "none",
    label: "미클리어",
    count: notCleared,
    mine: mineSpin === null,
  });

  return (
    <div className="space-y-1.5 text-left">
      <p className="text-xs uppercase tracking-wide text-zinc-500">클리어 분포</p>
      {rows.map(({ key, label, count, mine }) => (
        <div key={key} className="flex items-center gap-2">
          <span
            className={`w-24 shrink-0 text-xs font-semibold ${
              mine ? "text-emerald-400" : "text-zinc-400"
            }`}
          >
            {label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
            <div
              className={`h-full ${mine ? "bg-emerald-500" : "bg-zinc-600"}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs text-zinc-400">
            {count}명
          </span>
        </div>
      ))}
    </div>
  );
}
