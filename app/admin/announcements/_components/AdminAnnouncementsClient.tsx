"use client";

import { useCallback, useEffect, useState } from "react";

type Announcement = {
  id: string;
  seasonId: string | null;
  title: string;
  body: string;
  published: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ko-KR");
}

export default function AdminAnnouncementsClient() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // create form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [publishNow, setPublishNow] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/announcements");
      if (!res.ok) throw new Error(`http_${res.status}`);
      const data = await res.json();
      setItems(data.items as Announcement[]);
    } catch {
      setError("공지 목록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setFormError(null);
    if (title.trim().length === 0 || body.trim().length === 0) {
      setFormError("제목과 내용을 입력하세요.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, pinned, published: publishNow }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      setTitle("");
      setBody("");
      setPinned(false);
      setPublishNow(true);
      await load();
    } catch {
      setFormError("등록에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: string, patch: Partial<Pick<Announcement, "published" | "pinned">>) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      await load();
    } catch {
      setError("변경에 실패했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("이 공지를 삭제할까요?")) return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`http_${res.status}`);
      await load();
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create form */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">새 공지 작성</h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={onCreate}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            maxLength={200}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="내용"
            rows={5}
            maxLength={5000}
            className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
          />
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
              바로 발행
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              상단 고정
            </label>
          </div>
          {formError && <p className="text-sm text-rose-400">{formError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="self-start rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {creating ? "등록 중…" : "공지 등록"}
          </button>
        </form>
      </section>

      {/* List */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-bold text-zinc-100">전체 공지</h2>
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        {items == null ? (
          <p className="mt-4 text-sm text-zinc-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            아직 공지가 없습니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-100">{a.title}</span>
                  {a.pinned && (
                    <span className="rounded-full border border-amber-700/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                      고정
                    </span>
                  )}
                  <span
                    className={
                      a.published
                        ? "rounded-full border border-emerald-700/60 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"
                        : "rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-semibold text-zinc-400"
                    }
                  >
                    {a.published ? "발행됨" : "임시저장"}
                  </span>
                  <span className="text-xs text-zinc-500">{formatDate(a.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-400">{a.body}</p>
                <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-2">
                  <button
                    type="button"
                    disabled={pendingId === a.id}
                    onClick={() => patch(a.id, { published: !a.published })}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:opacity-50"
                  >
                    {a.published ? "발행 취소" : "발행"}
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === a.id}
                    onClick={() => patch(a.id, { pinned: !a.pinned })}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:opacity-50"
                  >
                    {a.pinned ? "고정 해제" : "상단 고정"}
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === a.id}
                    onClick={() => remove(a.id)}
                    className="rounded-lg border border-rose-700/60 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
