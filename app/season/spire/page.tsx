import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import {
  SPIRE_STAGES,
  SPIRE_REWARD_TYPES,
  SPIRE_ARTIFACTS,
} from "@/lib/spire/config";

export const metadata: Metadata = { title: "RULE SLOT | 첨탑 오르기" };
export const dynamic = "force-dynamic";

export default async function SpirePage() {
  if (!(await currentPlayer())) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/season"
          className="text-sm font-semibold text-zinc-400 transition hover:text-zinc-200"
        >
          ← 시즌으로
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-zinc-100">
          첨탑 오르기
        </h1>
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-200">
          준비 중 — 곧 제공됩니다. 최고 런 1개가 시즌 점수(최대 1000점)에
          반영됩니다.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-400">
          스테이지 목표 점수
        </h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SPIRE_STAGES.map((stage) => (
            <li
              key={stage.index}
              className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3"
            >
              <span className="font-mono text-xs font-bold text-emerald-400">
                {stage.index}층
              </span>
              <span className="font-mono text-base font-bold text-zinc-100">
                {stage.targetScore}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-400">
          보상 종류
        </h2>
        <ul className="space-y-2">
          {SPIRE_REWARD_TYPES.map((r) => (
            <li
              key={r.type}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
            >
              <span className="font-semibold text-zinc-100">{r.label}</span>
              <p className="mt-0.5 text-sm text-zinc-400">{r.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-400">
          아티팩트
        </h2>
        <ul className="space-y-2">
          {SPIRE_ARTIFACTS.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
            >
              <span className="font-semibold text-amber-300">{a.name}</span>
              <p className="mt-0.5 text-sm text-zinc-400">{a.effect}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
