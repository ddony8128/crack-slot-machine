"use client";

import { useEffect, useRef, useState } from "react";
import type { SpinLog } from "@/types";
import { useGameStore } from "@/store/gameStore";
import StatusBar from "@/components/StatusBar";
import RuleSlots from "@/components/RuleSlots";
import RulePicker from "@/components/RulePicker";
import SlotMachine from "@/components/SlotMachine";
import ScorePanel from "@/components/ScorePanel";
import SpinResultLog from "@/components/SpinResultLog";
import ScoreBreakdown from "@/components/ScoreBreakdown";
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

  const latestLog = spinLogs[spinLogs.length - 1] ?? null;

  const reveal = useSpinReveal(latestLog, currentResult);

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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <StatusBar />
      <RuleSlots />

      {showSlot && (
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
          <ScoreBreakdown log={latestLog} />
        </>
      )}

      {celebration?.kind === "jackpot" && <JackpotCelebration />}
      {celebration?.kind === "extra" && <ExtraRuleCelebration />}
      {celebration?.kind === "multiplier" && (
        <MultiplierCelebration multiplier={celebration.value} />
      )}
    </main>
  );
}
