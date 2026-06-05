"use client";

import { useGameStore } from "@/store/gameStore";

const SLOT_LABELS = ["A", "B", "C"] as const;

export default function RuleSlots() {
  const ruleSlots = useGameStore((s) => s.ruleSlots);
  const status = useGameStore((s) => s.status);
  const pendingRule = useGameStore((s) => s.pendingRule);
  const equipToSlot = useGameStore((s) => s.equipToSlot);
  const cancelSelection = useGameStore((s) => s.cancelSelection);

  const choosingSlot = status === "choosing-slot";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Rule Slots
        </h2>
        {choosingSlot && (
          <span className="text-xs font-semibold text-amber-300">
            어느 슬롯에 장착할까요?
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ruleSlots.map((rule, i) => {
          const slotIndex = i as 0 | 1 | 2;
          const selectable = choosingSlot;
          return (
            <button
              key={i}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && equipToSlot(slotIndex)}
              className={`flex h-full flex-col rounded-xl border p-3 text-left transition duration-150 ${
                selectable
                  ? "cursor-pointer border-amber-400/70 bg-amber-500/10 ring-1 ring-amber-400/40 hover:-translate-y-0.5 hover:bg-amber-500/20 hover:shadow-lg hover:shadow-amber-500/10 active:translate-y-0 active:scale-[0.99]"
                  : "cursor-default border-zinc-800 bg-zinc-900/50"
              }`}
            >
              <span className="mb-1 text-xs font-bold tracking-wide text-zinc-500">
                SLOT {SLOT_LABELS[i]}
              </span>
              {rule ? (
                <>
                  <span className="text-sm font-bold text-emerald-300">
                    {rule.name}
                  </span>
                  <span className="mt-1 text-xs leading-snug text-zinc-400">
                    {rule.description}
                  </span>
                </>
              ) : (
                <span className="text-sm text-zinc-600">비어 있음</span>
              )}
            </button>
          );
        })}
      </div>

      {choosingSlot && pendingRule && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <p className="text-sm text-zinc-300">
            장착할 규칙:{" "}
            <span className="font-bold text-amber-300">{pendingRule.name}</span>
          </p>
          <button
            type="button"
            onClick={cancelSelection}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
          >
            취소
          </button>
        </div>
      )}
    </section>
  );
}
