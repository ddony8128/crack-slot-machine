"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup, AuthApiError } from "@/lib/client/authApi";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_nickname: "닉네임을 입력해 주세요.",
  contact_required: "이메일 또는 전화번호 중 하나는 입력해 주세요.",
  invalid_email: "이메일 형식이 올바르지 않습니다.",
  invalid_phone: "전화번호 형식이 올바르지 않습니다.",
  weak_password: "비밀번호는 8자 이상이어야 합니다.",
  password_mismatch: "비밀번호가 일치하지 않습니다.",
  agreement_required: "개인정보 처리방침에 동의해 주세요.",
  nickname_taken: "이미 사용 중인 닉네임입니다.",
  email_taken: "이미 사용 중인 이메일입니다.",
  phone_taken: "이미 사용 중인 전화번호입니다.",
};

export default function SignupPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (email.trim().length === 0 && phone.trim().length === 0) {
      setError(ERROR_MESSAGES.contact_required);
      return;
    }
    if (password.length < 8) {
      setError(ERROR_MESSAGES.weak_password);
      return;
    }
    if (password !== passwordConfirm) {
      setError(ERROR_MESSAGES.password_mismatch);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signup({
        nickname,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        agree,
      });
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

        <p className="px-1 text-left text-xs text-zinc-500">
          이메일 또는 전화번호 중 하나 이상 입력해 주세요. (둘 다 입력 가능)
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 (선택)"
          autoComplete="email"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none transition focus:border-emerald-400"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="전화번호 (선택)"
          autoComplete="tel"
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
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="비밀번호 확인"
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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-5 py-3 text-lg font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← 이전
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {submitting ? "가입 중…" : "회원가입"}
          </button>
        </div>

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
