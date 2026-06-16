import type { Metadata } from "next";
import Link from "next/link";
import { readDailyLeaderboard } from "@/lib/daily/leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RULE SLOT | 데일리 랭킹",
};

export default async function DailyLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  // Shared read: validates ?date, settles any due windows, resolves nicknames.
  const { dateKey, items } = await readDailyLeaderboard(date);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          <span className="text-emerald-400">DAILY</span>{" "}
          <span className="text-amber-300">랭킹</span>
        </h1>
        <p className="font-mono text-sm text-zinc-400">{dateKey}</p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-semibold">순위</th>
              <th className="px-4 py-3 font-semibold">닉네임</th>
              <th className="px-4 py-3 text-right font-semibold">점수</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-sm text-zinc-500"
                >
                  아직 등록된 기록이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={`${item.rank}-${item.nickname}`}
                  className="border-b border-zinc-800/60 last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-zinc-300">
                    {item.rank}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-100">
                    {item.nickname}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-300">
                    {item.score}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Link
        href="/season/daily"
        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
      >
        도전하러 가기
      </Link>
    </main>
  );
}
