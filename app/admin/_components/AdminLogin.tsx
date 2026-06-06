"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, AdminApiError } from "@/lib/client/adminApi";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || password.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await adminLogin(password);
      // Re-render the server component so it sees the new session cookie.
      router.refresh();
    } catch (err) {
      const code = err instanceof AdminApiError ? err.code : "unknown";
      setError(
        code === "invalid_password"
          ? "비밀번호가 올바르지 않습니다."
          : "로그인에 실패했습니다. 다시 시도해 주세요.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">
          관리자 로그인
        </p>
      </header>

      <form className="flex w-full max-w-sm flex-col gap-3" onSubmit={onSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="관리자 비밀번호"
          autoFocus
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none transition focus:border-emerald-400"
        />
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {submitting ? "확인 중…" : "로그인"}
        </button>
        {error && (
          <p className="text-center text-sm text-rose-400">{error}</p>
        )}
      </form>
    </main>
  );
}
