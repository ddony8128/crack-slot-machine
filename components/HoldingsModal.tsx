"use client";

import type { SymbolType } from "@/types";
import Modal from "@/components/Modal";
import SymbolPool from "@/components/SymbolPool";
import { RULES_BY_ID } from "@/data/rules";
import { ARTIFACTS_BY_ID } from "@/lib/spire/artifacts";

type RuleRow = { id: string; name: string; description: string; count: number };

/**
 * Collapse the rule pool for display: rules with the SAME name (only the NOTHING
 * placeholders share a name — every other rule's name is unique) merge into one
 * row with a × count, so "NOTHING × 3" shows accurately instead of 3 rows.
 */
function aggregateRules(ruleIds: string[]): RuleRow[] {
  const byName = new Map<string, RuleRow>();
  for (const id of ruleIds) {
    const rule = RULES_BY_ID[id];
    const name = rule?.name ?? id;
    const existing = byName.get(name);
    if (existing) existing.count += 1;
    else byName.set(name, { id, name, description: rule?.description ?? "", count: 1 });
  }
  return [...byName.values()];
}

/**
 * 보유 현황 — the 첨탑 player's current holdings in one place: the symbol pouch
 * (with roll weights, since the count IS the probability), the rule pool, and the
 * owned artifacts, each with its effect description. Fed from the active run's
 * RunConfig (baseWeights / rulePoolIds / artifacts).
 */
export default function HoldingsModal({
  open,
  onClose,
  weights,
  ruleIds,
  artifactIds,
}: {
  open: boolean;
  onClose: () => void;
  weights: Record<SymbolType, number>;
  ruleIds: string[];
  artifactIds: string[];
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="보유 현황">
      <div className="flex max-h-[88vh] flex-col gap-5 overflow-y-auto p-6">
        <h2 className="text-xl font-black tracking-tight text-amber-300">
          보유 현황
        </h2>

        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            심볼 주머니
          </h3>
          <p className="text-xs text-zinc-500">
            매 스핀 이 주머니에서 뽑습니다. ×N은 등장 확률(가중치)입니다.
          </p>
          <SymbolPool weights={weights} showWeights />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            규칙 풀 ({ruleIds.length})
          </h3>
          <ul className="space-y-1.5">
            {aggregateRules(ruleIds).map(({ id, name, description, count }) => (
              <li key={id} className="space-y-0.5">
                <span className="text-sm font-bold text-emerald-300">
                  {name}
                  {count > 1 && (
                    <span className="ml-1 text-zinc-400">× {count}</span>
                  )}
                </span>
                {description && (
                  <p className="text-xs leading-snug text-zinc-400">
                    {description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {artifactIds.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
              아티팩트 ({artifactIds.length})
            </h3>
            <ul className="space-y-1.5">
              {artifactIds.map((id, i) => {
                const art = ARTIFACTS_BY_ID[id];
                return (
                  <li key={`${id}-${i}`} className="space-y-0.5">
                    <span className="text-sm font-bold text-amber-200">
                      {art?.name ?? id}
                    </span>
                    {art?.description && (
                      <p className="text-xs leading-snug text-zinc-400">
                        {art.description}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-6 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          닫기
        </button>
      </div>
    </Modal>
  );
}
