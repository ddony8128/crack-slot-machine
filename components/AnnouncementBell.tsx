"use client";

import { useEffect, useMemo, useState } from "react";
import AnnouncementModal, { type AnnouncementItem } from "@/components/AnnouncementModal";

const SEEN_KEY = "rs_seen_announcement_ids";
const AUTO_KEY = "rs_announce_autoshown"; // sessionStorage: auto-open at most once/session

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

/**
 * The 공지 button (in SeasonNav). Opens the announcements modal ON DEMAND — so a
 * notice is never "seen once then gone" — and also auto-opens ONCE per browser
 * session when there are unseen announcements. An unread dot marks new notices
 * (so players don't worry they missed something); it clears once the modal is
 * closed (every shown announcement id is then remembered in localStorage).
 */
export default function AnnouncementBell({
  announcements,
}: {
  announcements: AnnouncementItem[];
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ids = useMemo(() => announcements.map((a) => a.id), [announcements]);

  useEffect(() => {
    if (announcements.length === 0) return;
    const seen = readSeen();
    const unseen = ids.filter((id) => !seen.has(id));
    // external store (localStorage/sessionStorage) read on mount → setState here
    // is the documented exception (mirrors ModeIntro / useDonationPrompt).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnread(unseen.length);
    let autoShown = true;
    try {
      autoShown = !!sessionStorage.getItem(AUTO_KEY);
    } catch {
      // sessionStorage unavailable → treat as already shown (skip auto-open).
    }
    if (unseen.length > 0 && !autoShown) {
      setOpen(true);
      try {
        sessionStorage.setItem(AUTO_KEY, "1");
      } catch {
        // ignore — worst case it auto-opens again next navigation this session.
      }
    }
  }, [announcements.length, ids]);

  function close() {
    try {
      const seen = readSeen();
      for (const id of ids) seen.add(id);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // localStorage unavailable — the dot simply reappears next visit.
    }
    setUnread(0);
    setOpen(false);
  }

  if (announcements.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `공지 (새 공지 ${unread}개)` : "공지"}
        className="relative rounded-lg px-2.5 py-1.5 font-semibold text-zinc-300 transition hover:bg-zinc-800/60 hover:text-zinc-100"
      >
        공지
        {unread > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-zinc-950" />
        )}
      </button>
      <AnnouncementModal open={open} onClose={close} announcements={announcements} />
    </>
  );
}
