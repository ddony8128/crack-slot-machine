"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { startSpire } from "@/lib/client/spireApi";
import { fetchMe } from "@/lib/client/authApi";
import { spireRunConfig } from "@/lib/spire/run";
import { SYMBOL_SETS_BY_ID } from "@/lib/symbols/sets";
import { SPIRE_STAGES, SPIRE_SPINS_PER_STAGE, SPIRE_STAGE_COUNT } from "@/lib/spire/config";
import GameScreen from "@/components/GameScreen";
import SpireResultScreen from "@/components/SpireResultScreen";
import type { SymbolType } from "@/types";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "choosing"; runId: string; seed: string; choices: [string, string] }
  | { kind: "playing"; chosenSetId: string; seed: string };

export default function SpireClient() {
  const status = useGameStore((s) => s.status);
  const spinLogs = useGameStore((s) => s.spinLogs);
  const beginRun = useGameStore((s) => s.beginRun);
  const configureRun = useGameStore((s) => s.configureRun);
  const startGame = useGameStore((s) => s.startGame);
  const setNickname = useGameStore((s) => s.setNickname);
  const reset = useGameStore((s) => s.reset);

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    reset();
    startSpire()
      .then((r) => setPhase({ kind: "choosing", runId: r.runId, seed: r.seed, choices: r.choices }))
      .catch((e) =>
        setPhase({
          kind: "error",
          message:
            e instanceof Error && e.message === "unauthorized"
              ? "로그인이 필요합니다."
              : "첨탑을 시작할 수 없습니다.",
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(setId: string) {
    if (phase.kind !== "choosing") return;
    const { runId, seed } = phase;
    const me = await fetchMe().catch(() => null);
    if (me) setNickname(me.nickname);
    configureRun(spireRunConfig(seed, setId));
    beginRun(seed, runId, "spire");
    startGame();
    setPhase({ kind: "playing", chosenSetId: setId, seed });
  }

  if (phase.kind === "loading") {
    return <Centered>첨탑을 준비하는 중…</Centered>;
  }
  if (phase.kind === "error") {
    return (
      <Centered>
        <p className="text-rose-400">{phase.message}</p>
        <Link href="/login" className="text-emerald-400 underline">
          로그인하기
        </Link>
      </Centered>
    );
  }

  if (phase.kind === "choosing") {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-10">
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">첨탑</span>{" "}
            <span className="text-amber-300">오르기</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            숫자 세트로 시작합니다. 함께할 심볼 세트 하나를 고르세요.
            <br />그 세트의 심볼이 주머니에 추가되고 규칙이 해금됩니다.
          </p>
        </header>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {phase.choices.map((id) => {
            const set = SYMBOL_SETS_BY_ID[id];
            if (!set) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-zinc-800/60"
              >
                <span className="text-lg font-bold text-emerald-300">{set.name} 세트</span>
                <span className="text-2xl">{set.symbols.map((s) => s.emoji).join(" ")}</span>
                <span className="text-xs text-zinc-400">
                  {set.symbols.map((s) => s.name).join(" / ")}
                </span>
                <span className="text-xs text-amber-200/80">규칙 {set.ruleIds.length}개 해금</span>
                <span className="mt-1 inline-block rounded-lg bg-emerald-500 px-3 py-1.5 text-center text-sm font-bold text-zinc-950">
                  이 세트 선택
                </span>
              </button>
            );
          })}
        </div>
        <Link href="/season" className="text-sm text-zinc-400 underline">
          ← 시즌으로
        </Link>
      </main>
    );
  }

  // playing
  const roundScores = spinLogs.map((l) => l.roundScore);
  const completedStages = Math.floor(roundScores.length / SPIRE_SPINS_PER_STAGE);
  let clearedSoFar = 0;
  let failed = false;
  for (let k = 0; k < completedStages; k++) {
    const sum = roundScores
      .slice(k * SPIRE_SPINS_PER_STAGE, k * SPIRE_SPINS_PER_STAGE + SPIRE_SPINS_PER_STAGE)
      .reduce((a, b) => a + b, 0);
    if (sum >= SPIRE_STAGES[k].targetScore) clearedSoFar += 1;
    else {
      failed = true;
      break;
    }
  }
  const runOver =
    status === "finished" || failed || completedStages >= SPIRE_STAGE_COUNT;

  if (runOver) {
    return <SpireResultScreen chosenSetId={phase.chosenSetId} />;
  }

  const currentStage = Math.min(clearedSoFar + 1, SPIRE_STAGE_COUNT);
  const target = SPIRE_STAGES[currentStage - 1].targetScore;
  const weights = spireRunConfig(phase.seed, phase.chosenSetId).baseWeights ?? {};
  const bag = (Object.entries(weights) as [SymbolType, number][])
    .filter(([, w]) => w > 0)
    .map(([s, w]) => `${SYMBOL_SETS_BY_ID_emoji(s)}×${w}`)
    .join("  ");

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-2 text-sm">
          <span className="font-bold text-amber-300">
            스테이지 {currentStage} / {SPIRE_STAGE_COUNT}
          </span>
          <span className="text-zinc-300">목표 {target}점</span>
          <span className="text-emerald-300">클리어 {clearedSoFar}</span>
        </div>
        <p className="mt-1 text-center text-xs text-zinc-500">심볼 주머니: {bag}</p>
      </div>
      <GameScreen />
    </>
  );
}

/** Emoji for a symbol id via the set catalog (numbers fall back to the glyph). */
function SYMBOL_SETS_BY_ID_emoji(id: string): string {
  for (const set of Object.values(SYMBOL_SETS_BY_ID)) {
    const sym = set.symbols.find((s) => s.id === id);
    if (sym) return sym.emoji;
  }
  return id;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {children}
    </main>
  );
}
