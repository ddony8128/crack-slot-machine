import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/server/auth";
import AdminLogin from "@/app/admin/_components/AdminLogin";
import { getDb } from "@/lib/db";
import type { FeedbackStatus } from "@/lib/db/types";
import FeedbackStatusControl from "@/app/admin/feedback/_components/FeedbackStatusControl";

// Reads the session cookie + live feedback, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "RULE SLOT | 피드백" };

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ko-KR");
}

const STATUS_BADGE: Record<FeedbackStatus, { label: string; cls: string }> = {
  new: {
    label: "새 글",
    cls: "border-emerald-700/60 bg-emerald-500/10 text-emerald-300",
  },
  read: {
    label: "읽음",
    cls: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
  },
  archived: {
    label: "보관",
    cls: "border-zinc-700 bg-zinc-900/60 text-zinc-500",
  },
};

export default async function AdminFeedbackPage() {
  if (!(await isAdmin())) {
    return <AdminLogin />;
  }

  const db = getDb();
  const rows = await db.listFeedback();
  // Resolve author nicknames (deduped).
  const ids = [...new Set(rows.map((r) => r.playerId).filter((x): x is string => !!x))];
  const players = await Promise.all(ids.map((id) => db.getPlayerById(id)));
  const nicknameById = new Map(ids.map((id, i) => [id, players[i]?.nickname ?? "알수없음"]));

  return (
    <main className="fade-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">유저 후기 · 피드백</p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          ← 관리자
        </Link>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">받은 피드백 ({rows.length})</h2>
        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            아직 받은 피드백이 없습니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((f) => {
              const badge = STATUS_BADGE[f.status];
              const nickname = f.playerId
                ? nicknameById.get(f.playerId) ?? "알수없음"
                : "(탈퇴/게스트)";
              return (
                <li
                  key={f.id}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-100">{nickname}</span>
                    {f.rating != null && (
                      <span className="text-amber-300" aria-label={`별점 ${f.rating}`}>
                        {"★".repeat(f.rating)}
                        <span className="text-zinc-700">{"★".repeat(5 - f.rating)}</span>
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-zinc-500">{formatDate(f.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-zinc-300">{f.body}</p>
                  <div className="border-t border-zinc-800 pt-2">
                    <FeedbackStatusControl id={f.id} status={f.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
