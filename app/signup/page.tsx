"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup, AuthApiError } from "@/lib/client/authApi";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_nickname: "닉네임을 입력해 주세요.",
  invalid_contact: "연락처를 올바르게 입력해 주세요.",
  weak_password: "비밀번호는 8자 이상이어야 합니다.",
  agreement_required: "개인정보 처리방침에 동의해 주세요.",
  nickname_taken: "이미 사용 중인 닉네임입니다.",
};

export default function SignupPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signup({ nickname, contactType, contactValue, password, agree });
      router.push("/season");
      router.refresh();
    } catch (err) {
      const code = err instanceof AuthApiError ? err.code : "unknown";
      setError(
        ERROR_MESSAGES[code] ?? "가입에 실패했습니다. 다시 시도해 주세요.",
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
          시즌 1 회원가입
        </p>
      </header>

      <form className="flex w-full max-w-sm flex-col gap-3" onSubmit={onSubmit}>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임"
          maxLength={60}
          autoComplete="username"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none transition focus:border-emerald-400"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setContactType("email")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              contactType === "email"
                ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60"
            }`}
          >
            이메일
          </button>
          <button
            type="button"
            onClick={() => setContactType("phone")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              contactType === "phone"
                ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60"
            }`}
          >
            전화번호
          </button>
        </div>

        <input
          type={contactType === "email" ? "email" : "tel"}
          value={contactValue}
          onChange={(e) => setContactValue(e.target.value)}
          placeholder={
            contactType === "email" ? "이메일 주소" : "전화번호"
          }
          autoComplete={contactType === "email" ? "email" : "tel"}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none transition focus:border-emerald-400"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (8자 이상)"
          autoComplete="new-password"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none transition focus:border-emerald-400"
        />

        <label className="flex items-start gap-2 px-1 text-left text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-emerald-500"
          />
          <span>
            <Link
              href="/privacy"
              target="_blank"
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              개인정보 처리방침
            </Link>
            에 동의합니다.
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {submitting ? "가입 중…" : "회원가입"}
        </button>

        {error && <p className="text-center text-sm text-rose-400">{error}</p>}
      </form>

      <p className="text-sm text-zinc-400">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-semibold text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
        >
          로그인
        </Link>
      </p>
    </main>
  );
}
