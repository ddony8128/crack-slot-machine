import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import { PUZZLES_BY_KEY } from "@/lib/puzzle/config";
import PuzzleClient from "@/components/PuzzleClient";

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

  return <PuzzleClient puzzleKey={puzzleKey} />;
}
