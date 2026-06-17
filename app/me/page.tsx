import { redirect } from "next/navigation";
import SeasonNav from "@/components/SeasonNav";
import { currentPlayer } from "@/lib/server/playerAuth";
import { getDb } from "@/lib/db";
import { buildSeasonRanking } from "@/lib/season/scoring";
import type { BestScoreRow } from "@/lib/db/types";

export default async function MePage() {
  const player = await currentPlayer();
  if (!player) redirect("/login");

  const db = getDb();
  const season = await db.getActiveSeason();

  return (
    <div className="flex min-h-full flex-col">
      <SeasonNav />

      <main className="fade-rise mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            내 기록
          </p>
          <h1 className="mt-2 max-w-full truncate text-3xl font-black tracking-tight sm:text-4xl">
            {player.nickname}
          </h1>
        </header>

        {!season ? (
          <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-zinc-400">
            시즌이 없습니다.
          </p>
        ) : (
          await renderRecords(db, season.id, player.id, player.nickname)
        )}
      </main>
    </div>
  );
}

async function renderRecords(
  db: ReturnType<typeof getDb>,
  seasonId: string,
  playerId: string,
  nickname: string,
) {
  const [myRows, allRows] = await Promise.all([
    db.listPlayerBestScores(playerId, seasonId),
    db.listSeasonBestScores(seasonId),
  ]);

  // The player's own season points come from the full cross-player ranking so
  // daily points (rank-based) match the leaderboard exactly.
  const ranking = buildSeasonRanking(allRows, () => nickname);
  const mine = ranking.find((r) => r.playerId === playerId);

  const daily = myRows
    .filter((r) => r.mode === "daily")
    .sort((a, b) => a.scopeKey.localeCompare(b.scopeKey));
  const puzzles = myRows.filter((r) => r.mode === "puzzle");
  const puzzleCleared = puzzles.filter((r) => r.cleared);
  const spire = myRows
    .filter((r) => r.mode === "spire")
    .reduce<BestScoreRow | null>(
      (best, r) => (!best || r.score > best.score ? r : best),
      null,
    );

  return (
    <>
      {/* Season score summary */}
      <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
              시즌 점수
            </p>
            <p className="mt-1 font-mono text-4xl font-black text-emerald-300">
              {mine?.seasonPoints ?? 0}
              <span className="ml-1 text-lg text-zinc-500">점</span>
            </p>
          </div>
          <dl className="flex gap-5 text-sm">
            <div className="text-right">
              <dt className="text-xs text-zinc-500">첨탑</dt>
              <dd className="font-mono font-bold text-zinc-200">
                {mine?.spirePoints ?? 0}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs text-zinc-500">퍼즐</dt>
              <dd className="font-mono font-bold text-zinc-200">
                {mine?.puzzlePoints ?? 0}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs text-zinc-500">일일</dt>
              <dd className="font-mono font-bold text-zinc-200">
                {mine?.dailyPoints ?? 0}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 일일 도전 */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5">
        <h2 className="text-lg font-bold text-zinc-100">일일 도전</h2>
        {daily.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">아직 기록이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/60">
            {daily.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-mono text-zinc-300">{r.scopeKey}</span>
                <span className="font-mono font-bold text-emerald-300">
                  {r.score}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 퍼즐 */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100">퍼즐</h2>
          <span className="text-sm font-semibold text-zinc-400">
            클리어 {puzzleCleared.length} / {puzzles.length}
          </span>
        </div>
        {puzzles.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">아직 기록이 없습니다.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {puzzles.map((r) => (
              <li
                key={r.id}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold ${
                  r.cleared
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-400"
                }`}
              >
                {r.scopeKey}
                {r.cleared ? " ✓" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 첨탑 */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5">
        <h2 className="text-lg font-bold text-zinc-100">첨탑 오르기</h2>
        {!spire ? (
          <p className="mt-2 text-sm text-zinc-500">아직 기록이 없습니다.</p>
        ) : (
          <div className="mt-2 flex items-end justify-between">
            <span className="text-sm text-zinc-400">최고 기록</span>
            <span className="font-mono text-2xl font-black text-emerald-300">
              {spire.score}
            </span>
          </div>
        )}
      </section>
    </>
  );
}
