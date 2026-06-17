"use client";

import { useState } from "react";
import type { SpireRunState, SetBonusUpgradeKind } from "@/lib/spire/state";
import { SPIRE_UPGRADEABLE_HANDS, listUpgradeableSetBonuses } from "@/lib/spire/state";
import type { SpireShopOffers } from "@/lib/spire/shop";
import { SYMBOL_SETS_BY_ID, type SetBonus } from "@/lib/symbols/sets";
import { SYMBOL_EMOJI } from "@/data/symbols";
import { RULES_BY_ID } from "@/data/rules";
import { ARTIFACTS_BY_ID } from "@/lib/spire/artifacts";
import { SPIRE_ARTIFACTS, SPIRE_RULE_POOL_MAX } from "@/lib/spire/config";
import type { SymbolType } from "@/types";

const ARTIFACT_NAME: Record<string, string> = Object.fromEntries(
  SPIRE_ARTIFACTS.map((a) => [a.id, a.name]),
);

/** Emoji for a symbol id, falling back to the id itself. */
function emojiFor(id: string): string {
  return SYMBOL_EMOJI[id as SymbolType] ?? id;
}

function ruleName(id: string): string {
  return RULES_BY_ID[id]?.name ?? id;
}

const PER_EVENT_KO: Record<"moved" | "rerolled" | "copied", string> = {
  moved: "이동",
  rerolled: "재굴림",
  copied: "복사",
};

/** Short shop label for a set bonus (e.g. "과일 3종 (+50)", "이웃 고양이 (−60)"). */
function setBonusLabel(setName: string, bonus: SetBonus): string {
  const pts = bonus.points >= 0 ? `+${bonus.points}` : `${bonus.points}`;
  switch (bonus.type) {
    case "all-types":
      return `${setName} 3종 (${pts})`;
    case "all-symbols":
      return `올 ${setName} (${pts})`;
    case "per-symbol":
      return `${setName} 1개당 (${pts})`;
    case "adjacent-penalty":
      return `이웃 ${setName} (${pts})`;
    case "per-event":
      return `${setName} ${PER_EVENT_KO[bonus.event]} (${pts})`;
  }
}

/** Bag symbols with count ≥ 1, as [id, count] rows. */
function bagRows(bag: Record<string, number>): Array<[string, number]> {
  return Object.entries(bag).filter(([, c]) => c > 0);
}

export type SpireShopProps = {
  runState: SpireRunState;
  offers: SpireShopOffers;
  onBuySymbol: (targetSymbolId: string, replacedSymbolId: string) => void;
  onBuySet: (setId: string, replacedSymbolIds: string[], removedRuleIds: string[]) => void;
  onBuyRule: (ruleId: string, removedRuleId?: string) => void;
  onBuyArtifact: (artifactId: string, price: number) => void;
  onBuyHandFlat: (handType: string) => void;
  onBuyHandDouble: (handType: string) => void;
  onBuySetBonus: (key: string, kind: SetBonusUpgradeKind) => void;
  onReroll: () => void;
  onLeave: () => void;
  /** True when the next reroll is free (차임벨: first 2 rerolls per shop visit). */
  rerollFree?: boolean;
};

type ModalState =
  | { kind: "symbol"; targetSymbolId: string; price: number }
  | { kind: "set"; setId: string }
  | { kind: "rule"; ruleId: string }
  | null;

export default function SpireShop({
  runState,
  offers,
  onBuySymbol,
  onBuySet,
  onBuyRule,
  onBuyArtifact,
  onBuyHandFlat,
  onBuyHandDouble,
  onBuySetBonus,
  onReroll,
  onLeave,
  rerollFree = false,
}: SpireShopProps) {
  const money = runState.money;
  const [modal, setModal] = useState<ModalState>(null);

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight text-amber-300">상점</h1>
        <span className="rounded-lg bg-amber-950/40 px-3 py-1 text-sm font-bold text-amber-200">
          보유 돈 {money}원
        </span>
      </header>

      {/* Owned artifacts (chosen at 3/6/9 or bought below) — expand for the
          full effect description (ARTIFACTS_BY_ID). */}
      {runState.artifacts.length > 0 && (
        <Section title="보유 아티팩트">
          <div className="flex flex-col gap-1.5">
            {runState.artifacts.map((id) => {
              const def = ARTIFACTS_BY_ID[id];
              return (
                <details
                  key={id}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-1.5"
                >
                  <summary className="cursor-pointer text-sm font-bold text-emerald-200">
                    {def?.name ?? ARTIFACT_NAME[id] ?? id}
                  </summary>
                  {def?.description && (
                    <p className="mt-1 text-xs text-zinc-400">{def.description}</p>
                  )}
                </details>
              );
            })}
          </div>
        </Section>
      )}

      {/* Artifact purchase (seeded offers, prices 6/5/4). */}
      {offers.artifacts.length > 0 && (
        <Section title="아티팩트 구매">
          <div className="flex flex-col gap-2">
            {offers.artifacts.map((a) => {
              const def = ARTIFACTS_BY_ID[a.id];
              const soldOut = runState.artifacts.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={soldOut || a.price > money}
                  onClick={() => onBuyArtifact(a.id, a.price)}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-left text-sm transition enabled:hover:border-emerald-400 disabled:opacity-40"
                >
                  <span className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300">{def?.name ?? a.id}</span>
                    <span className="font-bold text-amber-200">
                      {soldOut ? "품절" : `${a.price}원`}
                    </span>
                  </span>
                  {def?.description && (
                    <span className="text-xs text-zinc-400">{def.description}</span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Symbol increments */}
      <Section title="심볼 조정">
        <div className="flex flex-col gap-2">
          {offers.symbols.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={s.price > money}
              onClick={() => setModal({ kind: "symbol", targetSymbolId: s.id, price: s.price })}
              className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm transition enabled:hover:border-emerald-400 disabled:opacity-40"
            >
              <span>
                {emojiFor(s.id)} 늘리기{" "}
                <span className="text-zinc-500">(현재 {s.count})</span>
              </span>
              <span className="font-bold text-amber-200">{s.price}원</span>
            </button>
          ))}
        </div>
      </Section>

      {/* New sets */}
      {offers.sets.length > 0 && (
        <Section title="새 세트 구매">
          <div className="flex flex-col gap-2">
            {offers.sets.map((set) => {
              const def = SYMBOL_SETS_BY_ID[set.id];
              const soldOut = runState.ownedSetIds.includes(set.id);
              return (
                <button
                  key={set.id}
                  type="button"
                  disabled={soldOut || set.price > money}
                  onClick={() => setModal({ kind: "set", setId: set.id })}
                  className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm transition enabled:hover:border-emerald-400 disabled:opacity-40"
                >
                  <span>
                    {def ? `${def.name} 세트 ` : set.id}{" "}
                    <span className="text-lg">
                      {def?.symbols.map((sy) => sy.emoji).join(" ")}
                    </span>
                  </span>
                  <span className="font-bold text-amber-200">
                    {soldOut ? "품절" : `${set.price}원`}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Rules */}
      {offers.rules.length > 0 && (
        <Section title="규칙 구매">
          <div className="flex flex-col gap-2">
            {offers.rules.map((r) => {
              const soldOut = runState.rulePool.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={soldOut || r.price > money}
                  onClick={() => {
                    if (runState.rulePool.length >= SPIRE_RULE_POOL_MAX) {
                      setModal({ kind: "rule", ruleId: r.id });
                    } else {
                      onBuyRule(r.id);
                    }
                  }}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-left text-sm transition enabled:hover:border-emerald-400 disabled:opacity-40"
                >
                  <span className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100">{ruleName(r.id)}</span>
                    <span className="font-bold text-amber-200">
                      {soldOut ? "품절" : `${r.price}원`}
                    </span>
                  </span>
                  {RULES_BY_ID[r.id]?.description && (
                    <span className="text-xs text-zinc-400">
                      {RULES_BY_ID[r.id]?.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Hand upgrades */}
      <Section title="족보 강화">
        <div className="flex flex-col gap-2">
          {SPIRE_UPGRADEABLE_HANDS.map((hand) => {
            const up = runState.handUpgrades[hand];
            // +50 / ×2 are each buyable ONCE per hand (기획).
            const flatDone = (up?.flatBonusCount ?? 0) >= 1;
            const doubleDone = (up?.doubleCount ?? 0) >= 1;
            return (
              <div key={hand} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex-1 truncate">
                  {hand}
                  {up && (up.flatBonusCount > 0 || up.doubleCount > 0) ? (
                    <span className="ml-1 text-xs text-emerald-300">
                      +{up.flatBonusCount * 50} ×{Math.pow(2, up.doubleCount)}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={flatDone || offers.handFlatPrice > money}
                  onClick={() => onBuyHandFlat(hand)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 transition enabled:hover:border-emerald-400 disabled:opacity-40"
                >
                  {flatDone ? (
                    "+50점 완료"
                  ) : (
                    <>
                      +50점 <span className="text-amber-200">({offers.handFlatPrice}원)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={doubleDone || offers.handDoublePrice > money}
                  onClick={() => onBuyHandDouble(hand)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 transition enabled:hover:border-emerald-400 disabled:opacity-40"
                >
                  {doubleDone ? (
                    "×2 완료"
                  ) : (
                    <>
                      ×2 <span className="text-amber-200">({offers.handDoublePrice}원)</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {/* Owned-set bonuses — same 족보 강화 section. Positive: +50점 / ×2 (each
              once). Penalty (이웃 고양이): 완화만 (once). */}
          {listUpgradeableSetBonuses(runState.ownedSetIds).map((e) => {
            const up = runState.setBonusUpgrades[e.key];
            const flatDone = (up?.flatBonusCount ?? 0) >= 1;
            const doubleDone = (up?.doubleCount ?? 0) >= 1;
            const mitigateDone = (up?.mitigateCount ?? 0) >= 1;
            return (
              <div key={e.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex-1 truncate">{setBonusLabel(e.setName, e.bonus)}</span>
                {e.isPenalty ? (
                  <button
                    type="button"
                    disabled={mitigateDone || offers.handFlatPrice > money}
                    onClick={() => onBuySetBonus(e.key, "mitigate")}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 transition enabled:hover:border-emerald-400 disabled:opacity-40"
                  >
                    {mitigateDone ? (
                      "완화 완료"
                    ) : (
                      <>
                        완화 <span className="text-amber-200">({offers.handFlatPrice}원)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={flatDone || offers.handFlatPrice > money}
                      onClick={() => onBuySetBonus(e.key, "flat")}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 transition enabled:hover:border-emerald-400 disabled:opacity-40"
                    >
                      {flatDone ? (
                        "+50점 완료"
                      ) : (
                        <>
                          +50점 <span className="text-amber-200">({offers.handFlatPrice}원)</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={doubleDone || offers.handDoublePrice > money}
                      onClick={() => onBuySetBonus(e.key, "double")}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 transition enabled:hover:border-emerald-400 disabled:opacity-40"
                    >
                      {doubleDone ? (
                        "×2 완료"
                      ) : (
                        <>
                          ×2 <span className="text-amber-200">({offers.handDoublePrice}원)</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={!rerollFree && offers.rerollPrice > money}
          onClick={onReroll}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm font-bold text-zinc-200 transition enabled:hover:border-amber-400 disabled:opacity-40"
        >
          {rerollFree
            ? "상점 리롤 (무료 · 차임벨)"
            : `상점 리롤 (${offers.rerollPrice}원)`}
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          다음으로
        </button>
      </div>

      {modal?.kind === "symbol" && (
        <ReplacePicker
          title={`${emojiFor(modal.targetSymbolId)} 늘리기 — 줄일 심볼 1개 선택`}
          rows={bagRows(runState.symbolBag).filter(([id]) => id !== modal.targetSymbolId)}
          need={1}
          onCancel={() => setModal(null)}
          onConfirm={(picks) => {
            setModal(null);
            onBuySymbol(modal.targetSymbolId, picks[0]);
          }}
        />
      )}

      {modal?.kind === "set" && (
        <SetBuyPicker
          setId={modal.setId}
          runState={runState}
          onCancel={() => setModal(null)}
          onConfirm={(replaced, removedRules) => {
            setModal(null);
            onBuySet(modal.setId, replaced, removedRules);
          }}
        />
      )}

      {modal?.kind === "rule" && (
        <ReplacePicker
          title="규칙 풀이 가득 찼습니다 — 제거할 규칙 1개 선택"
          rows={runState.rulePool.map((id) => [id, 1] as [string, number])}
          need={1}
          label={ruleName}
          describe={(id) => RULES_BY_ID[id]?.description}
          columns={1}
          onCancel={() => setModal(null)}
          onConfirm={(picks) => {
            setModal(null);
            onBuyRule(modal.ruleId, picks[0]);
          }}
        />
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Generic picker that lets the player choose exactly `need` items from `rows`
 * ([id, count]). Counting duplicates: picking the same id repeats up to its
 * count. Returns a flat array of chosen ids (length === need).
 */
function ReplacePicker({
  title,
  rows,
  need,
  label = emojiFor,
  describe,
  columns = 3,
  onConfirm,
  onCancel,
}: {
  title: string;
  rows: Array<[string, number]>;
  need: number;
  label?: (id: string) => string;
  /** Optional effect description shown under each option (e.g. rule text). */
  describe?: (id: string) => string | undefined;
  /** Grid column count (default 3); use 1 when showing descriptions. */
  columns?: 1 | 2 | 3;
  onConfirm: (picks: string[]) => void;
  onCancel: () => void;
}) {
  const [picks, setPicks] = useState<string[]>([]);
  const countOf = (id: string) => picks.filter((p) => p === id).length;
  const gridCols =
    columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-2" : "grid-cols-3";

  function toggle(id: string, max: number) {
    setPicks((prev) => {
      const cur = prev.filter((p) => p === id).length;
      if (cur >= max || prev.length >= need) {
        // remove one occurrence of this id (cycle off)
        const idx = prev.lastIndexOf(id);
        if (idx >= 0) return prev.filter((_, i) => i !== idx);
        return prev;
      }
      return [...prev, id];
    });
  }

  return (
    <Overlay>
      <p className="text-sm font-bold text-zinc-100">{title}</p>
      <div className={`grid ${gridCols} gap-2`}>
        {rows.map(([id, max]) => {
          const c = countOf(id);
          const desc = describe?.(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id, max)}
              className={`flex flex-col gap-0.5 rounded-lg border px-2 py-2 text-left text-sm transition ${
                c > 0
                  ? "border-emerald-400 bg-emerald-950/40 text-emerald-200"
                  : "border-zinc-700 bg-zinc-900/60 text-zinc-200"
              }`}
            >
              <span>
                {label(id)}
                <span className="ml-1 text-xs text-zinc-500">
                  ×{max}
                  {c > 0 ? ` (선택 ${c})` : ""}
                </span>
              </span>
              {desc && <span className="text-xs text-zinc-400">{desc}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300"
        >
          취소
        </button>
        <button
          type="button"
          disabled={picks.length !== need}
          onClick={() => onConfirm(picks)}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950 disabled:opacity-40"
        >
          확인 ({picks.length}/{need})
        </button>
      </div>
    </Overlay>
  );
}

/**
 * The new-set flow: choose 3 bag symbols to replace; if owning the set's new
 * rules would push the pool over the cap, also choose enough rules to remove.
 * We can't know the seeded gained-rule ids here, so we conservatively allow the
 * player to remove up to (currentPool + 2 - max) rules; the reducer validates.
 */
function SetBuyPicker({
  setId,
  runState,
  onConfirm,
  onCancel,
}: {
  setId: string;
  runState: SpireRunState;
  onConfirm: (replaced: string[], removedRules: string[]) => void;
  onCancel: () => void;
}) {
  const [replaced, setReplaced] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const overflow = Math.max(0, runState.rulePool.length + 2 - SPIRE_RULE_POOL_MAX);
  const rows = bagRows(runState.symbolBag);
  const setName = SYMBOL_SETS_BY_ID[setId]?.name ?? setId;

  function toggleReplace(id: string, max: number) {
    setReplaced((prev) => {
      const cur = prev.filter((p) => p === id).length;
      if (cur >= max || prev.length >= 3) {
        const idx = prev.lastIndexOf(id);
        if (idx >= 0) return prev.filter((_, i) => i !== idx);
        return prev;
      }
      return [...prev, id];
    });
  }

  function toggleRemove(id: string) {
    setRemoved((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= overflow
          ? prev
          : [...prev, id],
    );
  }

  const ready = replaced.length === 3 && removed.length >= overflow;

  return (
    <Overlay>
      <p className="text-sm font-bold text-zinc-100">{setName} 세트 — 교체할 심볼 3개 선택</p>
      <div className="grid grid-cols-3 gap-2">
        {rows.map(([id, max]) => {
          const c = replaced.filter((p) => p === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleReplace(id, max)}
              className={`rounded-lg border px-2 py-2 text-sm transition ${
                c > 0
                  ? "border-emerald-400 bg-emerald-950/40 text-emerald-200"
                  : "border-zinc-700 bg-zinc-900/60 text-zinc-200"
              }`}
            >
              {emojiFor(id)}
              <span className="ml-1 text-xs text-zinc-500">
                ×{max}
                {c > 0 ? ` (선택 ${c})` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {overflow > 0 && (
        <>
          <p className="text-sm font-bold text-zinc-100">
            제거할 규칙 {overflow}개 이상 선택
          </p>
          <div className="grid grid-cols-1 gap-2">
            {runState.rulePool.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleRemove(id)}
                className={`flex flex-col gap-0.5 rounded-lg border px-2 py-2 text-left text-xs transition ${
                  removed.includes(id)
                    ? "border-rose-400 bg-rose-950/40 text-rose-200"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-200"
                }`}
              >
                <span className="font-bold">{ruleName(id)}</span>
                {RULES_BY_ID[id]?.description && (
                  <span className="text-zinc-400">{RULES_BY_ID[id]?.description}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300"
        >
          취소
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => onConfirm(replaced, removed)}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950 disabled:opacity-40"
        >
          확인
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
        {children}
      </div>
    </div>
  );
}
