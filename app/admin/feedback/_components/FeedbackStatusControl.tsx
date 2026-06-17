"use client";

import { useState } from "react";
import type { FeedbackStatus } from "@/lib/db/types";

const NEXT_LABEL: Record<FeedbackStatus, string> = {
  new: "읽음 처리",
  read: "보관",
  archived: "다시 새 글로",
};
const NEXT_STATUS: Record<FeedbackStatus, FeedbackStatus> = {
  new: "read",
  read: "archived",
  archived: "new",
};

// Cycles a feedback row through new → read → archived → new. Optimistic-ish:
// reloads the route on success so the server-rendered list reflects the change.
export default function FeedbackStatusControl({
  id,
  status,
}: {
  id: string;
  status: FeedbackStatus;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onClick() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: NEXT_STATUS[status] }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      window.location.reload();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:opacity-50"
    >
      {error ? "실패 · 다시" : pending ? "처리 중…" : NEXT_LABEL[status]}
    </button>
  );
}
