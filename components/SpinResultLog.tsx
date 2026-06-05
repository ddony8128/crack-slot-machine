"use client";

import type { SpinLog } from "@/types";
import SymbolView from "@/components/SymbolView";

function ResultRow({
  label,
  result,
  emphasize = false,
}: {
  label: string;
  result: SpinLog["finalResult"];
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span
        className={`text-xs font-semibold ${
          emphasize ? "text-amber-300" : "text-zinc-400"
        }`}
      >
        {label}
      </span>
      <div className="flex gap-1">
        {result.map((s, i) => (
          <SymbolView key={i} symbol={s} size="sm" />
        ))}
      </div>
    </div>
  );
}

/**
 * Shows how a spin's base roll was transformed by each equipped rule.
 * Only renders the step list when there are applied steps.
 */
export default function SpinResultLog({ log }: { log: SpinLog }) {
  const hasSteps = log.steps.length > 0;

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        규칙 적용 과정
      </h3>

      <ResultRow label="기본 결과" result={log.baseResult} />

      {hasSteps &&
        log.steps.map((step, i) => (
          <ResultRow key={i} label={step.label} result={step.result} />
        ))}

      <div className="my-1 border-t border-zinc-800" />

      <ResultRow label="최종 결과" result={log.finalResult} emphasize />
    </div>
  );
}
