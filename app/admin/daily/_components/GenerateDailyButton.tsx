"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Calls POST /api/admin/daily/generate, then refreshes the server page. */
export default function GenerateDailyButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    if (pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/daily/generate", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        count?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(
          body.error === "no_active_season"
            ? "활성 시즌이 없습니다."
            : "생성에 실패했습니다.",
        );
        return;
      }
      setResult(`${body.count ?? 0}일치 일일 도전을 생성/갱신했습니다.`);
      router.refresh();
    } catch {
      setError("생성에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onGenerate}
        disabled={pending}
        className="self-start rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
      >
        {pending ? "생성 중…" : "14일치 생성/갱신"}
      </button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {result && <p className="text-sm text-emerald-300">{result}</p>}
    </div>
  );
}
