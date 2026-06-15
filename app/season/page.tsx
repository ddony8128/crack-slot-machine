import Link from "next/link";
import SeasonNav from "@/components/SeasonNav";
import { currentPlayer } from "@/lib/server/playerAuth";
import { SEASON_TITLE, MODE_LABELS } from "@/lib/season/config";

const SEASON_PERIOD = "2026년 6월 15일 낮 12시 ~ 6월 28일 낮 12시 (KST)";

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

export default async function SeasonHubPage() {
  const player = await currentPlayer();

  return (
    <div className="flex min-h-full flex-col">
      <SeasonNav />

      <main className="fade-rise mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Season 1
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            {SEASON_TITLE}
          </h1>
          <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-1.5 text-sm font-semibold text-zinc-300">
            {SEASON_PERIOD}
          </p>
        </header>

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
            로그인이 필요하며, 기록이 시즌 점수로 합산됩니다 (최대 3000점).
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {MODE_CARDS.map((card) => (
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
              <span className="mt-auto pt-2 text-sm font-semibold text-emerald-400 transition group-hover:text-emerald-300">
                바로가기 →
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/season/leaderboard"
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            시즌 랭킹
          </Link>
          <Link
            href="/me"
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            내 기록
          </Link>
        </section>
      </main>
    </div>
  );
}
