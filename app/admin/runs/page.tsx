import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/server/auth";
import AdminLogin from "@/app/admin/_components/AdminLogin";
import { getDb } from "@/lib/db";
import { decodeSpireRun, type SpireRunSummary } from "@/lib/server/runLog";

// Reads the session cookie + live run data, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "RULE SLOT | 런 로그" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ko-KR");
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300">
      <span className="text-zinc-500">{label}</span>{" "}
      <span className="font-semibold text-zinc-100">{value}</span>
    </span>
  );
}

function RunCard({ run }: { run: SpireRunSummary }) {
  const bagEntries = Object.entries(run.symbolBag).sort((a, b) => b[1] - a[1]);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-zinc-100">
          {run.nickname ?? "Anonymous"}
        </span>
        <span className="font-mono text-[11px] text-zinc-500">{run.runId}</span>
        <span className="text-xs text-zinc-500">{formatDate(run.submittedAt)}</span>
        {!run.ok && (
          <span className="rounded-full border border-rose-700/60 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
            replay 불일치
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Stat label="도달" value={run.stagesCleared} />
        <Stat label="점수" value={run.totalScore} />
        <Stat label="돈" value={run.money} />
        <Stat label="실패" value={run.failures} />
        <Stat label="구매" value={run.purchaseCount} />
      </div>

      <p className="text-sm text-zinc-300">
        <span className="text-zinc-500">아티팩트: </span>
        {run.artifactNames.length > 0 ? run.artifactNames.join(", ") : "—"}
      </p>

      <details className="text-sm text-zinc-400">
        <summary className="cursor-pointer text-zinc-300">규칙 풀 · 심볼 가방</summary>
        <div className="mt-2 flex flex-col gap-2">
          <p>
            <span className="text-zinc-500">규칙 풀: </span>
            {run.rulePoolNames.length > 0 ? run.rulePoolNames.join(", ") : "—"}
          </p>
          <p>
            <span className="text-zinc-500">심볼 가방: </span>
            {bagEntries.length > 0
              ? bagEntries.map(([id, n]) => `${id}×${n}`).join(", ")
              : "—"}
          </p>
        </div>
      </details>
    </li>
  );
}

export default async function AdminRunsPage() {
  if (!(await isAdmin())) {
    return <AdminLogin />;
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  const runs = season
    ? await db.listRecentRuns({
        mode: "spire",
        seasonId: season.id,
        status: "submitted",
        limit: 50,
      })
    : [];
  const summaries = runs.map(decodeSpireRun);

  return (
    <main className="fade-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">첨탑 런 로그 (밸런스 튜닝)</p>
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
          최근 첨탑 런{season ? ` · ${season.title}` : ""}
        </h2>

        {!season ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            활성 시즌이 없습니다.
          </div>
        ) : summaries.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            제출된 첨탑 런이 없습니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {summaries.map((run) => (
              <RunCard key={run.runId} run={run} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
