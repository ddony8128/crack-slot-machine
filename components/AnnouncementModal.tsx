"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

const SEEN_KEY = "rs_seen_announcement_ids";

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ko-KR");
}

/**
 * Shows published announcements in a one-time modal after login: it opens only
 * when there is at least one announcement the player hasn't seen yet (tracked by
 * id in localStorage, so it never nags about the same notice twice). Closing
 * marks every currently-shown announcement as seen. Logged-out users never get
 * this — the season page only mounts it for a signed-in player.
 */
export default function AnnouncementModal({
  announcements,
}: {
  announcements: AnnouncementItem[];
}) {
  const [open, setOpen] = useState(false);

  // Stable list of current ids — drives the "anything unseen?" check.
  const ids = useMemo(() => announcements.map((a) => a.id), [announcements]);

  useEffect(() => {
    if (announcements.length === 0) return;
    const seen = readSeen();
    // localStorage is an external system read on mount (mirrors ModeIntro); the
    // one-time open decision can't be made until after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ids.some((id) => !seen.has(id))) setOpen(true);
  }, [announcements.length, ids]);

  function close() {
    try {
      const seen = readSeen();
      for (const id of ids) seen.add(id);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // localStorage unavailable (private mode) — modal simply reappears next visit.
    }
    setOpen(false);
  }

  if (announcements.length === 0) return null;

  return (
    <Modal open={open} onClose={close} ariaLabel="공지" maxWidthClass="max-w-md">
      <div className="flex max-h-[88vh] flex-col gap-4 overflow-y-auto p-6">
        <h2 className="text-xl font-black tracking-tight text-amber-300">공지</h2>
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                {a.pinned && (
                  <span className="rounded-full border border-amber-700/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    고정
                  </span>
                )}
                <h3 className="font-bold text-zinc-100">{a.title}</h3>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{formatDate(a.createdAt)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {a.body}
              </p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={close}
          className="mt-1 w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          확인
        </button>
      </div>
    </Modal>
  );
}
