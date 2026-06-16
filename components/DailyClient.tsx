"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import {
  fetchDailyCurrent,
  startDaily,
  refillDaily,
  type DailyCurrent,
} from "@/lib/client/dailyApi";
import { fetchMe } from "@/lib/client/authApi";
import { dailyRunConfigFromParts } from "@/lib/daily/run";
import {
  DAILY_BASE_ATTEMPTS,
  DAILY_MAX_ATTEMPTS,
} from "@/lib/daily/challenge";
import GameScreen from "@/components/GameScreen";
import DailyResultScreen from "@/components/DailyResultScreen";
import DummyAdModal from "@/components/DummyAdModal";
import DonationModal from "@/components/DonationModal";
import { useDonationPrompt } from "@/components/useDonationPrompt";
import ModeIntro from "@/components/ModeIntro";
import DailySetupPreview from "@/components/DailySetupPreview";
import { dailyRefillGate } from "@/components/dailyRefillGate";

/** "5시간 23분" style remaining-time label from now until endsAt (KST noon). */
function formatRemaining(endsAt: string, nowMs: number): string {
  const ms = Date.parse(endsAt) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return "마감됨";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}시간 ${m}분 남음`;
  if (m > 0) return `${m}분 남음`;
  return "1분 미만 남음";
}

/** Local-time HH:MM display of the day's 마감 시각 (window end). */
function formatDeadline(endsAt: string): string {
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startErrorMessage(code: string): string {
  if (code === "daily_attempts_exhausted") return "오늘 도전 횟수를 모두 소진했습니다.";
  if (code === "unauthorized") return "로그인이 필요합니다.";
  if (code === "no_active_season") return "진행 중인 시즌이 없습니다.";
  return "도전을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export default function DailyClient() {
  const status = useGameStore((s) => s.status);
  const setNickname = useGameStore((s) => s.setNickname);
  const beginRun = useGameStore((s) => s.beginRun);
  const configureRun = useGameStore((s) => s.configureRun);
  const startGame = useGameStore((s) => s.startGame);
  const reset = useGameStore((s) => s.reset);

  const [current, setCurrent] = useState<DailyCurrent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [refilling, setRefilling] = useState(false);
  const [refillError, setRefillError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick once a minute so the 남은 시간 countdown stays current without churn.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // The store is a module singleton that survives client navigations, so reset
  // to a clean 'start' state whenever this page mounts, then load the day's info.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    reset();
    fetchDailyCurrent()
      .then(setCurrent)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "load_failed"),
      );
  }, [reset]);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      // The store gates startGame() on a non-empty nickname; the daily score is
      // recorded under the server-side player nickname regardless, but we set it
      // here so the gate passes and the result screen can show it.
      const me = await fetchMe();
      setNickname(me.nickname);
      const run = await startDaily();
      // Build the run from the DB-stored challenge config (returned by /start),
      // not by re-deriving in the client, so it matches the server replay.
      configureRun(
        dailyRunConfigFromParts({
          seed: run.seed,
          groupASetId: run.groupASetId,
          groupBSetId: run.groupBSetId,
          basicRuleSetId: run.basicRuleSetId,
        }),
      );
      beginRun(run.seed, run.runId, "daily");
      startGame();
    } catch (err) {
      setStartError(startErrorMessage(err instanceof Error ? err.message : ""));
    } finally {
      setStarting(false);
    }
  }

  async function handleRefillConfirm() {
    if (refilling) return;
    setRefilling(true);
    setRefillError(null);
    try {
      await refillDaily();
      // Re-fetch so attemptsLeft/allowed/adRefillUsed (and canRefill) update.
      const next = await fetchDailyCurrent();
      setCurrent(next);
      setAdOpen(false);
    } catch (err) {
      setRefillError(
        err instanceof Error && err.message === "ad_refill_already_used"
          ? "이미 광고 충전을 사용했습니다."
          : "충전에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setRefilling(false);
    }
  }

  // 후원 안내: prompt once when the player has truly run out of daily attempts
  // (no official attempts left AND the one-time ad refill is unavailable).
  const fullyExhausted =
    !!current &&
    current.loggedIn &&
    current.attemptsLeft <= 0 &&
    current.canRefill !== true;
  const donation = useDonationPrompt({
    when: fullyExhausted,
    storageKey: "daily-exhausted",
  });

  if (status === "finished") return <DailyResultScreen />;

  if (status !== "start")
    return (
      <>
        <GameScreen />
        <DonationModal open={donation.open} onClose={donation.close} />
      </>
    );

  const attemptsLeft =
    current && current.loggedIn ? current.attemptsLeft : null;
  const exhausted = attemptsLeft != null && attemptsLeft <= 0;

  // §8: the ad-refill CTA surfaces only AFTER the 5 base attempts are spent, so
  // it doesn't compete with the start button while base plays remain.
  const { showRefillCta, refillAvailableButHeld } = dailyRefillGate(current);

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <ModeIntro
        storageKey="daily"
        title="일일 도전"
        lines={[
          "오늘 정해진 심볼 세트와 규칙으로 점수를 겨룹니다.",
          "공식 도전은 하루 5회이며, 광고를 보면 5회 추가 도전할 수 있습니다.",
          "오늘의 최고 점수만 랭킹에 반영됩니다.",
        ]}
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          <span className="text-emerald-400">DAILY</span>{" "}
          <span className="text-amber-300">CHALLENGE</span>
        </h1>
        <p className="text-sm text-zinc-400">
          모두가 같은 시드로 겨루는 오늘의 도전. 최고 점수가 기록됩니다.
        </p>
      </header>

      <div className="panel-pop w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        {loadError && (
          <p className="text-sm text-rose-400">
            정보를 불러오지 못했습니다. 새로고침해 주세요.
          </p>
        )}

        {current && (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                오늘의 챌린지
              </p>
              <p className="font-mono text-lg font-bold text-zinc-200">
                {current.dateKey}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                마감 {formatDeadline(current.endsAt)} ·{" "}
                <span className="font-semibold text-amber-300">
                  {formatRemaining(current.endsAt, nowMs)}
                </span>
              </p>
            </div>

            {current.setup && (
              <DailySetupPreview
                setup={current.setup}
                dateKey={current.dateKey}
              />
            )}

            {current.loggedIn ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  남은 도전
                </p>
                <p className="font-mono text-lg font-bold text-amber-300">
                  공식 도전: {current.attemptsLeft} /{" "}
                  {current.allowed ??
                    (current.adRefillUsed
                      ? DAILY_MAX_ATTEMPTS
                      : DAILY_BASE_ATTEMPTS)}
                  회 남음
                </p>
                {current.attemptsUsed === 0 && (
                  <p className="text-sm text-emerald-300">
                    오늘 첫 플레이 시 시즌 점수 +20점 (하루 1회)
                  </p>
                )}

                {showRefillCta ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRefillError(null);
                        setAdOpen(true);
                      }}
                      className="w-full rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
                    >
                      광고를 보고 5회 추가 충전
                    </button>
                    {refillError && (
                      <p className="text-sm text-rose-400">{refillError}</p>
                    )}
                  </>
                ) : refillAvailableButHeld ? (
                  <p className="text-sm text-zinc-500">
                    공식 도전을 모두 사용하면 광고로 5회 추가 충전할 수 있습니다.
                  </p>
                ) : current.adRefillUsed ? (
                  <p className="text-sm text-zinc-400">
                    광고 충전을 사용했습니다.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">로그인이 필요합니다.</p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={starting || exhausted || !current}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {exhausted
            ? "오늘 도전 횟수 소진"
            : starting
              ? "준비 중…"
              : "도전 시작"}
        </button>

        {startError && <p className="text-sm text-rose-400">{startError}</p>}
      </div>

      <Link
        href="/season/daily/leaderboard"
        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        오늘의 랭킹 보기
      </Link>

      <Link
        href="/season"
        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        시즌 허브로
      </Link>

      <DummyAdModal
        open={adOpen}
        onConfirm={handleRefillConfirm}
        onClose={() => {
          if (refilling) return;
          setAdOpen(false);
        }}
        pending={refilling}
      />

      <DonationModal open={donation.open} onClose={donation.close} />
    </main>
  );
}
