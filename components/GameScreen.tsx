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
import { play as playSound } from "@/lib/sound";

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
  const revealStream = useGameStore((s) => s.revealStream);

  const latestLog = spinLogs[spinLogs.length - 1] ?? null;

  const reveal = useSpinReveal(revealStream, currentResult);

  // Local picking state: indices the player has clicked so far during a
  // 'select' rule. Cleared whenever we leave 'awaiting-selection'.
  const [chosen, setChosen] = useState<number[]>([]);

  // The picker is shown ONLY once the step animation has caught up to the
  // pending select rule (reveal.readyForPick). Until then the stage shows the
  // step animation with no picker yet.
  const picking =
    status === "awaiting-selection" &&
    pendingSelection != null &&
    reveal.readyForPick;

  // Reset local picks whenever there is no active selection to pick for, or when
  // a new pendingSelection arrives (e.g. a second select rule in the same spin).
  useEffect(() => {
    if (status !== "awaiting-selection") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChosen([]);
    }
  }, [status, pendingSelection]);

  const selectableArr = pendingSelection
    ? pendingSelection.selectable.flatMap((ok, i) => (ok ? [i] : []))
    : [];

  // Cells haunted this spin (RULE SLOT monster-haunt) -> 👻 badge. Derived from the
  // latest log (acceptable for v0; the reveal shares the same spin's board).
  const hauntedIndices = latestLog
    ? latestLog.haunted.flatMap((h, i) => (h ? [i] : []))
    : [];

  function handlePick(i: number) {
    if (!pendingSelection) return;
    const count = pendingSelection.count;
    if (count === 1) {
      selectCells([i]);
      return;
    }
    // count >= 2 (swap / park): collect `count` distinct picks; clicking an
    // already-chosen cell deselects it. Resolve once `count` cells are chosen.
    setChosen((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      const next = [...prev, i];
      if (next.length === count) {
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
        : pendingSelection.kind === "reroll"
          ? "다시 굴릴 칸을 선택하세요"
          : pendingSelection.kind === "family"
            ? "복사할 칸을 선택하세요 (가장 왼쪽 드라큘라가 복사됩니다)"
            : pendingSelection.kind === "catswap"
              ? "옮길 칸을 선택하세요 (교통수단 옆 고양이가 이 칸으로 이동합니다)"
              : `주차할 교통수단 칸을 선택하세요 (${chosen.length}/${pendingSelection.count})`
    : "";

  // Celebrations fire once the reveal completes for the latest log.
  const [celebration, setCelebration] = useState<Celebration>(null);
  // Track the already-celebrated spin by log OBJECT IDENTITY (spinIndex repeats
  // after an extra rule pick, so it can't identify a unique spin).
  const celebratedLogRef = useRef<SpinLog | null>(null);
  // "Armed" only after we've observed scoreReady go FALSE (i.e. a new reveal has
  // started). This prevents firing on the stale scoreReady=true left over from
  // the previous spin the instant the new log appears (which spoiled the result).
  const armedRef = useRef(false);
  useEffect(() => {
    if (!reveal.scoreReady) armedRef.current = true;
  }, [reveal.scoreReady]);

  // Trigger effect: decide whether the latest resolved spin warrants a celebration.
  useEffect(() => {
    if (!latestLog || !reveal.scoreReady || !armedRef.current) return;
    if (latestLog === celebratedLogRef.current) return;
    armedRef.current = false;
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

  // The cinematic SpinStage is shown for the whole life of a spin — rolling,
  // step animation, and awaiting input — and hides only once the reveal has
  // fully finished (done + animation settled → scoreReady). The inline reels
  // hide behind it.
  const stageActive = revealStream != null && !reveal.scoreReady;

  // --- Sound triggers (refs guard against duplicate plays on re-render) ---
  // 'rule': once per rule-application step, as each new non-null stepLabel shows.
  const lastStepLabelRef = useRef<string | null>(null);
  useEffect(() => {
    const label = reveal.stepLabel;
    if (label && label !== lastStepLabelRef.current) {
      lastStepLabelRef.current = label;
      playSound("rule");
    } else if (!label) {
      // Reset between steps so a repeated label on the next step still fires.
      lastStepLabelRef.current = null;
    }
  }, [reveal.stepLabel]);

  // 'score': when the score panel first becomes visible for a spin.
  const scorePlayedRef = useRef(false);
  useEffect(() => {
    if (showScore) {
      if (!scorePlayedRef.current) {
        scorePlayedRef.current = true;
        playSound("score");
      }
    } else {
      scorePlayedRef.current = false;
    }
  }, [showScore]);

  // 'jackpot': when a jackpot celebration fires.
  const jackpotPlayedRef = useRef(false);
  useEffect(() => {
    if (celebration?.kind === "jackpot") {
      if (!jackpotPlayedRef.current) {
        jackpotPlayedRef.current = true;
        playSound("jackpot");
      }
    } else {
      jackpotPlayedRef.current = false;
    }
  }, [celebration]);

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
          hauntedIndices={showScore ? hauntedIndices : []}
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
          symbols={reveal.symbols}
          reelRolling={reveal.reelRolling}
          flashIndices={reveal.flashIndices}
          landIndices={reveal.landIndices}
          stepLabel={reveal.stepLabel}
          lockedIndices={reveal.lockedIndices}
          hauntedIndices={hauntedIndices}
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
