"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Calls POST /api/admin/runs/invalidate for one run, then refreshes the page. */
export default function InvalidateRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onInvalidate() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/runs/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) {
        setError("무효 처리에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setError("무효 처리에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onInvalidate}
        disabled={pending}
        className="rounded-lg border border-rose-700/60 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "처리 중…" : "무효 처리"}
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
