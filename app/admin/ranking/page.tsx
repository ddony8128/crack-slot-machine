import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/server/auth";
import AdminLogin from "@/app/admin/_components/AdminLogin";
import { getDb } from "@/lib/db";
import { buildSeasonRanking } from "@/lib/season/scoring";
import { settleDueDailyChallenges } from "@/lib/server/dailySettlement";
import { CLIENT_VERSION, RULESET_VERSION } from "@/lib/version";
import type { SeasonRankItem } from "@/lib/db/types";

// Reads the session cookie + live ranking data, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "RULE SLOT | 랭킹 보기" };

type QuickRankItem = { rank: number; nickname: string; score: number };

/** Season ranking + supporter set, sourced from the SAME read path as the public
 *  season leaderboard (listSeasonBestScores → buildSeasonRanking). */
async function loadSeasonRanking(
  db: ReturnType<typeof getDb>,
  seasonId: string,
): Promise<{ ranking: SeasonRankItem[]; supporters: Set<string> }> {
  // Persist any due daily rank rewards before reading the ranking rows.
  await settleDueDailyChallenges(db, seasonId, new Date().toISOString());
  const rows = await db.listSeasonBestScores(seasonId);

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
  return { ranking, supporters };
}

/** Quick-game ranking for the active-season bucket, version-gated — the same
 *  read the public quick leaderboard uses (listQuickBestScores). */
async function loadQuickRanking(
  db: ReturnType<typeof getDb>,
  seasonId: string | null,
): Promise<QuickRankItem[]> {
  const rows = await db.listQuickBestScores({
    seasonId,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });
  return rows.map((r, i) => ({
    rank: i + 1,
    nickname: r.nickname,
    score: r.score,
  }));
}

export default async function AdminRankingPage() {
  if (!(await isAdmin())) {
    return <AdminLogin />;
  }

  const db = getDb();
  const season = await db.getActiveSeason();

  const [seasonData, quick] = await Promise.all([
    season ? loadSeasonRanking(db, season.id) : Promise.resolve(null),
    loadQuickRanking(db, season?.id ?? null),
  ]);

  return (
    <main className="fade-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">랭킹 보기</p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          ← 관리자
        </Link>
      </header>

      {/* 시즌 랭킹 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">시즌 랭킹</h2>
        <p className="mt-1 text-sm text-zinc-400">
          첨탑·퍼즐·일일 도전을 합산한 시즌 점수 순위입니다.
        </p>
        {!season ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            활성 시즌이 없습니다.
          </div>
        ) : !seasonData || seasonData.ranking.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            아직 시즌 기록이 없습니다.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
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
                {seasonData.ranking.map((item) => (
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
                        {seasonData.supporters.has(item.playerId) && (
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
        )}
      </section>

      {/* 빠른 게임 랭킹 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">빠른 게임 랭킹</h2>
        <p className="mt-1 text-sm text-zinc-400">
          로그인 없이 즐기는 빠른 게임의 최고 점수 순위입니다. 시즌 점수와는
          무관합니다.
        </p>
        {quick.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            아직 빠른 게임 기록이 없습니다.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">순위</th>
                  <th className="px-4 py-3 font-semibold">닉네임</th>
                  <th className="px-4 py-3 text-right font-semibold">최고 점수</th>
                </tr>
              </thead>
              <tbody>
                {quick.map((item) => (
                  <tr
                    key={`${item.rank}-${item.nickname}`}
                    className="border-b border-zinc-800/60 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-amber-300">
                      {item.rank}
                    </td>
                    <td className="max-w-[12rem] px-4 py-3 font-semibold text-zinc-100">
                      <span className="block truncate">{item.nickname}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">
                      {item.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
