"use client";

import { useState } from "react";

type Props = {
  /** Called once the player confirms they showed the dealer — proceed to start. */
  onProceed: () => void;
};

/**
 * Repeat-play penalty gate shown when the player presses GAME START while a
 * penalty is pending (3 plays in a row with under-3-minute breaks). Two steps:
 * (1) the penalty notice, (2) a "did you show the dealer?" confirmation that
 * must be acknowledged before the game starts.
 */
export default function PenaltyGate({ onProceed }: Props) {
  const [step, setStep] = useState<"warn" | "confirm">("warn");

  if (step === "warn") {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <h1 className="text-2xl font-black tracking-tight text-rose-300 sm:text-3xl">
          페널티
        </h1>
        <div className="panel-pop w-full space-y-3 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6">
          <p className="leading-relaxed text-zinc-200">
            이런! 3회 연속 플레이를 하셨군요...
          </p>
          <p className="text-lg font-bold text-rose-300">
            규칙을 어겨서 페널티를 받으셨습니다.
          </p>
          <p className="text-sm font-semibold text-amber-200">
            딜러 분에게 알리세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep("confirm")}
          className="w-full rounded-xl border border-zinc-600 bg-zinc-800 px-6 py-3 text-lg font-bold text-zinc-100 transition hover:bg-zinc-700"
        >
          확인
        </button>
      </main>
    );
  }

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="text-2xl font-black tracking-tight text-amber-300 sm:text-3xl">
        확인
      </h1>
      <div className="panel-pop w-full space-y-3 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6">
        <p className="leading-relaxed text-zinc-200">
          딜러 분에게 이 화면을 보여주셨나요?
        </p>
        <p className="text-sm font-semibold text-amber-200">
          보여드린 후에 진행해 주세요.
        </p>
      </div>
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={() => setStep("warn")}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-lg font-bold text-zinc-300 transition hover:bg-zinc-800"
        >
          아직이요
        </button>
        <button
          type="button"
          onClick={onProceed}
          className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          네, 보여줬어요
        </button>
      </div>
    </main>
  );
}
