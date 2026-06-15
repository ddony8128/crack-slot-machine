import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "RULE SLOT | 개인정보 처리방침" };

export default function PrivacyPage() {
  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          개인정보 처리방침
        </h1>
        <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">
          시즌 1
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">1. 수집 항목</h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-400">
            <li>닉네임</li>
            <li>이메일 또는 전화번호</li>
            <li>게임 플레이 기록</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">2. 수집 목적</h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-400">
            <li>회원 식별</li>
            <li>시즌 랭킹 운영</li>
            <li>부정 이용 방지</li>
            <li>이벤트 결과 안내</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">3. 보유 기간</h2>
          <p className="text-zinc-400">
            시즌 종료 후 3개월까지 보관하며, 그 전에 삭제 요청이 있을 경우
            요청 시점에 지체 없이 파기합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">4. 문의</h2>
          <p className="text-zinc-400">
            개인정보 관련 문의:{" "}
            <a
              href="mailto:ddoddony@naver.com"
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              ddoddony@naver.com
            </a>
          </p>
        </section>
      </div>

      <div className="text-center">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/40 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          회원가입으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
