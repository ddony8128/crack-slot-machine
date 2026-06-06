"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchLeaderboard } from "@/lib/client/api";
import type { LeaderboardPage } from "@/lib/db/types";
import { CLIENT_VERSION, RULESET_VERSION } from "@/lib/version";

type Props = { slug: string; title: string; isTotal: boolean };

const PAGE_SIZE = 10;
const POLL_MS = 10_000;

export default function LeaderboardView({ slug, title, isTotal }: Props) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardPage | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p: number) => {
      try {
        const res = await fetchLeaderboard(slug, p, PAGE_SIZE);
        setData(res);
      } catch {
        // keep the last good data on a transient error
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  // Refetch on page change and poll every 10s for the current page.
  useEffect(() => {
    // load() is async (setState happens in its .then/.finally), but the lint rule
    // can't see that — it's a fetch-on-mount + 10s poll, which is exactly the
    // external-system-subscription pattern effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page);
    const t = setInterval(() => load(page), POLL_MS);
    return () => clearInterval(t);
  }, [page, load]);

  const totalCount = data?.totalCount ?? 0;
  const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const items = data?.items ?? [];

  return (
    <main className="fade-rise mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-2 text-lg font-bold text-zinc-100">
          {isTotal ? "전체 랭킹" : `${title} 랭킹`}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          현재 버전: client {CLIENT_VERSION} / ruleset {RULESET_VERSION}
        </p>
      </header>

      <div className="min-h-[24rem]">
        {loading && !data ? (
          <p className="py-12 text-center text-sm text-zinc-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-12 text-center text-sm text-zinc-500">
            아직 기록이 없습니다
          </div>
        ) : (
          <ol className="space-y-1">
            {items.map((item) => (
              <li
                key={`${item.rank}-${item.nickname}-${item.submittedAt}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-7 text-center font-mono font-bold text-amber-300">
                    {item.rank}
                  </span>
                  <span className="truncate font-semibold text-zinc-200">
                    {item.nickname}
                  </span>
                  {isTotal && (
                    <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                      {item.eventSlug}
                    </span>
                  )}
                </span>
                <span className="font-mono font-bold text-emerald-300">
                  {item.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전
        </button>
        <span className="font-mono text-sm text-zinc-400">
          {page} / {maxPage}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
          disabled={page >= maxPage}
          className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음
        </button>
      </div>

      <div className="text-center">
        <Link
          href={`/e/${slug}`}
          className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
        >
          ← 플레이로 돌아가기
        </Link>
      </div>
    </main>
  );
}
