"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import StatusBar from "@/components/StatusBar";
import RuleSlots from "@/components/RuleSlots";
import RulePicker from "@/components/RulePicker";
import SlotMachine from "@/components/SlotMachine";
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

  const latestLog = spinLogs[spinLogs.length - 1] ?? null;

  const reveal = useSpinReveal(latestLog, currentResult);

  // Celebrations fire once the reveal completes for the latest log.
  const [celebration, setCelebration] = useState<Celebration>(null);
  const [celebratedIndex, setCelebratedIndex] = useState(-1);

  useEffect(() => {
    if (!latestLog || !reveal.scoreReady) return;
    if (latestLog.spinIndex === celebratedIndex) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCelebratedIndex(latestLog.spinIndex);

    let next: Celebration = null;
    const bigWin =
      latestLog.sevenScore >= 777 || latestLog.roundScore >= 500;
    if (bigWin) next = { kind: "jackpot" };
    else if (latestLog.multiplierSet > 1)
      next = { kind: "multiplier", value: latestLog.multiplierSet };
    else if (latestLog.zeroDraw) next = { kind: "extra" };

    if (!next) return;
    setCelebration(next);
    const t = setTimeout(() => setCelebration(null), CELEBRATION_MS);
    return () => clearTimeout(t);
  }, [latestLog, reveal.scoreReady, celebratedIndex]);

  const showSlot =
    status === "ready-to-spin" ||
    status === "spinning" ||
    status === "spin-result";

  // Score panel waits for the on-reel reveal to finish.
  const showScore =
    status === "spin-result" && latestLog && reveal.scoreReady;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <StatusBar />
      <RuleSlots />

      {status === "choosing-rule" && <RulePicker />}

      {showSlot && (
        <SlotMachine
          symbols={reveal.symbols}
          reelRolling={reveal.reelRolling}
          flashIndices={reveal.flashIndices}
          landIndices={reveal.landIndices}
          stepLabel={reveal.stepLabel}
          revealing={reveal.revealing}
        />
      )}

      {showScore && (
        <>
          <ScorePanel log={latestLog} />
          {latestLog.steps.length > 0 && <SpinResultLog log={latestLog} />}
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
