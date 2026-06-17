"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import {
  startSpire,
  submitSpire,
  fetchSpireCurrent,
  saveSpireProgress,
} from "@/lib/client/spireApi";
import { fetchMe } from "@/lib/client/authApi";
import { saveSpire, loadSpire, clearSpire, type SpireSave } from "@/lib/client/spireResume";
import { SYMBOL_SETS_BY_ID, type SetBonus } from "@/lib/symbols/sets";
import { RULES_BY_ID } from "@/data/rules";
import {
  SPIRE_STAGE_COUNT,
  SPIRE_ARTIFACT_STAGES,
  SPIRE_ARTIFACTS,
  SPIRE_MAX_FAILURES,
} from "@/lib/spire/config";
import {
  initialSpireState,
  applyInitialSetChoice,
  buySymbolIncrement,
  buySymbolSet,
  buyRule,
  buyArtifact,
  buyHandFlat,
  buyHandDouble,
  buySetBonus,
  type SetBonusUpgradeKind,
  rerollShop,
  settleClear,
  settleFail,
  applyArtifactAcquire,
  type SpireRunState,
} from "@/lib/spire/state";
import {
  stageAttemptSeed,
  spireStageRunConfig,
  spireStageOutcome,
  spireStageTarget,
  goldBarMoney,
} from "@/lib/spire/stage";
import { spireShopOffers, spireRewardArtifacts, type SpireShopOffers } from "@/lib/spire/shop";
import { replaySpireRun, type SpireAction } from "@/lib/spire/replay";
import GameScreen from "@/components/GameScreen";
import SpireShop from "@/components/SpireShop";
import SpireResultScreen from "@/components/SpireResultScreen";
import DonationModal from "@/components/DonationModal";
import { useDonationPrompt } from "@/components/useDonationPrompt";
import ModeIntro from "@/components/ModeIntro";
import type { SeasonScoreChange } from "@/lib/season/scoring";

type Phase =
  | "loading"
  | "error"
  | "resume"
  | "choosing-set"
  | "playing"
  | "cleared"
  | "failed"
  | "artifact"
  | "shop"
  | "result";

type ClearBreakdown = { interest: number; spinBonus: number; payout: number } | null;
type FailBreakdown = { stage: number; failures: number; support: number } | null;
type SubmitState = "submitting" | "submitted" | "rejected" | "error" | "version_mismatch";

const ARTIFACT_BY_ID = Object.fromEntries(SPIRE_ARTIFACTS.map((a) => [a.id, a]));

/** Rule display name, falling back to the id. */
function ruleNameOf(id: string): string {
  return RULES_BY_ID[id]?.name ?? id;
}

const PER_EVENT_LABEL: Record<"moved" | "rerolled" | "copied", string> = {
  moved: "이동",
  rerolled: "재굴림",
  copied: "복사",
};

/** Human-readable 족보 보너스 line for the set-choice card (기획 §17). */
function setBonusLabel(b: SetBonus): string {
  switch (b.type) {
    case "all-types":
      return `세트 3종 모두 등장 시 +${b.points}점`;
    case "all-symbols":
      return `5칸 모두 이 세트 심볼이면 +${b.points}점`;
    case "per-symbol":
      return `보드의 이 세트 심볼 1개당 +${b.points}점`;
    case "adjacent-penalty":
      return `인접한 같은 세트 쌍마다 ${b.points}점`;
    case "per-event":
      return `${PER_EVENT_LABEL[b.event]} 1회당 +${b.points}점`;
  }
}

export default function SpireClient() {
  // Active-stage store (one RC run per stage attempt).
  const status = useGameStore((s) => s.status);
  const spinLogs = useGameStore((s) => s.spinLogs);
  const beginRun = useGameStore((s) => s.beginRun);
  const configureRun = useGameStore((s) => s.configureRun);
  const startGame = useGameStore((s) => s.startGame);
  const setNickname = useGameStore((s) => s.setNickname);
  const reset = useGameStore((s) => s.reset);
  const getActions = useGameStore((s) => s.getActions);

  const router = useRouter();

  // Resolve any saved run during the first render (loadSpire is SSR-guarded).
  const [phase, setPhase] = useState<Phase>(() =>
    loadSpire() ? "resume" : "loading",
  );
  const [error, setError] = useState<string>("");
  const [runId, setRunId] = useState<string>("");
  const [seed, setSeed] = useState<string>("");
  const [choices, setChoices] = useState<[string, string] | null>(null);
  const [resumeSave, setResumeSave] = useState<SpireSave | null>(() => loadSpire());

  const [runState, setRunState] = useState<SpireRunState | null>(null);
  const [spireActions, setSpireActions] = useState<SpireAction[]>([]);
  const [shopVisitIndex, setShopVisitIndex] = useState(0);
  const [rerollCount, setRerollCount] = useState(0);

  const [clearBreakdown, setClearBreakdown] = useState<ClearBreakdown>(null);
  const [failBreakdown, setFailBreakdown] = useState<FailBreakdown>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("submitting");
  const [seasonPoints, setSeasonPoints] = useState<number | null>(null);
  const [scoreChange, setScoreChange] = useState<SeasonScoreChange | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  // Banked spins over CLEARED stages only (mirrors lib/spire/verify.ts) — drives
  // the result-screen season-score breakdown (스테이지×100 + 돈×10 + 스핀×10).
  const [unusedSpins, setUnusedSpins] = useState(0);

  const me = useRef<{ nickname: string } | null>(null);
  const startedRef = useRef(false);
  const submittedRef = useRef(false);

  // Latest mutable copies for use inside callbacks without re-subscribing. These
  // are write-through: callbacks update both the ref (read synchronously by a
  // later callback in the same tick) and the state (for render). An effect below
  // also re-syncs them after every commit so they never drift.
  const runStateRef = useRef<SpireRunState | null>(null);
  const actionsRef = useRef<SpireAction[]>(spireActions);
  const runIdRef = useRef(runId);
  const seedRef = useRef(seed);
  useEffect(() => {
    runStateRef.current = runState;
    actionsRef.current = spireActions;
    runIdRef.current = runId;
    seedRef.current = seed;
  });

  /** Append a SpireAction and persist the in-progress run (when not over). */
  const recordAction = useCallback((action: SpireAction) => {
    setSpireActions((prev) => {
      const next = [...prev, action];
      actionsRef.current = next;
      return next;
    });
  }, []);

  /**
   * Persist the current run snapshot at every safe boundary (set choice, stage
   * settle, shop buy/reroll): localStorage for instant same-device resume, AND the
   * server (best-effort) so the hub can offer 이어하기 across devices. The server
   * run stays 'pending' until submit, so it survives 나가기.
   */
  const persist = useCallback(() => {
    if (!runIdRef.current || !seedRef.current) return;
    saveSpire({ seed: seedRef.current, runId: runIdRef.current, actions: actionsRef.current });
    void saveSpireProgress(runIdRef.current, actionsRef.current);
  }, []);

  /** Begin the ACTIVE-stage store for the run's current stage/attempt. */
  const startStage = useCallback(() => {
    const st = runStateRef.current;
    if (!st) return;
    const stage = st.currentStage;
    const attempt = st.currentStageAttempt;
    reset();
    const cfg = spireStageRunConfig(
      seedRef.current,
      stage,
      attempt,
      st.symbolBag,
      st.rulePool,
      st.handUpgrades,
      st.artifacts,
      st.setBonusUpgrades,
    );
    beginRun(stageAttemptSeed(seedRef.current, stage, attempt), runIdRef.current, "spire");
    configureRun(cfg);
    if (me.current) setNickname(me.current.nickname);
    startGame();
    setClearBreakdown(null);
    setFailBreakdown(null);
    setPhase("playing");
  }, [reset, beginRun, configureRun, setNickname, startGame]);

  /** Submit the finished run, clear the save, show the result. */
  const endRun = useCallback(() => {
    const st = runStateRef.current;
    if (!st) return;
    setPhase("result");
    // Banked spins (cleared stages only) for the result-screen score breakdown —
    // recomputed from the action stream so it matches the server's verify.ts.
    const replay = replaySpireRun(seedRef.current, actionsRef.current);
    if (replay.ok) {
      setUnusedSpins(
        replay.stageResults
          .filter((s) => s.cleared)
          .reduce((sum, s) => sum + s.remainingSpins, 0),
      );
    }
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitState("submitting");
    submitSpire(runIdRef.current, {
      actions: actionsRef.current,
      stagesCleared: st.currentStage - 1,
      totalScore: st.totalRunScore,
    })
      .then((res) => {
        if (res.status === "submitted") {
          setSeasonPoints(res.seasonPoints);
          setScoreChange(res.scoreChange ?? null);
          setSubmitState("submitted");
        } else if (res.reason === "version_mismatch") {
          setSubmitState("version_mismatch");
        } else {
          setRejectReason(res.reason);
          setSubmitState("rejected");
        }
      })
      .catch(() => setSubmitState("error"));
    clearSpire();
  }, []);

  /** Settle the just-played stage and route to artifact / shop / next / result. */
  const finalizeStage = useCallback(
    (cleared: boolean) => {
      const st = runStateRef.current;
      if (!st) return;
      const stage = st.currentStage;
      const target = spireStageTarget(stage);
      const actions = getActions();
      recordAction({ type: "play_stage", actions });
      const outcome = spireStageOutcome(
        spinLogs.map((l) => l.roundScore),
        target,
      );

      // gold-bar (금괴): mirror replaySpireRun exactly — accrue +1 per spin with
      // ≥4 gems at STAGE END, BEFORE settlement, for BOTH clear and fail, using
      // the SAME pure helper over the store's per-spin final boards.
      const goldBar = goldBarMoney(
        spinLogs.map((l) => l.finalResult),
        st.artifacts,
      );
      const stForSettle: SpireRunState =
        goldBar > 0 ? { ...st, money: st.money + goldBar } : st;
      runStateRef.current = stForSettle;

      if (cleared) {
        const r = settleClear(stForSettle, outcome.remainingSpins, outcome.stageScore);
        if (!r.ok) {
          setError(r.error);
          setPhase("error");
          return;
        }
        runStateRef.current = r.state;
        setRunState(r.state);
        setClearBreakdown({
          interest: r.breakdown.interest,
          spinBonus: r.breakdown.spinBonus,
          payout: r.breakdown.payout,
        });
        setFailBreakdown(null);
        persist();
        // Show the clear + settlement screen; its 계속 routes onward (see
        // proceedAfterStage). The clearing spin's result was just shown in-game.
        setPhase("cleared");
      } else {
        const r = settleFail(stForSettle);
        if (!r.ok) {
          setError(r.error);
          setPhase("error");
          return;
        }
        runStateRef.current = r.state;
        setRunState(r.state);
        setClearBreakdown(null);
        setFailBreakdown({
          stage,
          failures: r.state.failures,
          support: r.breakdown.support,
        });
        persist();
        // Final fail (3rd) → straight to the result screen; otherwise show the
        // 실패 + 지원금 screen, whose 계속 returns to the shop for a retry.
        if (r.breakdown.ended) {
          endRun();
        } else {
          setPhase("failed");
        }
      }
    },
    [getActions, recordAction, spinLogs, persist, endRun],
  );

  /** 계속 from the clear-settlement screen: route to reward / shop / result. */
  const proceedAfterClear = useCallback(() => {
    const st = runStateRef.current;
    if (!st) return;
    // settleClear already advanced currentStage, so the stage just cleared is one
    // below it. Mirrors the original routing (reward stage opens before the shop).
    const clearedStage = st.currentStage - 1;
    if (clearedStage >= SPIRE_STAGE_COUNT) {
      endRun();
    } else if (SPIRE_ARTIFACT_STAGES.includes(clearedStage)) {
      setPhase("artifact");
    } else {
      setPhase("shop");
    }
  }, [endRun]);

  // ── start / resume bootstrap ───────────────────────────────────────────────

  const startFresh = useCallback(() => {
    startSpire()
      .then(async (r) => {
        me.current = await fetchMe().catch(() => null);
        setRunId(r.runId);
        runIdRef.current = r.runId;
        setSeed(r.seed);
        seedRef.current = r.seed;
        setChoices(r.choices);
        setPhase("choosing-set");
      })
      .catch((e) => {
        setError(
          e instanceof Error && e.message === "unauthorized"
            ? "로그인이 필요합니다."
            : "첨탑을 시작할 수 없습니다.",
        );
        setPhase("error");
      });
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    reset();
    if (loadSpire()) return; // local save → wait for the player's resume choice
    // No local save (e.g. another device, or after 나가기): ask the server whether
    // this player has a resumable pending run, and offer it before starting fresh.
    fetchSpireCurrent()
      .then((r) => {
        if (startedRef.current && r.current) {
          const save: SpireSave = {
            seed: r.current.seed,
            runId: r.current.runId,
            actions: r.current.actions,
          };
          setResumeSave(save);
          setPhase("resume");
        } else {
          startFresh();
        }
      })
      .catch(() => startFresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Replay a saved run and resume at the shop boundary (or submit if ended). */
  const doResume = useCallback(
    async (save: SpireSave) => {
      const r = replaySpireRun(save.seed, save.actions);
      if (!r.ok) {
        clearSpire();
        reset();
        startFresh();
        return;
      }
      me.current = await fetchMe().catch(() => null);
      setRunId(save.runId);
      runIdRef.current = save.runId;
      setSeed(save.seed);
      seedRef.current = save.seed;
      setSpireActions(save.actions);
      actionsRef.current = save.actions;
      runStateRef.current = r.finalState;
      setRunState(r.finalState);
      if (r.runEnded) {
        endRun();
      } else {
        // Safe boundary: the player resumes at the shop before their next stage;
        // mid-stage progress was never persisted.
        setShopVisitIndex(Math.max(0, r.finalState.currentStage - 1));
        setRerollCount(0);
        setPhase("shop");
      }
    },
    [reset, startFresh, endRun],
  );

  function startNewGame() {
    clearSpire();
    reset();
    setResumeSave(null);
    setPhase("loading");
    startFresh();
  }

  // Exit to the season hub. Progress is KEPT — the pending server run (saved at the
  // last shop/stage boundary) lets the hub + this device offer 이어하기. We leave the
  // local save too so same-device resume is instant; only 새로 시작 clears it.
  function exitRun() {
    if (
      !window.confirm(
        "첨탑에서 나가시겠어요? 진행 상황은 저장되어 시즌 허브에서 이어할 수 있습니다.",
      )
    ) {
      return;
    }
    reset();
    router.push("/season");
  }

  // ── set choice ─────────────────────────────────────────────────────────────

  function chooseSet(setId: string) {
    const r = applyInitialSetChoice(initialSpireState(seedRef.current), setId);
    if (!r.ok) {
      setError(r.error);
      setPhase("error");
      return;
    }
    recordAction({ type: "choose_set", chosenSetId: setId });
    runStateRef.current = r.state;
    setRunState(r.state);
    persist();
    startStage();
  }

  // ── in-stage watcher: immediate clear or finish ─────────────────────────────

  const finalizedRef = useRef(false);
  useEffect(() => {
    if (phase !== "playing") {
      finalizedRef.current = false;
      return;
    }
    const st = runStateRef.current;
    if (!st) return;
    const target = spireStageTarget(st.currentStage);
    const cumulative = spinLogs.reduce((a, l) => a + l.roundScore, 0);
    if (finalizedRef.current) return;
    // The clearing spin now stays in 'spin-result' (stageCleared) so its reveal +
    // result show; pressing "스테이지 클리어 →" runs next() → 'finished'. A failed
    // stage reaches 'finished' by exhausting spins. Either way we settle on 'finished'.
    if (status === "finished") {
      finalizedRef.current = true;
      finalizeStage(cumulative >= target);
    }
  }, [phase, status, spinLogs, finalizeStage]);

  // ── shop handlers (apply reducer, reflect new state, persist) ───────────────

  const applyReducer = useCallback(
    (r: { ok: true; state: SpireRunState } | { ok: false; error: string }, action: SpireAction) => {
      if (!r.ok) return; // illegal buy (e.g. unaffordable) — ignore
      runStateRef.current = r.state;
      setRunState(r.state);
      recordAction(action);
      persist();
    },
    [recordAction, persist],
  );

  const offers: SpireShopOffers | null = runState
    ? spireShopOffers(runState, shopVisitIndex, rerollCount)
    : null;

  // 품절 처리: the discrete (artifact/set/rule) offer slots are SNAPSHOT when a shop
  // visit opens or is rerolled, so buying one shows it 품절 in place instead of the
  // next seeded candidate sliding in (which made reroll pointless). Symbols + prices
  // stay live (from `offers`). Keyed on (shopVisitIndex, rerollCount) only.
  const [shopSnapshot, setShopSnapshot] = useState<SpireShopOffers | null>(null);
  useEffect(() => {
    if (phase !== "shop") return;
    const st = runStateRef.current;
    if (!st) return;
    // Snapshot ONLY on visit/reroll change — NOT on every runState (buy) change.
    setShopSnapshot(spireShopOffers(st, shopVisitIndex, rerollCount));
  }, [phase, shopVisitIndex, rerollCount]);
  // Merge: frozen discrete lists from the snapshot, live symbols/prices from offers.
  const shopOffers: SpireShopOffers | null =
    offers && shopSnapshot
      ? {
          ...offers,
          artifacts: shopSnapshot.artifacts,
          sets: shopSnapshot.sets,
          rules: shopSnapshot.rules,
        }
      : offers;

  // 후원 안내 (spec §9): on the result screen the SeasonScoreRise animation
  // shows FIRST; only open the donation modal a short delay after the result
  // mounts so it never fights the count-up.
  const [donationReady, setDonationReady] = useState(false);
  useEffect(() => {
    if (phase !== "result") {
      // Reset when leaving the result screen (e.g. retry). Synchronous reset is
      // intentional here; the rule can't tell it's a teardown branch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDonationReady(false);
      return;
    }
    const t = setTimeout(() => setDonationReady(true), 1200);
    return () => clearTimeout(t);
  }, [phase]);
  const donation = useDonationPrompt({
    when: donationReady,
    storageKey: "spire-finished",
  });

  // ── render ──────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return <Centered>첨탑을 준비하는 중…</Centered>;
  }

  if (phase === "error") {
    return (
      <Centered>
        <p className="text-rose-400">{error || "오류가 발생했습니다."}</p>
        <Link href="/login" className="text-emerald-400 underline">
          로그인하기
        </Link>
      </Centered>
    );
  }

  if (phase === "resume" && resumeSave) {
    const set = SYMBOL_SETS_BY_ID[
      resumeSave.actions.find((a) => a.type === "choose_set")?.chosenSetId ?? ""
    ];
    return (
      <Centered>
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-emerald-400">첨탑</span>{" "}
          <span className="text-amber-300">오르기</span>
        </h1>
        <p className="text-sm text-zinc-400">
          진행 중인 첨탑 도전이 있습니다{set ? ` (${set.name} 세트)` : ""}.
          <br />이어서 진행하시겠어요?
        </p>
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => doResume(resumeSave)}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
          >
            이어하기
          </button>
          <button
            type="button"
            onClick={startNewGame}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:border-rose-400 hover:text-rose-300"
          >
            새로 시작
          </button>
        </div>
        <Link href="/season" className="text-sm text-zinc-400 underline">
          ← 나가기
        </Link>
      </Centered>
    );
  }

  if (phase === "choosing-set" && choices) {
    return (
      <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-10">
        <ModeIntro
          storageKey="spire"
          title="첨탑 오르기"
          lines={[
            "숫자 세트로 시작해, 첫 스테이지 전에 심볼 세트 하나를 선택합니다.",
            "선택한 세트의 심볼과 규칙을 활용해 10개의 스테이지를 올라가세요.",
          ]}
        />
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">첨탑</span>{" "}
            <span className="text-amber-300">오르기</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            숫자 세트로 시작합니다. 함께할 심볼 세트 하나를 고르세요.
            <br />그 세트의 심볼이 주머니에 추가되고 규칙이 해금됩니다.
          </p>
        </header>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {choices.map((id) => {
            const set = SYMBOL_SETS_BY_ID[id];
            if (!set) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => chooseSet(id)}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-zinc-800/60"
              >
                <span className="text-lg font-bold text-emerald-300">{set.name} 세트</span>
                <span className="text-2xl">{set.symbols.map((s) => s.emoji).join(" ")}</span>
                <span className="text-xs text-zinc-400">
                  {set.symbols.map((s) => s.name).join(" / ")}
                </span>
                {set.bonuses.length > 0 && (
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">족보 보너스</span>
                    {set.bonuses.map((b, i) => (
                      <span key={i} className="text-xs text-emerald-200/90">
                        · {setBonusLabel(b)}
                      </span>
                    ))}
                  </span>
                )}
                <span className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    해금 규칙 {set.ruleIds.length}개
                  </span>
                  <span className="text-xs text-amber-200/80">
                    {set.ruleIds.map(ruleNameOf).join(" · ")}
                  </span>
                </span>
                <span className="mt-1 inline-block rounded-lg bg-emerald-500 px-3 py-1.5 text-center text-sm font-bold text-zinc-950">
                  이 세트 선택
                </span>
              </button>
            );
          })}
        </div>
        <Link href="/season" className="text-sm text-zinc-400 underline">
          ← 나가기
        </Link>
      </main>
    );
  }

  if (phase === "result" && runState) {
    return (
      <>
        <SpireResultScreen
          stagesCleared={runState.currentStage - 1}
          totalScore={runState.totalRunScore}
          money={runState.money}
          unusedSpins={unusedSpins}
          artifacts={runState.artifacts}
          endReason={runState.currentStage > SPIRE_STAGE_COUNT ? "completed" : "failed-out"}
          seasonPoints={seasonPoints}
          scoreChange={scoreChange ?? undefined}
          submitState={submitState}
          rejectReason={rejectReason}
          onRetry={startNewGame}
        />
        <DonationModal open={donation.open} onClose={donation.close} />
      </>
    );
  }

  if (phase === "cleared" && runState) {
    // settleClear already advanced currentStage; the stage just cleared is one below.
    const clearedStage = runState.currentStage - 1;
    const lastStage = clearedStage >= SPIRE_STAGE_COUNT;
    return (
      <Centered>
        <h1 className="text-3xl font-black tracking-tight text-emerald-300">
          스테이지 {clearedStage} 클리어!
        </h1>
        {clearBreakdown && (
          <div className="w-full space-y-1 rounded-xl border border-emerald-500/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-300/80">
              정산
            </p>
            <p>이자 +{clearBreakdown.interest}원</p>
            <p>남은 스핀 보너스 +{clearBreakdown.spinBonus}원</p>
            <p>클리어 보수 +{clearBreakdown.payout}원</p>
            <p className="border-t border-emerald-500/30 pt-1 font-bold text-amber-300">
              보유 금액 {runState.money}원
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={proceedAfterClear}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          {lastStage ? "결과 보기" : "계속"}
        </button>
      </Centered>
    );
  }

  if (phase === "failed" && runState && failBreakdown) {
    return (
      <Centered>
        <h1 className="text-3xl font-black tracking-tight text-rose-300">
          스테이지 {failBreakdown.stage} 실패
        </h1>
        <div className="w-full space-y-1 rounded-xl border border-rose-500/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
          <p>
            실패 {failBreakdown.failures} / {SPIRE_MAX_FAILURES}
          </p>
          <p className="font-bold text-amber-300">지원금 +{failBreakdown.support}원</p>
          <p className="text-rose-200/70">
            정산 보상 없이 지원금만 지급됩니다. 같은 스테이지를 다시 도전하세요.
          </p>
          <p className="border-t border-rose-500/30 pt-1 font-bold text-amber-300">
            보유 금액 {runState.money}원
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("shop")}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          상점으로
        </button>
      </Centered>
    );
  }

  if (phase === "artifact" && runState && offers) {
    // The reward offer is SALTED INDEPENDENTLY of the shop (lib/spire/shop.ts
    // spireRewardArtifacts) so reward and shop artifacts never overlap. The
    // cleared artifact stage is currentStage-1 (settleClear already advanced).
    const rewardStage = runState.currentStage - 1;
    const arts = spireRewardArtifacts(runState, rewardStage);
    const choose = (id: string | null) => {
      recordAction({ type: "choose_artifact", artifactId: id });
      if (id) {
        // Add the id, then apply its onAcquire effect at the SAME point the server
        // replayer does (lib/spire/replay.ts `choose_artifact`) so states match.
        const added = { ...runState, artifacts: [...runState.artifacts, id] };
        const next = applyArtifactAcquire(added, id);
        runStateRef.current = next;
        setRunState(next);
      }
      persist();
      setPhase("shop");
    };
    return (
      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 py-10">
        <h1 className="text-2xl font-black tracking-tight text-amber-300">아티팩트 선택</h1>
        <div className="grid w-full grid-cols-1 gap-3">
          {arts.map((a) => {
            const def = ARTIFACT_BY_ID[a.id];
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => choose(a.id)}
                className="flex flex-col gap-1 rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4 text-left transition hover:border-emerald-400"
              >
                <span className="font-bold text-emerald-300">{def?.name ?? a.id}</span>
                <span className="text-sm text-zinc-400">{def?.description}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => choose(null)}
          className="text-sm text-zinc-400 underline"
        >
          건너뛰기
        </button>
      </main>
    );
  }

  if (phase === "shop" && runState && shopOffers) {
    return (
      <>
        <SpireShop
          runState={runState}
          offers={shopOffers}
          onBuySymbol={(target, replaced) =>
            applyReducer(buySymbolIncrement(runState, target, replaced), {
              type: "buy_symbol",
              targetSymbolId: target,
              replacedSymbolId: replaced,
            })
          }
          onBuySet={(setId, replacedSymbolIds, removedRuleIds) =>
            applyReducer(buySymbolSet(runState, setId, replacedSymbolIds, removedRuleIds), {
              type: "buy_set",
              setId,
              replacedSymbolIds,
              removedRuleIds,
            })
          }
          onBuyRule={(ruleId, removedRuleId) =>
            applyReducer(buyRule(runState, ruleId, removedRuleId), {
              type: "buy_rule",
              ruleId,
              removedRuleId,
            })
          }
          onBuyArtifact={(id, price) => {
            // Buy, then (on success) apply the onAcquire effect at the SAME point
            // the server replayer does (lib/spire/replay.ts `buy_artifact`).
            const bought = buyArtifact(runState, id, price);
            const r = bought.ok
              ? { ok: true as const, state: applyArtifactAcquire(bought.state, id) }
              : bought;
            applyReducer(r, {
              type: "buy_artifact",
              artifactId: id,
              cost: price,
            });
          }}
          onBuyHandFlat={(hand) =>
            applyReducer(buyHandFlat(runState, hand), { type: "buy_hand_flat", handType: hand })
          }
          onBuyHandDouble={(hand) =>
            applyReducer(buyHandDouble(runState, hand), { type: "buy_hand_double", handType: hand })
          }
          onBuySetBonus={(key, kind) =>
            applyReducer(buySetBonus(runState, key, kind), {
              type: "buy_setbonus",
              bonusKey: key,
              kind,
            })
          }
          onReroll={() => {
            // chime (차임벨): first 2 rerolls of this shop visit are free. rerollCount
            // resets to 0 on leaveShop, so it IS the per-visit index — derived the
            // SAME way the server replayer derives `free` from shopRerolls. The
            // recorded action stays parameterless; the free reroll still re-seeds
            // offers because rerollCount increments below.
            const free =
              runState.artifacts.includes("chime") && rerollCount < 2;
            const r = rerollShop(runState, free);
            if (!r.ok) return;
            runStateRef.current = r.state;
            setRunState(r.state);
            recordAction({ type: "reroll_shop" });
            setRerollCount((c) => c + 1);
            persist();
          }}
          onLeave={() => {
            setShopVisitIndex((i) => i + 1);
            setRerollCount(0);
            startStage();
          }}
          rerollFree={runState.artifacts.includes("chime") && rerollCount < 2}
        />
        <div className="mx-auto -mt-2 mb-4 flex w-full max-w-md flex-col items-center gap-1 px-4">
          <button
            type="button"
            onClick={exitRun}
            className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-rose-400 hover:text-rose-300"
          >
            나가기
          </button>
          <p className="text-[11px] text-zinc-600">
            진행 상황은 자동 저장됩니다 — 나가도 시즌 허브에서 이어할 수 있습니다.
          </p>
        </div>
      </>
    );
  }

  // playing
  if (phase === "playing" && runState) {
    const stage = runState.currentStage;
    const target = spireStageTarget(stage);
    const cumulative = spinLogs.reduce((a, l) => a + l.roundScore, 0);
    return (
      <>
        <div className="mx-auto w-full max-w-2xl px-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-2 text-sm">
            <span className="font-bold text-amber-300">
              스테이지 {stage} / {SPIRE_STAGE_COUNT}
            </span>
            <span className="text-zinc-300">목표 {target}점</span>
            <span className="text-emerald-300">누적 {cumulative}</span>
            <span className="text-amber-200">돈 {runState.money}원</span>
            <span className="text-zinc-400">클리어 {stage - 1}</span>
          </div>
          {/* 심볼 주머니 · 규칙 풀 · 아티팩트(설명 포함)는 아래 '보유 현황' 버튼에서 확인. */}
          <p className="mt-1 text-center text-[11px] text-zinc-600">
            주머니 · 규칙 · 아티팩트는 아래 “보유 현황”에서 확인하세요.
          </p>
          <div className="mt-2 flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={exitRun}
              className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-rose-400 hover:text-rose-300"
            >
              나가기
            </button>
            <p className="text-[11px] text-zinc-600">
              진행 상황은 자동 저장됩니다 — 나가도 시즌 허브에서 이어할 수 있습니다.
            </p>
          </div>
        </div>
        <GameScreen />
      </>
    );
  }

  return <Centered>첨탑을 준비하는 중…</Centered>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {children}
    </main>
  );
}
