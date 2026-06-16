import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/server/auth";
import AdminLogin from "@/app/admin/_components/AdminLogin";
import { getDb } from "@/lib/db";
import GenerateDailyButton from "@/app/admin/daily/_components/GenerateDailyButton";

// Reads the session cookie + live challenge data, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "RULE SLOT | 일일 도전" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ko-KR");
}

export default async function AdminDailyPage() {
  if (!(await isAdmin())) {
    return <AdminLogin />;
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  const challenges = season
    ? (await db.listSeasonDailyChallenges(season.id)).sort((a, b) =>
        a.dateKey.localeCompare(b.dateKey),
      )
    : [];

  return (
    <main className="fade-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">일일 도전 관리</p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          ← 관리자
        </Link>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">
          daily_challenges 생성
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          시즌 기간(14일)의 일일 도전 행을 생성/갱신합니다. settled_at은
          보존되므로 여러 번 실행해도 안전합니다.
        </p>
        <div className="mt-4">
          {season ? (
            <GenerateDailyButton />
          ) : (
            <p className="text-sm text-rose-400">활성 시즌이 없습니다.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">
          등록된 일일 도전 ({challenges.length})
        </h2>
        {challenges.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            등록된 일일 도전이 없습니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {challenges.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm"
              >
                <span className="font-mono text-zinc-100">{c.dateKey}</span>
                <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-400">
                  {c.groupASetId} · {c.groupBSetId}
                </span>
                {c.settledAt ? (
                  <span className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    정산됨 {formatDate(c.settledAt)}
                  </span>
                ) : (
                  <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
                    미정산
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
