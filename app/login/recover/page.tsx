import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "RULE SLOT | 비밀번호 찾기" };

// Operator contact — kept in sync with app/privacy/page.tsx (§7 문의).
const OPERATOR_EMAIL = "ddoddony@naver.com";

/**
 * 비밀번호 찾기 (password recovery).
 *
 * RULE SLOT has no transactional email service, so there is no self-serve
 * "email me a reset link" flow to fake. Instead we give players an honest,
 * working path: contact the operator with the email/phone they registered, and
 * the operator resets the password (and tells them the temporary one). This page
 * is purely informational — no form that silently does nothing.
 */
export default function RecoverPage() {
  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">
          비밀번호 찾기
        </p>
      </header>

      <section className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-6 text-sm leading-relaxed text-zinc-300">
        <p>
          현재 RULE SLOT은 자동 비밀번호 재설정 메일을 보내드리지 못합니다.
          비밀번호를 잊으셨다면 아래 방법으로 운영자에게 재설정을 요청해 주세요.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-zinc-300">
          <li>
            가입 시 등록한 <span className="font-semibold text-zinc-100">닉네임</span>과{" "}
            <span className="font-semibold text-zinc-100">이메일 또는 전화번호</span>를
            준비합니다.
          </li>
          <li>
            아래 이메일로{" "}
            <span className="font-semibold text-zinc-100">
              닉네임 + 등록한 이메일/전화번호
            </span>
            를 보내 본인 확인을 진행합니다.
          </li>
          <li>
            운영자가 확인 후 임시 비밀번호로 재설정해 드립니다. 로그인 후{" "}
            <span className="font-semibold text-zinc-100">설정 → 비밀번호 변경</span>
            에서 새 비밀번호로 바꿔 주세요.
          </li>
        </ol>

        <a
          href={`mailto:${OPERATOR_EMAIL}?subject=${encodeURIComponent(
            "[RULE SLOT] 비밀번호 재설정 요청",
          )}`}
          className="mt-5 block break-all rounded-xl bg-emerald-500 px-6 py-3 text-center text-base font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          {OPERATOR_EMAIL}로 재설정 요청
        </a>

        <p className="mt-3 text-xs text-zinc-500">
          본인 확인이 되지 않으면 보안을 위해 재설정을 진행할 수 없습니다.
        </p>
      </section>

      <Link
        href="/login"
        className="text-sm font-semibold text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
      >
        ← 로그인으로 돌아가기
      </Link>
    </main>
  );
}
