"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOTAL_SLUG, type EventRow, type PlayerRow } from "@/lib/db/types";
import { SLUG_RE } from "@/lib/server/validation";
import {
  AdminApiError,
  adminLogout,
  createAdminEvent,
  createAdminPlayer,
  deleteAdminPlayer,
  fetchAdminEvents,
  fetchAdminPlayers,
  restoreAdminPlayer,
  setAdminEventActive,
  updateAdminEvent,
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

  // Inline edit state (one row at a time).
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Nickname whitelist state.
  const [players, setPlayers] = useState<PlayerRow[] | null>(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [playerListError, setPlayerListError] = useState<string | null>(null);
  const [newNickname, setNewNickname] = useState("");
  const [playerFormError, setPlayerFormError] = useState<string | null>(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);

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

  const loadPlayers = useCallback(async () => {
    try {
      const rows = await fetchAdminPlayers(includeDeleted);
      setPlayers(rows);
      setPlayerListError(null);
    } catch (err) {
      if (err instanceof AdminApiError && err.code === "unauthorized") {
        router.refresh();
        return;
      }
      setPlayerListError("닉네임 목록을 불러오지 못했습니다.");
    }
  }, [includeDeleted, router]);

  useEffect(() => {
    // Reload whenever the "삭제 포함 보기" toggle changes (and on mount).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlayers();
  }, [loadPlayers]);

  async function onAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (addingPlayer) return;

    const trimmed = newNickname.trim();
    if (trimmed.length === 0) {
      setPlayerFormError("닉네임을 입력하세요.");
      return;
    }

    setAddingPlayer(true);
    setPlayerFormError(null);
    try {
      await createAdminPlayer(trimmed);
      setNewNickname("");
      await loadPlayers();
    } catch (err) {
      const code = err instanceof AdminApiError ? err.code : "unknown";
      if (code === "unauthorized") {
        router.refresh();
        return;
      }
      setPlayerFormError(
        code === "nickname_exists"
          ? "이미 등록된 닉네임입니다."
          : code === "invalid_nickname"
            ? "닉네임을 입력하세요."
            : "닉네임 추가에 실패했습니다.",
      );
    } finally {
      setAddingPlayer(false);
    }
  }

  async function onDeletePlayer(row: PlayerRow) {
    if (pendingPlayerId) return;
    setPendingPlayerId(row.id);
    try {
      await deleteAdminPlayer(row.id);
      await loadPlayers();
    } catch (err) {
      if (err instanceof AdminApiError && err.code === "unauthorized") {
        router.refresh();
        return;
      }
      setPlayerListError("삭제에 실패했습니다.");
    } finally {
      setPendingPlayerId(null);
    }
  }

  async function onRestorePlayer(row: PlayerRow) {
    if (pendingPlayerId) return;
    setPendingPlayerId(row.id);
    try {
      await restoreAdminPlayer(row.id);
      await loadPlayers();
    } catch (err) {
      const code = err instanceof AdminApiError ? err.code : "unknown";
      if (code === "unauthorized") {
        router.refresh();
        return;
      }
      setPlayerListError(
        code === "nickname_exists"
          ? "이미 동일한 닉네임이 사용 중이라 복구할 수 없습니다."
          : "복구에 실패했습니다.",
      );
    } finally {
      setPendingPlayerId(null);
    }
  }

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

  function startEdit(row: EventRow) {
    setEditingSlug(row.slug);
    setEditTitle(row.title);
    setEditDesc(row.description ?? "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingSlug(null);
    setEditError(null);
  }

  async function saveEdit(row: EventRow) {
    if (savingEdit) return;
    const t = editTitle.trim();
    if (t.length === 0) {
      setEditError("제목을 입력해 주세요.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateAdminEvent(row.slug, {
        title: t,
        description: editDesc.trim(),
      });
      setEditingSlug(null);
      await load();
    } catch (err) {
      const code = err instanceof AdminApiError ? err.code : "unknown";
      if (code === "unauthorized") {
        router.refresh();
        return;
      }
      setEditError(
        code === "title_required"
          ? "제목을 입력해 주세요."
          : "수정에 실패했습니다.",
      );
    } finally {
      setSavingEdit(false);
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
              const editing = editingSlug === row.slug;

              if (editing) {
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 rounded-xl border border-emerald-700/50 bg-zinc-900/60 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                        {row.slug}
                      </span>
                      <span className="text-xs text-zinc-500">
                        slug은 변경할 수 없습니다
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="제목"
                      maxLength={120}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-400"
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="설명 (선택)"
                      maxLength={500}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-400"
                    />
                    {editError && (
                      <p className="text-sm text-rose-400">{editError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(row)}
                        disabled={savingEdit}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                      >
                        {savingEdit ? "저장 중…" : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  </li>
                );
              }

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
                    {row.description && (
                      <p className="mt-1 truncate text-sm text-zinc-300">
                        {row.description}
                      </p>
                    )}
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
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
                    >
                      수정
                    </button>
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

      {/* Nickname whitelist */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-zinc-100">닉네임 화이트리스트</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-amber-300/80">
          운영(8번출구 연동) 시에는 <b>8번출구 대시보드</b>에서 참가자를 등록·관리합니다.
          아래 목록은 8번출구 미연동(로컬/테스트) 폴백용입니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-emerald-500"
            />
            삭제 포함 보기
          </label>
        </div>

        <form className="mt-4 flex flex-col gap-3" onSubmit={onAddPlayer}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="닉네임"
              maxLength={60}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={addingPlayer}
              className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              {addingPlayer ? "추가 중…" : "추가"}
            </button>
          </div>
          {playerFormError && (
            <p className="text-sm text-rose-400">{playerFormError}</p>
          )}
        </form>

        {playerListError && (
          <p className="mt-3 text-sm text-rose-400">{playerListError}</p>
        )}

        {players === null ? (
          <p className="py-8 text-center text-sm text-zinc-500">불러오는 중…</p>
        ) : players.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            등록된 닉네임이 없습니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {players.map((row) => {
              const deleted = row.deletedAt !== null;
              const busy = pendingPlayerId === row.id;
              return (
                <li
                  key={row.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    deleted
                      ? "border-zinc-800 bg-zinc-900/30 opacity-60"
                      : "border-zinc-800 bg-zinc-900/60"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-semibold ${
                          deleted
                            ? "text-zinc-400 line-through"
                            : "text-zinc-100"
                        }`}
                      >
                        {row.nickname}
                      </span>
                      {deleted && (
                        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
                          삭제됨
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      생성: {formatDate(row.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {deleted ? (
                      includeDeleted && (
                        <button
                          type="button"
                          onClick={() => onRestorePlayer(row)}
                          disabled={busy}
                          className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? "처리 중…" : "복구"}
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDeletePlayer(row)}
                        disabled={busy}
                        className="rounded-lg border border-rose-800/60 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? "처리 중…" : "삭제"}
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
