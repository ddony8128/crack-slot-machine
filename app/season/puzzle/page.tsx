import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import { getDb } from "@/lib/db";
import { PUZZLES, PUZZLES_BY_KEY } from "@/lib/puzzle/config";
import PuzzleListDonationPrompt from "@/components/PuzzleListDonationPrompt";

export const metadata: Metadata = { title: "RULE SLOT | 퍼즐" };
export const dynamic = "force-dynamic";

export default async function PuzzleListPage() {
  const player = await currentPlayer();
  if (!player) redirect("/login");

  // Cleared-puzzle count for this player (drives the all-cleared 후원 prompt).
  const db = getDb();
  const season = await db.getActiveSeason();
  const records = season
    ? await db.listPlayerPuzzleRecords(player.id, season.id)
    : [];
  const clearedCount = records.filter((record) => {
    const def = PUZZLES_BY_KEY[record.puzzleKey];
    return def != null && record.bestGoalsAchieved === def.goals.length;
  }).length;

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
          퍼즐 모드
        </h1>
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-200">
          퍼즐 모드 — 클리어당 시즌 100점 (총 1000점). 곧 제공됩니다.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PUZZLES.map((p) => (
          <li key={p.key}>
            <Link
              href={`/season/puzzle/${p.key}`}
              className="flex h-full flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 transition hover:border-emerald-500/50 hover:bg-zinc-800/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-400">
                  #{p.index}
                </span>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                  제한 {p.spinLimit}스핀
                </span>
              </div>
              <span className="text-lg font-bold text-zinc-100">{p.title}</span>
              <span className="text-sm text-zinc-400">{p.goalText}</span>
            </Link>
          </li>
        ))}
      </ul>

      <PuzzleListDonationPrompt
        clearedCount={clearedCount}
        total={PUZZLES.length}
        isSupporter={player.supporterBadge}
      />
    </main>
  );
}
