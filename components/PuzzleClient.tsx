"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { startPuzzle } from "@/lib/client/puzzleApi";
import { puzzleRunConfig } from "@/lib/puzzle/run";
import { PUZZLES_BY_KEY } from "@/lib/puzzle/config";
import { fetchMe } from "@/lib/client/authApi";
import { RULES_BY_ID, RULE_PHASE_LABELS, RULE_BUILD_LABELS } from "@/data/rules";
import GameScreen from "@/components/GameScreen";
import PuzzleResultScreen from "@/components/PuzzleResultScreen";
import ModeIntro from "@/components/ModeIntro";
import SymbolView from "@/components/SymbolView";
import type { PuzzleGoal } from "@/lib/puzzle/config";

function startErrorMessage(code: string): string {
  if (code === "unauthorized") return "로그인이 필요합니다.";
  if (code === "puzzle_not_found") return "없는 퍼즐입니다.";
  if (code === "no_active_season") return "진행 중인 시즌이 없습니다.";
  if (code === "locked") return "1번 문제를 클리어하면 해금됩니다.";
  return "퍼즐을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export default function PuzzleClient({ puzzleKey }: { puzzleKey: string }) {
  const status = useGameStore((s) => s.status);
  const spinIndex = useGameStore((s) => s.spinIndex);
  const maxSpins = useGameStore((s) => s.maxSpins);
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
      // Always begin from a clean store. On a fresh page load this is a no-op
      // (the mount effect already reset); on 다시 도전 it clears the FINISHED run +
      // its resolved runId so we don't try to reuse/submit an already-resolved run
      // (which the server rejects with 409 — each run is single-submit).
      reset();
      // A new server run → a fresh runId + seed. The old run stays resolved on the
      // server; this is what makes 다시 도전 a genuinely new attempt.
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
    // 다시 도전 re-runs the full start flow (reset → new server run → startGame),
    // so the retry plays the SAME puzzle as a brand-new attempt instead of falling
    // back to a legacy run with a cleared runConfig.
    return (
      <PuzzleResultScreen
        puzzleKey={puzzleKey}
        onRetry={handleStart}
        retrying={starting}
      />
    );
  }

  if (status !== "start") {
    return (
      <div className="flex w-full flex-1 flex-col">
        {puzzle && (
          <div className="mx-auto w-full max-w-md px-4 pt-4">
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-200/80">
                  목표
                </span>
                <PuzzleGoalTiles goals={puzzle.goals} />
              </div>
              <p className="text-xs text-amber-200/80">
                남은 스핀{" "}
                <span className="font-bold text-amber-100">
                  {Math.max(0, maxSpins - spinIndex)}
                </span>
                회 · 규칙은 가방에서 시작합니다 — 슬롯으로 드래그해 배치하세요.
              </p>
              <PuzzleRuleReference ruleIds={puzzle.availableRuleIds} />
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

        <PuzzleRuleReference ruleIds={puzzle.availableRuleIds} />

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

/**
 * Collapsible reference listing every rule in the puzzle's bag with its name +
 * effect (pulled from RULES_BY_ID). In puzzle mode provisioning is 'fixed', so
 * RulePicker (which is what normally surfaces a rule's description during
 * 'choosing-rule') never renders — players would otherwise see only rule NAMES on
 * the tiles with no way to learn what each one does. This panel fills that gap.
 */
function PuzzleRuleReference({ ruleIds }: { ruleIds: string[] }) {
  const [open, setOpen] = useState(false);
  const rules = ruleIds
    .map((id) => RULES_BY_ID[id])
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (rules.length === 0) return null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-lg border border-amber-500/20 bg-zinc-950/40 text-left"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-center text-xs font-bold text-amber-200/90 transition hover:text-amber-100">
        규칙 설명 {open ? "▲" : "▼"}
      </summary>
      <ul className="space-y-2 px-3 pb-3 pt-1">
        {rules.map((rule) => (
          <li key={rule.id} className="space-y-0.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold text-emerald-300">
                {rule.name}
              </span>
              <span className="rounded-full border border-indigo-700/60 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-indigo-300">
                {RULE_PHASE_LABELS[rule.phase]}
              </span>
              {rule.build && RULE_BUILD_LABELS[rule.build] && (
                <span className="rounded-full border border-zinc-600/60 bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-zinc-300">
                  {RULE_BUILD_LABELS[rule.build]}
                </span>
              )}
            </span>
            <p className="text-xs leading-snug text-zinc-400">
              {rule.description}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Renders a puzzle's goal(s) as compact tiles for the in-game banner: an
 * `exact_board` goal shows its 5 target cells via SymbolView; a
 * `contains_symbol_count` goal shows "<symbol> ×<n>". Other goal types fall back
 * to nothing here (Season 1 ships only exact_board), so the banner stays clean.
 */
function PuzzleGoalTiles({ goals }: { goals: PuzzleGoal[] }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-1">
      {goals.map((goal, gi) => {
        if (goal.type === "exact_board") {
          return (
            <span key={gi} className="inline-flex items-center gap-0.5">
              {goal.board.map((sym, i) => (
                <SymbolView key={i} symbol={sym} size="sm" />
              ))}
            </span>
          );
        }
        if (goal.type === "contains_symbol_count") {
          return (
            <span key={gi} className="inline-flex items-center gap-1">
              <SymbolView symbol={goal.symbolId} size="sm" />
              <span className="text-sm font-bold text-amber-100">
                ×{goal.count}
              </span>
            </span>
          );
        }
        return null;
      })}
    </span>
  );
}
