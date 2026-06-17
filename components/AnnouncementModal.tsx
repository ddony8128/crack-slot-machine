"use client";

import Modal from "@/components/Modal";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ko-KR");
}

/**
 * Presentational announcements modal — a controlled list. Open/close + the
 * one-time auto-open + unread tracking live in AnnouncementBell, so this can be
 * reused for both the auto-popup and the 공지 button.
 */
export default function AnnouncementModal({
  open,
  onClose,
  announcements,
}: {
  open: boolean;
  onClose: () => void;
  announcements: AnnouncementItem[];
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="공지" maxWidthClass="max-w-md">
      <div className="flex max-h-[88vh] flex-col gap-4 overflow-y-auto p-6">
        <h2 className="text-xl font-black tracking-tight text-amber-300">공지</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-zinc-400">등록된 공지가 없습니다.</p>
        ) : (
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
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          확인
        </button>
      </div>
    </Modal>
  );
}
