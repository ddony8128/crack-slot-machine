import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import { PUZZLES_BY_KEY } from "@/lib/puzzle/config";

type Params = { params: Promise<{ puzzleKey: string }> };

export const metadata: Metadata = { title: "RULE SLOT | 퍼즐" };
export const dynamic = "force-dynamic";

export default async function PuzzleDetailPage({ params }: Params) {
  if (!(await currentPlayer())) redirect("/login");

  const { puzzleKey } = await params;
  const puzzle = PUZZLES_BY_KEY[puzzleKey];

  if (!puzzle) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <Link
            href="/season/puzzle"
            className="text-sm font-semibold text-zinc-400 transition hover:text-zinc-200"
          >
            ← 퍼즐 목록
          </Link>
        </div>
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-center text-sm text-zinc-400">
          없는 퍼즐입니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/season/puzzle"
          className="text-sm font-semibold text-zinc-400 transition hover:text-zinc-200"
        >
          ← 퍼즐 목록
        </Link>
      </div>

      <header className="space-y-2">
        <span className="font-mono text-xs font-bold text-emerald-400">
          #{puzzle.index}
        </span>
        <h1 className="text-3xl font-black tracking-tight text-zinc-100">
          {puzzle.title}
        </h1>
      </header>

      <dl className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            목표
          </dt>
          <dd className="mt-1 text-base text-zinc-200">{puzzle.goalText}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            스핀 제한
          </dt>
          <dd className="mt-1 text-base text-zinc-200">{puzzle.spinLimit}스핀</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            심볼 세트
          </dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            {puzzle.symbolSets.map((s) => (
              <span
                key={s}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-zinc-300"
              >
                {s}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-200">
        준비 중 — 곧 플레이할 수 있습니다.
      </p>
    </main>
  );
}
