import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import { getDb } from "@/lib/db";
import { PUZZLES } from "@/lib/puzzle/config";
import type { PuzzleRecordRow } from "@/lib/db/types";
import PuzzleListDonationPrompt from "@/components/PuzzleListDonationPrompt";

export const metadata: Metadata = { title: "RULE SLOT | 퍼즐" };
export const dynamic = "force-dynamic";

export default async function PuzzleListPage() {
  const player = await currentPlayer();
  if (!player) redirect("/login");

  const db = getDb();
  const season = await db.getActiveSeason();
  const records = season
    ? await db.listPlayerPuzzleRecords(player.id, season.id)
    : [];
  const recordByKey = new Map<string, PuzzleRecordRow>(
    records.map((r) => [r.puzzleKey, r]),
  );

  const clearedCount = records.filter((r) => r.cleared).length;
  // p02 unlocks once p01 is cleared.
  const p01Cleared = recordByKey.get("p01")?.cleared === true;

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
          퍼즐 모드 — 클리어 시 시즌 점수 100점 + 남은 스핀당 10점. 1번 문제를
          클리어하면 2번 문제가 해금됩니다.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PUZZLES.map((p) => {
          const record = recordByKey.get(p.key) ?? null;
          const cleared = record?.cleared === true;
          const locked = p.key === "p02" && !p01Cleared;

          const status = locked ? "잠김" : cleared ? "클리어" : "도전 가능";
          const statusClass = locked
            ? "border-zinc-700 text-zinc-500"
            : cleared
              ? "border-emerald-500/40 text-emerald-300"
              : "border-amber-500/40 text-amber-300";

          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-400">
                  #{p.index}
                </span>
                <span
                  className={`rounded-full border bg-zinc-900 px-2 py-0.5 text-xs font-semibold ${statusClass}`}
                >
                  {status}
                </span>
              </div>
              <span className="text-lg font-bold text-zinc-100">{p.title}</span>
              <span className="text-sm text-zinc-400">{p.goalText}</span>
              <span className="text-xs text-zinc-500">제한 {p.spinLimit}스핀</span>

              {locked ? (
                <span className="mt-auto text-xs font-semibold text-zinc-500">
                  1번 문제를 클리어하면 해금됩니다
                </span>
              ) : cleared && record ? (
                <span className="mt-auto text-xs font-semibold text-emerald-300">
                  내 기록: {record.bestClearSpin}스핀 클리어 · 내 점수{" "}
                  {record.bestPuzzleScore ?? 0}점
                </span>
              ) : (
                <span className="mt-auto text-xs font-semibold text-zinc-500">
                  아직 클리어하지 않았습니다
                </span>
              )}
            </>
          );

          if (locked) {
            return (
              <li key={p.key}>
                <div className="flex h-full cursor-not-allowed flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 opacity-60">
                  {body}
                </div>
              </li>
            );
          }

          return (
            <li key={p.key}>
              <Link
                href={`/season/puzzle/${p.key}`}
                className="flex h-full flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 transition hover:border-emerald-500/50 hover:bg-zinc-800/60"
              >
                {body}
              </Link>
            </li>
          );
        })}
      </ul>

      <PuzzleListDonationPrompt
        clearedCount={clearedCount}
        total={PUZZLES.length}
        isSupporter={player.supporterBadge}
      />
    </main>
  );
}
