import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/server/auth";
import AdminLogin from "@/app/admin/_components/AdminLogin";
import { getDb } from "@/lib/db";
import type {
  BestScoreRow,
  PlayerRow,
  PuzzleRecordRow,
  ScoreEventRow,
  SpireRecordRow,
} from "@/lib/db/types";

// Reads the session cookie + live player data, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "RULE SLOT | 유저 검색" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ko-KR");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="break-all text-sm text-zinc-100">{value}</span>
    </div>
  );
}

function PlayerDetail({
  player,
  bestScores,
  scoreEvents,
  spire,
  puzzles,
}: {
  player: PlayerRow;
  bestScores: BestScoreRow[];
  scoreEvents: ScoreEventRow[];
  spire: SpireRecordRow | null;
  puzzles: PuzzleRecordRow[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-100">{player.nickname}</h2>
          {player.supporterBadge && (
            <span className="rounded-full border border-amber-700/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              후원자
            </span>
          )}
          {player.deletedAt && (
            <span className="rounded-full border border-rose-700/60 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
              탈퇴
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="id" value={player.id} />
          <Field
            label="contact"
            value={`${player.contactType}: ${player.contactValue || "—"}`}
          />
          <Field label="가입" value={formatDate(player.createdAt)} />
          <Field
            label="후원자 부여"
            value={formatDate(player.supporterBadgeGrantedAt)}
          />
          <Field label="탈퇴" value={formatDate(player.deletedAt)} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-base font-bold text-zinc-100">최고 점수 (best_scores)</h3>
        {bestScores.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">없음</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bestScores.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm"
              >
                <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                  {b.mode}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {b.scopeKey}
                </span>
                <span className="text-zinc-100">점수 {b.score}</span>
                <span className="text-zinc-400">시즌점수 {b.seasonPoints}</span>
                <span className="ml-auto text-[11px] text-zinc-500">
                  {formatDate(b.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-base font-bold text-zinc-100">첨탑 · 퍼즐 기록</h3>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-zinc-300">
            <span className="text-zinc-500">첨탑: </span>
            {spire
              ? `${spire.bestStageReached}층 · ${spire.bestTotalScore}점`
              : "없음"}
          </p>
          {puzzles.length === 0 ? (
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">퍼즐: </span>없음
            </p>
          ) : (
            <ul className="space-y-1">
              {puzzles.map((p) => (
                <li key={p.id} className="text-sm text-zinc-300">
                  <span className="font-mono text-[11px] text-zinc-500">
                    {p.puzzleKey}
                  </span>{" "}
                  {p.cleared
                    ? `클리어${p.bestClearSpin !== null ? ` · ${p.bestClearSpin}스핀` : ""}${p.bestPuzzleScore !== null ? ` · ${p.bestPuzzleScore}점` : ""}`
                    : "미클리어"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-base font-bold text-zinc-100">
          최근 점수 변동 (score_events)
        </h3>
        {scoreEvents.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">없음</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {scoreEvents.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm"
              >
                <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                  {e.sourceType}
                </span>
                <span className={e.delta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {e.delta >= 0 ? "+" : ""}
                  {e.delta}
                </span>
                <span className="text-zinc-400">
                  {e.previousTotalScore} → {e.newTotalScore}
                </span>
                <span className="ml-auto text-[11px] text-zinc-500">
                  {formatDate(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const PAGE_SIZE = 25;

/** Paginated list of every player (no search). Each nickname links to its detail. */
function UserList({
  players,
  total,
  page,
}: {
  players: PlayerRow[];
  total: number;
  page: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-base font-bold text-zinc-100">
        전체 유저 ({total}명)
      </h2>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">유저가 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-800/70">
          {players.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="w-8 shrink-0 text-right font-mono text-[11px] text-zinc-600">
                {start + i + 1}
              </span>
              <Link
                href={`/admin/users?q=${encodeURIComponent(p.nickname)}`}
                className="font-semibold text-emerald-300 hover:underline"
              >
                {p.nickname}
              </Link>
              {p.supporterBadge && (
                <span className="rounded-full border border-amber-700/60 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  후원자
                </span>
              )}
              {p.deletedAt && (
                <span className="rounded-full border border-rose-700/60 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                  탈퇴
                </span>
              )}
              <span className="text-xs text-zinc-500">
                {p.contactType}: {p.contactValue || "—"}
              </span>
              <span className="ml-auto text-[11px] text-zinc-500">
                {formatDate(p.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800 pt-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/users?page=${page - 1}`}
              className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
            >
              ← 이전
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-600">← 이전</span>
          )}
          <span className="text-zinc-400">
            {page} / {lastPage}
          </span>
          {page < lastPage ? (
            <Link
              href={`/admin/users?page=${page + 1}`}
              className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
            >
              다음 →
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-600">다음 →</span>
          )}
        </div>
      )}
    </section>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  if (!(await isAdmin())) {
    return <AdminLogin />;
  }

  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const db = getDb();
  const season = await db.getActiveSeason();
  const player = query ? await db.getPlayerByNickname(query) : null;
  // No search → the full paginated roster.
  const roster = query ? null : await db.listPlayers({ page, pageSize: PAGE_SIZE });

  let detail: {
    bestScores: BestScoreRow[];
    scoreEvents: ScoreEventRow[];
    spire: SpireRecordRow | null;
    puzzles: PuzzleRecordRow[];
  } | null = null;

  if (player && season) {
    const [bestScores, scoreEvents, spire, puzzles] = await Promise.all([
      db.listPlayerBestScores(player.id, season.id),
      db.listScoreEvents(player.id, season.id),
      db.getSpireRecord(player.id, season.id),
      db.listPlayerPuzzleRecords(player.id, season.id),
    ]);
    detail = { bestScores, scoreEvents, spire, puzzles };
  }

  return (
    <main className="fade-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">유저 목록 · 검색</p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          ← 관리자
        </Link>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="닉네임"
            maxLength={120}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 sm:flex-1"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
          >
            검색
          </button>
        </form>
      </section>

      {!query ? (
        <UserList
          players={roster?.players ?? []}
          total={roster?.total ?? 0}
          page={page}
        />
      ) : !player ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
          {`'${query}' 닉네임의 플레이어를 찾을 수 없습니다.`}
        </div>
      ) : !season || !detail ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
          활성 시즌이 없어 기록을 표시할 수 없습니다.
        </div>
      ) : (
        <PlayerDetail
          player={player}
          bestScores={detail.bestScores}
          scoreEvents={detail.scoreEvents}
          spire={detail.spire}
          puzzles={detail.puzzles}
        />
      )}
    </main>
  );
}
