"use client";

import Link from "next/link";
import { SPIRE_STAGE_COUNT, SPIRE_ARTIFACTS } from "@/lib/spire/config";
import SeasonScoreRise from "@/components/SeasonScoreRise";
import {
  SPIRE_STAGE_POINTS,
  SPIRE_MONEY_PER,
  SPIRE_SPIN_PER,
  type SeasonScoreChange,
} from "@/lib/season/scoring";

export type SpireResultProps = {
  stagesCleared: number;
  totalScore: number;
  money: number;
  /** Banked spins over CLEARED stages only (feeds the season-score breakdown). */
  unusedSpins: number;
  artifacts: string[];
  endReason: "completed" | "failed-out" | "in-progress";
  seasonPoints: number | null;
  scoreChange?: SeasonScoreChange;
  /** null = still submitting; 'submitted' / 'rejected' / 'error'. */
  submitState: "submitting" | "submitted" | "rejected" | "error" | "version_mismatch";
  rejectReason?: string | null;
  onRetry: () => void;
};

const ARTIFACT_NAME: Record<string, string> = Object.fromEntries(
  SPIRE_ARTIFACTS.map((a) => [a.id, a.name]),
);

export default function SpireResultScreen({
  stagesCleared,
  totalScore,
  money,
  unusedSpins,
  artifacts,
  endReason,
  seasonPoints,
  scoreChange,
  submitState,
  rejectReason,
  onRetry,
}: SpireResultProps) {
  if (submitState === "version_mismatch") {
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

  if (submitState === "rejected") {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <h1 className="text-3xl font-black tracking-tight text-rose-400 sm:text-4xl">
          치팅이 감지되었습니다
        </h1>
        <p className="text-zinc-300">
          기록이 등록되지 않았습니다.
          {rejectReason ? <span className="block text-xs text-zinc-500">({rejectReason})</span> : null}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          다시 도전
        </button>
      </main>
    );
  }

  const title = endReason === "completed" ? "첨탑 정복!" : "SPIRE RESULT";

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="celebrate-pop text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
        {title}
      </h1>

      <div className="panel-pop w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">도달 스테이지</p>
          <p className="font-mono text-4xl font-black text-amber-300">
            {stagesCleared} / {SPIRE_STAGE_COUNT}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">총 점수</p>
          <p className="font-mono text-3xl font-black text-emerald-300">{totalScore}</p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">보유 돈</span>
          <span className="font-mono text-amber-200">{money}원</span>
        </div>
        <div className="space-y-1 text-left">
          <p className="text-xs uppercase tracking-wide text-zinc-500">아티팩트</p>
          {artifacts.length === 0 ? (
            <p className="text-sm text-zinc-500">없음</p>
          ) : (
            artifacts.map((id) => (
              <p key={id} className="text-sm text-emerald-200">
                {ARTIFACT_NAME[id] ?? id}
              </p>
            ))
          )}
        </div>

        {submitState === "submitting" && (
          <p className="text-sm text-zinc-400">기록 등록 중…</p>
        )}
        {submitState === "error" && (
          <p className="text-sm text-rose-400">기록 등록에 실패했습니다.</p>
        )}
        {submitState === "submitted" && seasonPoints != null && (
          <div className="space-y-1 text-center">
            <p className="text-sm font-semibold text-amber-200">시즌 점수 +{seasonPoints}</p>
            <p className="text-xs leading-relaxed text-zinc-500">
              최고 클리어 스테이지 {stagesCleared}×{SPIRE_STAGE_POINTS}
              {" + "}남은 돈 {money}×{SPIRE_MONEY_PER}
              {" + "}전체 남긴 스핀 {unusedSpins}×{SPIRE_SPIN_PER}
              {" = "}
              <span className="font-bold text-amber-200">
                {stagesCleared * SPIRE_STAGE_POINTS +
                  money * SPIRE_MONEY_PER +
                  unusedSpins * SPIRE_SPIN_PER}
              </span>
            </p>
          </div>
        )}
      </div>

      {submitState === "submitted" && scoreChange && (
        <SeasonScoreRise change={scoreChange} />
      )}

      <Link
        href="/season"
        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        메인 화면으로
      </Link>
      <button
        type="button"
        onClick={onRetry}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
      >
        다시 도전
      </button>
    </main>
  );
}
