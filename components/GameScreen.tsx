"use client";

import { useGameStore } from "@/store/gameStore";
import StatusBar from "@/components/StatusBar";
import RuleSlots from "@/components/RuleSlots";
import RulePicker from "@/components/RulePicker";
import SlotMachine from "@/components/SlotMachine";
import ScorePanel from "@/components/ScorePanel";
import SpinResultLog from "@/components/SpinResultLog";

export default function GameScreen() {
  const status = useGameStore((s) => s.status);
  const spinLogs = useGameStore((s) => s.spinLogs);

  const latestLog = spinLogs[spinLogs.length - 1] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <StatusBar />
      <RuleSlots />

      {status === "choosing-rule" && <RulePicker />}

      {/* choosing-slot: the slot picker UI lives inside RuleSlots above. */}

      {(status === "ready-to-spin" ||
        status === "spinning" ||
        status === "spin-result") && <SlotMachine />}

      {status === "spin-result" && latestLog && (
        <>
          <ScorePanel log={latestLog} />
          {latestLog.steps.length > 0 && <SpinResultLog log={latestLog} />}
        </>
      )}
    </main>
  );
}
