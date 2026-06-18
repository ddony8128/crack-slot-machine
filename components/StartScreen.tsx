"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import ReferenceModal from "@/components/ReferenceModal";
import { fetchLeaderboard } from "@/lib/client/api";
import type { LeaderboardItem } from "@/lib/db/types";
import { FRUITS, GEMS } from "@/data/symbols";
import SymbolView from "@/components/SymbolView";

type Props = {
  slug: string;
  isActive: boolean;
  starting: boolean;
  startError: string | null;
  onStart: () => void;
};

export default function StartScreen({
  slug,
  isActive,
  starting,
  startError,
  onStart,
}: Props) {
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const [refView, setRefView] = useState<"rules" | "scores" | null>(null);

  // Top 5 preview for this event, from the DB. null = loading.
  const [top, setTop] = useState<LeaderboardItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchLeaderboard(slug, 1, 5)
      .then((r) => alive && setTop(r.items))
      .catch(() => alive && setTop([]));
    return () => {
      alive = false;
    };
  }, [slug]);

  const canStart = nickname.trim().length > 0 && isActive && !starting;

  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <p className="text-sm font-semibold tracking-[0.3em] text-zinc-400 sm:text-base">
          나폴리탄 카지노
        </p>
        <h1 className="mt-1 text-5xl font-black tracking-tight sm:text-6xl">
          <span className="text-emerald-400">룰</span>{" "}
          <span className="text-amber-300">슬롯츠</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-400 sm:text-base">
          규칙을 조작하고 레버를 당겨라.
        </p>
      </header>

      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canStart) onStart();
        }}
      >
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임을 입력하세요"
          maxLength={60}
          disabled={!isActive}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none transition focus:border-emerald-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canStart}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {starting ? "준비 중…" : "GAME START"}
        </button>
        {!isActive && (
          <p className="text-center text-sm text-amber-400">
            종료된 이벤트입니다. 랭킹만 확인할 수 있습니다.
          </p>
        )}
        {startError && (
          <p className="text-center text-sm text-rose-400">{startError}</p>
        )}
      </form>

      <section className="w-full max-w-sm space-y-2">
        <h2 className="text-center text-sm font-semibold tracking-wide text-zinc-400">
          TOP 5 랭킹
        </h2>
        {top === null ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
            불러오는 중…
          </p>
        ) : top.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
            아직 기록이 없습니다
          </p>
        ) : (
          <ol className="space-y-1">
            {top.map((item) => (
              <li
                key={`${item.rank}-${item.nickname}-${item.submittedAt}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-5 text-center font-mono font-bold text-amber-300">
                    {item.rank}
                  </span>
                  <span className="truncate font-semibold text-zinc-200">
                    {item.nickname}
                  </span>
                </span>
                <span className="font-mono font-bold text-emerald-300">
                  {item.score}
                </span>
              </li>
            ))}
          </ol>
        )}
        <Link
          href={`/e/${slug}/leaderboard`}
          className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          전체 랭킹 보기
        </Link>
      </section>

      <section className="w-full max-w-md space-y-3">
        <div className="grid grid-cols-9 place-items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-3 sm:gap-2 sm:px-4">
          {[...FRUITS, ...GEMS, "seven", "zero", "four"].map((s) => (
            <SymbolView key={s} symbol={s as never} size="sm" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRefView("rules")}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-2 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60 sm:text-base"
          >
            규칙 보기
          </button>
          <button
            type="button"
            onClick={() => setRefView("scores")}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-2 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60 sm:text-base"
          >
            점수표 보기
          </button>
        </div>
      </section>

      <ReferenceModal
        open={refView !== null}
        view={refView ?? "rules"}
        onClose={() => setRefView(null)}
      />
    </main>
  );
}
