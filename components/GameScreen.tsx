"use client";

import { useEffect, useRef, useState } from "react";
import type { SpinLog } from "@/types";
import { useGameStore } from "@/store/gameStore";
import StatusBar from "@/components/StatusBar";
import RuleSlots from "@/components/RuleSlots";
import RulePicker from "@/components/RulePicker";
import SlotMachine from "@/components/SlotMachine";
import SpinStage from "@/components/SpinStage";
import ScorePanel from "@/components/ScorePanel";
import SpinResultLog from "@/components/SpinResultLog";
import {
  JackpotCelebration,
  ExtraRuleCelebration,
  MultiplierCelebration,
} from "@/components/Celebrations";
import { useSpinReveal } from "@/hooks/useSpinReveal";

const CELEBRATION_MS = 2200;

type Celebration =
  | { kind: "jackpot" }
  | { kind: "extra" }
  | { kind: "multiplier"; value: number }
  | null;

export default function GameScreen() {
  const status = useGameStore((s) => s.status);
  const spinLogs = useGameStore((s) => s.spinLogs);
  const currentResult = useGameStore((s) => s.currentResult);
  const pendingSelection = useGameStore((s) => s.pendingSelection);
  const selectCells = useGameStore((s) => s.selectCells);

  const latestLog = spinLogs[spinLogs.length - 1] ?? null;

  const reveal = useSpinReveal(latestLog, currentResult);

  // Local picking state: indices the player has clicked so far during a
  // 'select' rule. Cleared whenever we leave 'awaiting-selection'.
  const [chosen, setChosen] = useState<number[]>([]);

  const picking = status === "awaiting-selection" && pendingSelection != null;

  // Reset local picks when leaving the selection status (or when a new
  // pendingSelection arrives, e.g. a second select rule in the same spin).
  useEffect(() => {
    if (!picking) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChosen([]);
    }
  }, [picking, pendingSelection]);

  const selectableArr = pendingSelection
    ? pendingSelection.selectable.flatMap((ok, i) => (ok ? [i] : []))
    : [];

  function handlePick(i: number) {
    if (!pendingSelection) return;
    const count = pendingSelection.count;
    if (count === 1) {
      selectCells([i]);
      return;
    }
    // count === 2 (swap): collect two distinct picks; clicking the first again
    // deselects it.
    setChosen((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      const next = [...prev, i];
      if (next.length === 2) {
        selectCells(next);
        return [];
      }
      return next;
    });
  }

  const promptText = pendingSelection
    ? pendingSelection.kind === "copy"
      ? "복사할 칸을 선택하세요 (바로 왼쪽 칸이 복사됩니다)"
      : pendingSelection.kind === "swap"
        ? `교체할 두 칸을 선택하세요 (${chosen.length}/2)`
        : "다시 굴릴 칸을 선택하세요"
    : "";

  // Celebrations fire once the reveal completes for the latest log.
  const [celebration, setCelebration] = useState<Celebration>(null);
  // Track the already-celebrated spin by log OBJECT IDENTITY (spinIndex repeats
  // after an extra rule pick, so it can't identify a unique spin).
  const celebratedLogRef = useRef<SpinLog | null>(null);

  // Trigger effect: decide whether the latest resolved spin warrants a celebration.
  useEffect(() => {
    if (!latestLog || !reveal.scoreReady) return;
    if (latestLog === celebratedLogRef.current) return;
    celebratedLogRef.current = latestLog;

    let next: Celebration = null;
    // True jackpot only: five actual 7s, or a five-of-a-kind hand (700).
    // Use the seven COUNT (not sevenScore) so SEVEN DOUBLE on 4 sevens (→1000) doesn't false-trigger.
    const sevenCount = latestLog.finalResult.filter((s) => s === "seven").length;
    const jackpot = sevenCount === 5 || latestLog.handScore >= 700;
    if (jackpot) next = { kind: "jackpot" };
    else if (latestLog.multiplierSet > 1)
      next = { kind: "multiplier", value: latestLog.multiplierSet };
    else if (latestLog.zeroDraw) next = { kind: "extra" };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) setCelebration(next);
  }, [latestLog, reveal.scoreReady]);

  // Dismiss effect: whenever a celebration becomes visible, auto-hide it after
  // CELEBRATION_MS. Keyed on the celebration value so each new one resets the timer.
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), CELEBRATION_MS);
    return () => clearTimeout(t);
  }, [celebration]);

  // Reels are always visible in-game (incl. while choosing/placing a rule) so the
  // player can see the current board. The SPIN button itself only shows when ready.
  const showSlot = status !== "start" && status !== "finished";

  // Score panel waits for the on-reel reveal to finish.
  const showScore =
    status === "spin-result" && latestLog && reveal.scoreReady;

  // While a spin is actively revealing OR the player must pick cells, the
  // cinematic SpinStage overlay takes over; the inline reels hide behind it.
  const stageActive = reveal.revealing || picking;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <StatusBar />
      <RuleSlots />

      {showSlot && !stageActive && (
        <SlotMachine
          symbols={reveal.symbols}
          reelRolling={reveal.reelRolling}
          flashIndices={reveal.flashIndices}
          landIndices={reveal.landIndices}
          stepLabel={reveal.stepLabel}
          lockedIndices={reveal.lockedIndices}
          revealing={reveal.revealing}
        />
      )}

      {status === "choosing-rule" && <RulePicker />}

      {showScore && (
        <>
          <ScorePanel log={latestLog} />
          {latestLog.steps.length > 0 && <SpinResultLog log={latestLog} />}
        </>
      )}

      {stageActive && (
        <SpinStage
          symbols={picking ? currentResult : reveal.symbols}
          reelRolling={reveal.reelRolling}
          flashIndices={reveal.flashIndices}
          landIndices={reveal.landIndices}
          stepLabel={reveal.stepLabel}
          lockedIndices={reveal.lockedIndices}
          picking={picking}
          selectable={selectableArr}
          chosen={chosen}
          onPick={handlePick}
          promptText={promptText}
          pickRuleName={pendingSelection?.ruleName}
        />
      )}

      {celebration?.kind === "jackpot" && <JackpotCelebration />}
      {celebration?.kind === "extra" && <ExtraRuleCelebration />}
      {celebration?.kind === "multiplier" && (
        <MultiplierCelebration multiplier={celebration.value} />
      )}
    </main>
  );
}
