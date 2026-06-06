"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOTAL_SLUG, type EventRow } from "@/lib/db/types";
import { SLUG_RE } from "@/lib/server/validation";
import {
  AdminApiError,
  adminLogout,
  createAdminEvent,
  fetchAdminEvents,
  setAdminEventActive,
} from "@/lib/client/adminApi";

/** Map a server error code to Korean copy for the create form. */
function createErrorText(code: string): string {
  switch (code) {
    case "slug_exists":
      return "이미 존재하는 slug입니다.";
    case "invalid_slug":
      return "slug 형식이 올바르지 않습니다.";
    case "title_required":
      return "제목을 입력해 주세요.";
    case "unauthorized":
      return "세션이 만료되었습니다. 다시 로그인해 주세요.";
    default:
      return "이벤트 생성에 실패했습니다.";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ko-KR");
}

export default function AdminDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  // Create form state.
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetchAdminEvents();
      setEvents(rows);
      setListError(null);
    } catch (err) {
      if (err instanceof AdminApiError && err.code === "unauthorized") {
        router.refresh();
        return;
      }
      setListError("이벤트 목록을 불러오지 못했습니다.");
    }
  }, [router]);

  useEffect(() => {
    // Fetch-on-mount: load() is async (setState runs in its promise body), but
    // the lint rule can't see that. Mirrors components/LeaderboardView.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function onToggle(row: EventRow) {
    if (pendingSlug) return;
    setPendingSlug(row.slug);
    try {
      await setAdminEventActive(row.slug, !row.isActive);
      await load();
    } catch {
      setListError("상태 변경에 실패했습니다.");
    } finally {
      setPendingSlug(null);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;

    const trimmedSlug = slug.trim();
    const trimmedTitle = title.trim();

    if (!SLUG_RE.test(trimmedSlug)) {
      setFormError(
        "slug는 소문자, 숫자, 하이픈(-)만 사용하며 1~50자여야 합니다.",
      );
      return;
    }
    if (trimmedTitle.length === 0) {
      setFormError("제목을 입력해 주세요.");
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      const desc = description.trim();
      await createAdminEvent({
        slug: trimmedSlug,
        title: trimmedTitle,
        ...(desc.length > 0 ? { description: desc } : {}),
      });
      setSlug("");
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      const code = err instanceof AdminApiError ? err.code : "unknown";
      if (code === "unauthorized") {
        router.refresh();
        return;
      }
      setFormError(createErrorText(code));
    } finally {
      setCreating(false);
    }
  }

  async function onLogout() {
    try {
      await adminLogout();
    } catch {
      // Refresh regardless; the server component re-evaluates the session.
    }
    router.refresh();
  }

  return (
    <main className="fade-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">관리자 콘솔</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          로그아웃
        </button>
      </header>

      {/* Create event form */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">새 이벤트 만들기</h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={onCreate}>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug (예: summer-2026)"
              maxLength={50}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              maxLength={120}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            maxLength={500}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
          />
          {formError && (
            <p className="text-sm text-rose-400">{formError}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="self-start rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {creating ? "생성 중…" : "이벤트 생성"}
          </button>
        </form>
      </section>

      {/* Events list */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">이벤트 목록</h2>

        {listError && (
          <p className="mt-3 text-sm text-rose-400">{listError}</p>
        )}

        {events === null ? (
          <p className="py-8 text-center text-sm text-zinc-500">불러오는 중…</p>
        ) : events.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            등록된 이벤트가 없습니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {events.map((row) => {
              const isTotal = row.slug === TOTAL_SLUG;
              const busy = pendingSlug === row.slug;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-100">
                        {row.title}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                        {row.slug}
                      </span>
                      {row.isActive ? (
                        <span className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
                          비활성
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      생성: {formatDate(row.createdAt)} · 종료:{" "}
                      {formatDate(row.disabledAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/e/${row.slug}/leaderboard`}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
                    >
                      랭킹 보기
                    </Link>
                    {isTotal ? (
                      <span className="rounded-lg border border-amber-700/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                        고정
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggle(row)}
                        disabled={busy}
                        className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy
                          ? "처리 중…"
                          : row.isActive
                            ? "비활성화"
                            : "다시 활성화"}
                      </button>
                    )}
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
