"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Rule } from "@/types";
import { useGameStore } from "@/store/gameStore";
import type { RuleLocation } from "@/store/gameStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import RuleCard from "@/components/RuleCard";

type DragData = { loc: RuleLocation; rule: Rule };
type DropData = { loc: RuleLocation };

/** Encode a RuleLocation into a stable DnD id. */
function dragId(loc: RuleLocation): string {
  return `drag:${loc.zone}:${loc.index}`;
}
function dropId(loc: RuleLocation): string {
  return `drop:${loc.zone}:${loc.index}`;
}

function DraggableRule({
  loc,
  rule,
  disabled,
  children,
}: {
  loc: RuleLocation;
  rule: Rule;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(loc),
    data: { loc, rule } satisfies DragData,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`outline-none ${
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${isDragging ? "opacity-30" : ""}`}
    >
      {children}
    </div>
  );
}

function SlotRow({
  index,
  rule,
  active,
  placing,
  draggable,
  onPlace,
}: {
  index: number;
  rule: Rule | null;
  active: boolean; // is a valid drop target (placing/dnd)
  placing: boolean;
  draggable: boolean;
  onPlace: () => void;
}) {
  const loc: RuleLocation = { zone: "slot", index };
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(loc),
    data: { loc } satisfies DropData,
  });

  const highlight = placing
    ? "border-amber-400/80 bg-amber-500/10 ring-1 ring-amber-400/40"
    : "border-zinc-800 bg-zinc-900/50";
  const overRing = isOver ? "ring-2 ring-emerald-400/80 bg-emerald-500/10" : "";

  const body = rule ? (
    <RuleCard rule={rule} />
  ) : (
    <span className="text-sm text-zinc-600">비어 있음</span>
  );

  return (
    <div
      ref={setNodeRef}
      onClick={placing ? onPlace : undefined}
      className={`flex items-center gap-3 rounded-xl border p-3 transition ${highlight} ${overRing} ${
        placing ? "cursor-pointer hover:bg-amber-500/20" : ""
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-sm font-bold text-amber-300 ring-1 ring-zinc-700">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        {rule && draggable ? (
          <DraggableRule loc={loc} rule={rule} disabled={!active}>
            {body}
          </DraggableRule>
        ) : (
          body
        )}
      </div>
    </div>
  );
}

function BagArea({
  bag,
  placing,
  draggable,
  onPlace,
}: {
  bag: Rule[];
  placing: boolean;
  draggable: boolean;
  onPlace: () => void;
}) {
  // Drop target representing "append to end of bag".
  const appendLoc: RuleLocation = { zone: "bag", index: bag.length };
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(appendLoc),
    data: { loc: appendLoc } satisfies DropData,
  });

  const overRing =
    isOver && bag.length === 0
      ? "ring-2 ring-emerald-400/80 bg-emerald-500/10"
      : "";

  return (
    <div
      ref={setNodeRef}
      onClick={placing ? onPlace : undefined}
      className={`min-h-20 rounded-xl border p-3 transition ${
        placing
          ? "cursor-pointer border-amber-400/80 bg-amber-500/10 ring-1 ring-amber-400/40 hover:bg-amber-500/20"
          : "border-zinc-800 bg-zinc-900/40"
      } ${overRing}`}
    >
      {bag.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-600">
          가방이 비어 있습니다 (비활성 규칙 보관)
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bag.map((rule, i) => (
            <BagItem
              key={rule.id}
              index={i}
              rule={rule}
              draggable={draggable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BagItem({
  index,
  rule,
  draggable,
}: {
  index: number;
  rule: Rule;
  draggable: boolean;
}) {
  const loc: RuleLocation = { zone: "bag", index };
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(loc),
    data: { loc } satisfies DropData,
  });

  const overRing = isOver ? "ring-2 ring-emerald-400/80 bg-emerald-500/10" : "";

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-zinc-800 bg-zinc-900/70 p-2.5 transition ${overRing}`}
    >
      {draggable ? (
        <DraggableRule loc={loc} rule={rule} disabled={false}>
          <RuleCard rule={rule} />
        </DraggableRule>
      ) : (
        <RuleCard rule={rule} />
      )}
    </div>
  );
}

export default function RuleSlots() {
  const ruleSlots = useGameStore((s) => s.ruleSlots);
  const bag = useGameStore((s) => s.bag);
  const status = useGameStore((s) => s.status);
  const pendingRule = useGameStore((s) => s.pendingRule);
  const placePending = useGameStore((s) => s.placePending);
  const cancelSelection = useGameStore((s) => s.cancelSelection);
  const moveRule = useGameStore((s) => s.moveRule);
  const reduced = useReducedMotion();

  const placing = status === "placing";
  // Free arranging via DnD allowed during ready-to-spin AND placing.
  const arranging = status === "ready-to-spin" || status === "placing";

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (data) setActiveDrag(data);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const from = (e.active.data.current as DragData | undefined)?.loc;
    const to = (e.over?.data.current as DropData | undefined)?.loc;
    if (!from || !to) return;
    if (from.zone === to.zone && from.index === to.index) return;
    moveRule(from, to);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Rule Slots
          </h2>
          <span className="flex items-center gap-1 rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-300 ring-1 ring-zinc-700">
            <span aria-hidden>▼</span> 위 → 아래 순서로 적용
          </span>
        </div>

        {placing && pendingRule && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-zinc-200">
              배치할 규칙:{" "}
              <span className="font-bold text-amber-300">
                {pendingRule.name}
              </span>{" "}
              <span className="text-zinc-400">— 슬롯이나 가방을 클릭/드롭</span>
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

        <div className="flex flex-col gap-2">
          {ruleSlots.map((rule, i) => (
            <SlotRow
              key={i}
              index={i}
              rule={rule}
              active={arranging}
              placing={placing}
              draggable={arranging}
              onPlace={() => placePending({ type: "slot", index: i })}
            />
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Bag (비활성)
          </h3>
          <BagArea
            bag={bag}
            placing={placing}
            draggable={arranging}
            onPlace={() => placePending({ type: "bag" })}
          />
        </div>
      </section>

      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {activeDrag ? (
          <div className="rounded-lg border border-emerald-400/60 bg-zinc-900 p-2.5 shadow-xl shadow-emerald-500/20">
            <RuleCard rule={activeDrag.rule} dense />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
