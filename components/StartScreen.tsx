"use client";

import { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import ReferenceModal from "@/components/ReferenceModal";
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

  const canStart = nickname.trim().length > 0 && isActive && !starting;

  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
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

      <section className="w-full max-w-sm">
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
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRefView("rules")}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            규칙 보기
          </button>
          <button
            type="button"
            onClick={() => setRefView("scores")}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
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
