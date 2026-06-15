import SeasonNav from "@/components/SeasonNav";
import { getDb } from "@/lib/db";
import { buildSeasonRanking } from "@/lib/season/scoring";

// Live ranking data + reads the DB per request — never prerender at build.
export const dynamic = "force-dynamic";

export default async function SeasonLeaderboardPage() {
  const db = getDb();
  const season = await db.getActiveSeason();

  return (
    <div className="flex min-h-full flex-col">
      <SeasonNav />

      <main className="fade-rise mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            시즌 랭킹
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            시즌 점수는 첨탑·퍼즐·일일 도전을 합산하며 최대 3000점입니다.
          </p>
        </header>

        {!season ? (
          <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-zinc-400">
            시즌이 없습니다.
          </p>
        ) : (
          await renderRanking(db, season.id)
        )}
      </main>
    </div>
  );
}

async function renderRanking(
  db: ReturnType<typeof getDb>,
  seasonId: string,
) {
  const rows = await db.listSeasonBestScores(seasonId);

  // Resolve nicknames: dedupe playerIds, fetch each once.
  const ids = [...new Set(rows.map((r) => r.playerId))];
  const players = await Promise.all(ids.map((id) => db.getPlayerById(id)));
  const nicknames = new Map<string, string>();
  ids.forEach((id, i) => {
    const p = players[i];
    if (p) nicknames.set(id, p.nickname);
  });

  const ranking = buildSeasonRanking(rows, (id) => nicknames.get(id) ?? "알수없음");

  if (ranking.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-zinc-400">
        아직 시즌 기록이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3 font-semibold">순위</th>
            <th className="px-4 py-3 font-semibold">닉네임</th>
            <th className="px-4 py-3 text-right font-semibold">시즌 점수</th>
            <th className="px-4 py-3 text-right font-semibold">첨탑</th>
            <th className="px-4 py-3 text-right font-semibold">퍼즐</th>
            <th className="px-4 py-3 text-right font-semibold">일일</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((item) => (
            <tr
              key={item.playerId}
              className="border-b border-zinc-800/60 last:border-0"
            >
              <td className="px-4 py-3 font-mono font-bold text-amber-300">
                {item.rank}
              </td>
              <td className="max-w-[12rem] truncate px-4 py-3 font-semibold text-zinc-100">
                {item.nickname}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">
                {item.seasonPoints}
              </td>
              <td className="px-4 py-3 text-right font-mono text-zinc-400">
                {item.spirePoints}
              </td>
              <td className="px-4 py-3 text-right font-mono text-zinc-400">
                {item.puzzlePoints}
              </td>
              <td className="px-4 py-3 text-right font-mono text-zinc-400">
                {item.dailyPoints}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
