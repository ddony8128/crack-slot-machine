import SeasonNav from "@/components/SeasonNav";
import { getDb } from "@/lib/db";
import { buildSeasonRanking } from "@/lib/season/scoring";
import { settleDueDailyChallenges } from "@/lib/server/dailySettlement";

// Live ranking data + reads the DB per request — never prerender at build.
export const dynamic = "force-dynamic";

export default async function SeasonLeaderboardPage() {
  const db = getDb();
  const season = await db.getActiveSeason();

  return (
    <div className="flex min-h-full flex-col">
      <SeasonNav />

      <main className="fade-rise mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
        <header className="space-y-3 text-center">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            시즌 랭킹
          </h1>
          <p className="text-sm text-zinc-400">
            시즌 점수는 첨탑·퍼즐·일일 도전을 합산합니다. (빠른 게임은 시즌 점수에 반영되지 않습니다.)
          </p>

          <details className="mx-auto max-w-md rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-left">
            <summary className="cursor-pointer text-center text-xs font-bold text-amber-200/90">
              점수 계산 방법 보기
            </summary>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-400">
              <p>
                <span className="font-bold text-emerald-300">첨탑 오르기</span> — 최고 런 기준:
                도달 스테이지 ×100 + 보유 금액 ×10 + 클리어한 스테이지의 남은 스핀 ×10
              </p>
              <p>
                <span className="font-bold text-emerald-300">퍼즐</span> — 각 퍼즐의 최고 기록 합산.
                퍼즐 1개 클리어 = 100점 + 남긴 스핀 ×10 (적은 스핀으로 클리어할수록 높습니다)
              </p>
              <p>
                <span className="font-bold text-emerald-300">일일 도전</span> — 플레이한 날마다
                첫 플레이 +20점, 그날 순위 보상(상위 10% +50점 · 상위 50% +30점)을 합산
              </p>
              <p className="text-zinc-500">
                후원은 점수·순위에 전혀 영향을 주지 않습니다.
              </p>
            </div>
          </details>
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
  // Lazily settle any ended daily windows so daily rank rewards are persisted
  // before we read the ranking rows.
  await settleDueDailyChallenges(db, seasonId, new Date().toISOString());
  const rows = await db.listSeasonBestScores(seasonId);

  // Resolve nicknames: dedupe playerIds, fetch each once. Also capture which
  // players carry the 후원자(supporter) badge so we can chip it in the table.
  const ids = [...new Set(rows.map((r) => r.playerId))];
  const players = await Promise.all(ids.map((id) => db.getPlayerById(id)));
  const nicknames = new Map<string, string>();
  const supporters = new Set<string>();
  ids.forEach((id, i) => {
    const p = players[i];
    if (p) {
      nicknames.set(id, p.nickname);
      if (p.supporterBadge) supporters.add(id);
    }
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
              <td className="max-w-[12rem] px-4 py-3 font-semibold text-zinc-100">
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{item.nickname}</span>
                  {supporters.has(item.playerId) && (
                    <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      후원자
                    </span>
                  )}
                </span>
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
