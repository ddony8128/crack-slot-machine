import Link from "next/link";
import SeasonNav from "@/components/SeasonNav";
import AnnouncementBell from "@/components/AnnouncementBell";
import { currentPlayer } from "@/lib/server/playerAuth";
import { getDb } from "@/lib/db";
import { SEASON_TITLE, SEASON_NOTICE, MODE_LABELS } from "@/lib/season/config";
import { dailyDateKey, dailyAttemptsAllowed } from "@/lib/daily/challenge";
import { settleDueDailyChallenges } from "@/lib/server/dailySettlement";
import { PUZZLES } from "@/lib/puzzle/config";
import { buildSeasonRanking } from "@/lib/season/scoring";
import { replaySpireRun, type SpireAction } from "@/lib/spire/replay";

const SEASON_PERIOD = "2026년 6월 16일 낮 12시 ~ 6월 30일 낮 12시 (KST)";

type ModeCard = {
  href: string;
  label: string;
  desc: string;
  requiresLogin: boolean;
};

const MODE_CARDS: ModeCard[] = [
  {
    href: "/quick",
    label: MODE_LABELS.quick,
    desc: "로그인 없이 바로 즐기는 한 판. 시즌 랭킹에는 반영되지 않아요.",
    requiresLogin: false,
  },
  {
    href: "/season/spire",
    label: MODE_LABELS.spire,
    desc: "층을 오를수록 강해지는 도전. 최고 기록이 시즌 점수가 됩니다.",
    requiresLogin: true,
  },
  {
    href: "/season/puzzle",
    label: MODE_LABELS.puzzle,
    desc: "정해진 규칙을 풀어내는 모드. 클리어한 퍼즐 수만큼 점수.",
    requiresLogin: true,
  },
  {
    href: "/season/daily",
    label: MODE_LABELS.daily,
    desc: "매일 바뀌는 도전. 그날의 순위로 시즌 점수를 쌓습니다.",
    requiresLogin: true,
  },
];

/** Live per-player status lines for a card. `lines[0]` is primary, `lines[1]`
 *  optional secondary. Keyed by mode href. Only built when logged in + active
 *  season; otherwise cards fall back to their generic `desc`. */
type CardStatus = { lines: string[] };

async function buildPlayerStatus(
  playerId: string,
  seasonId: string,
): Promise<Record<string, CardStatus>> {
  const db = getDb();
  const dateKey = dailyDateKey(new Date());

  const [dailyStatus, dailyUsed, puzzleRecords, spireRecord, spireInProgress] =
    await Promise.all([
      db.getDailyUserStatus({ playerId, seasonId, dateKey }),
      db.countResolvedDailyRuns({ playerId, seasonId, dateKey }),
      db.listPlayerPuzzleRecords(playerId, seasonId),
      db.getSpireRecord(playerId, seasonId),
      db.getInProgressRun(playerId, seasonId, "spire"),
    ]);

  // ── Daily ──
  const adRefillUsed = dailyStatus?.adRefillUsed ?? false;
  const allowed = dailyAttemptsAllowed(adRefillUsed);
  const remaining = Math.max(0, allowed - dailyUsed);
  const dailyLines = [`오늘의 도전 ${remaining} / ${allowed}회 남음`];
  if (!adRefillUsed) dailyLines.push("광고 충전 가능");
  else dailyLines.push("광고 충전 완료");

  // ── Puzzle ──
  const clearedCount = puzzleRecords.filter((record) => record.cleared).length;
  const puzzleLines = [`${clearedCount} / ${PUZZLES.length}문제 클리어`];

  // ── Spire ──
  const spireLines = spireRecord
    ? [
        `최고 도달 ${spireRecord.bestStageReached}스테이지 · 최고 ${spireRecord.bestTotalScore}점`,
      ]
    : ["아직 기록 없음"];
  // Resumable run (saved at the last stage/shop boundary) → prepend an 이어하기 line.
  if (spireInProgress?.actions) {
    const replay = replaySpireRun(
      spireInProgress.seed,
      spireInProgress.actions as SpireAction[],
    );
    if (replay.ok && !replay.runEnded) {
      spireLines.unshift(`▶ 이어하기 — ${replay.finalState.currentStage}스테이지 진행 중`);
    }
  }

  return {
    "/season/daily": { lines: dailyLines },
    "/season/puzzle": { lines: puzzleLines },
    "/season/spire": { lines: spireLines },
  };
}

/** The logged-in player's season points + rank, sourced from the SAME read path
 *  as /me (listSeasonBestScores → buildSeasonRanking) so the numbers match the
 *  leaderboard exactly. `rank`/`seasonPoints` are null when the player has no
 *  point-bearing rows yet (랭킹 미집계). */
type SeasonSummary = { seasonPoints: number; rank: number | null };

async function buildSeasonSummary(
  playerId: string,
  nickname: string,
  seasonId: string,
): Promise<SeasonSummary> {
  const allRows = await getDb().listSeasonBestScores(seasonId);
  // Only this player's nickname is load-bearing; others affect only ordering,
  // which is decided by points, not names.
  const ranking = buildSeasonRanking(allRows, () => nickname);
  const mine = ranking.find((r) => r.playerId === playerId);
  // A player with no rows isn't in the ranking at all → unranked, 0 points.
  if (!mine) return { seasonPoints: 0, rank: null };
  return {
    seasonPoints: mine.seasonPoints,
    rank: mine.seasonPoints > 0 ? mine.rank : null,
  };
}

export default async function SeasonHubPage() {
  const [player, season] = await Promise.all([
    currentPlayer(),
    getDb().getActiveSeason(),
  ]);

  // Settle any ended daily windows before showing season status/ranking entry.
  if (season) {
    await settleDueDailyChallenges(getDb(), season.id, new Date().toISOString());
  }

  // Only show live status when a player is logged in AND a season is active.
  const [statusByHref, seasonSummary] =
    player && season
      ? await Promise.all([
          buildPlayerStatus(player.id, season.id),
          buildSeasonSummary(player.id, player.nickname, season.id),
        ])
      : [null, null];

  // Published announcements for the hub's 공지 button (logged-in players). Degrade
  // to none on any read failure so the hub never breaks.
  const announcements = player
    ? await getDb()
        .listPublishedAnnouncements(season?.id ?? null)
        .then((rows) =>
          rows.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            pinned: a.pinned,
            createdAt: a.createdAt,
          })),
        )
        .catch(() => [])
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <SeasonNav />

      <main className="fade-rise mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Pre-Season 1
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            {SEASON_TITLE}
          </h1>
          <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-1.5 text-sm font-semibold text-zinc-300">
            {SEASON_PERIOD}
          </p>
        </header>

        {player && (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="max-w-full truncate text-xl font-black text-zinc-100">
                {player.nickname}
              </h2>
              {player.supporterBadge && (
                <span className="rounded-full border border-amber-700/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  후원자
                </span>
              )}
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                  현재 시즌 점수
                </dt>
                <dd className="mt-1 font-mono text-3xl font-black text-emerald-300">
                  {seasonSummary?.seasonPoints ?? 0}
                  <span className="ml-1 text-base text-zinc-500">점</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                  현재 등수
                </dt>
                <dd className="mt-1 font-mono text-3xl font-black text-zinc-100">
                  {seasonSummary?.rank != null ? (
                    <>
                      {seasonSummary.rank}
                      <span className="ml-1 text-base text-zinc-500">위</span>
                    </>
                  ) : (
                    <span className="text-xl text-zinc-500">랭킹 미집계</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        )}

        <p className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-center text-xs leading-relaxed text-amber-200/90">
          {SEASON_NOTICE}
        </p>

        {!player && (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-5 py-5 text-center">
            <p className="text-base font-semibold text-zinc-100">
              로그인하고 시즌 랭킹에 도전하세요!
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              첨탑·퍼즐·일일 도전 기록은 로그인한 계정에만 저장됩니다.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/login"
                className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-5 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800/60"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
              >
                회원가입
              </Link>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-sm leading-relaxed text-zinc-400">
          <h2 className="mb-1 text-sm font-semibold text-zinc-200">시즌 안내</h2>
          <p>
            <span className="font-semibold text-zinc-300">빠른 게임</span>은
            로그인 없이 즐길 수 있지만 시즌 랭킹에는 반영되지 않습니다.{" "}
            <span className="font-semibold text-zinc-300">첨탑 오르기·퍼즐 모드·일일 도전</span>은
            로그인이 필요하며, 기록이 시즌 점수로 합산됩니다.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {MODE_CARDS.map((card) => {
            // Quick is always static. Other cards show live status when
            // available, falling back to the generic description otherwise.
            const status =
              card.href === "/quick"
                ? { lines: ["시즌 랭킹에 반영되지 않습니다."] }
                : statusByHref?.[card.href] ?? null;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5 transition hover:border-emerald-500/50 hover:bg-zinc-800/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-zinc-100">{card.label}</h3>
                  {card.requiresLogin ? (
                    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                      로그인 필요
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                      누구나
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-400">{card.desc}</p>
                {status && (
                  <div className="flex flex-col gap-0.5">
                    {status.lines.map((line, i) => (
                      <span
                        key={i}
                        className={
                          i === 0
                            ? "text-xs font-semibold text-amber-300/90"
                            : "text-xs font-medium text-zinc-500"
                        }
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                )}
                <span className="mt-auto pt-2 text-sm font-semibold text-emerald-400 transition group-hover:text-emerald-300">
                  바로가기 →
                </span>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/season/leaderboard"
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            시즌 랭킹
          </Link>
          <Link
            href="/quick/leaderboard"
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            빠른 게임 랭킹 보기
          </Link>
          <Link
            href="/me"
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            내 기록
          </Link>
          {player && <AnnouncementBell announcements={announcements} variant="hub" />}
        </section>
      </main>
    </div>
  );
}
