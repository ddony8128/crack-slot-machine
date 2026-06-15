import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "RULE SLOT | 개인정보 처리방침" };

export default function PrivacyPage() {
  return (
    <main className="fade-rise mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          RULE SLOT 개인정보 처리방침
        </h1>
        <p className="mt-3 inline-block rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">
          프리 시즌 1
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
        <p className="text-zinc-400">
          RULE SLOT은 프리 시즌 운영, 랭킹 기록, 이벤트 및 후원 확인을 위해
          최소한의 개인정보를 수집합니다.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">
            1. 수집하는 개인정보 항목
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-400">
            <li>필수: 닉네임, 비밀번호</li>
            <li>선택/필수 중 하나 이상: 이메일 또는 전화번호</li>
            <li>
              자동 수집: 게임 플레이 기록, 점수, 랭킹 기록, 접속 시각, 게스트 식별값
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">
            2. 개인정보의 수집 및 이용 목적
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-400">
            <li>회원 식별 및 로그인</li>
            <li>시즌 랭킹 운영</li>
            <li>게임 기록 저장 및 부정 이용 방지</li>
            <li>이벤트 참여 확인</li>
            <li>후원자 칭호 확인 및 부여</li>
            <li>문의 대응</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">
            3. 개인정보의 보유 및 이용 기간
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-400">
            <li>회원 탈퇴 시까지 보유합니다.</li>
            <li>
              단, 시즌 운영 및 부정 이용 방지를 위해 게임 기록은 시즌 종료 후
              일정 기간 보관될 수 있습니다.
            </li>
            <li>
              삭제 요청이 있을 경우 확인 후 가능한 범위에서 삭제 또는 익명화합니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">
            4. 개인정보의 제3자 제공
          </h2>
          <p className="text-zinc-400">
            RULE SLOT은 이용자의 개인정보를 외부에 판매하거나 제공하지 않습니다.
            단, 법령에 따라 요청이 있는 경우에는 예외로 합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">5. 개인정보 처리 위탁</h2>
          <p className="text-zinc-400">
            서비스 운영을 위해 Supabase, Vercel 등 외부 서비스를 사용할 수 있습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">6. 이용자의 권리</h2>
          <p className="text-zinc-400">
            이용자는 개인정보 열람, 수정, 삭제, 탈퇴를 요청할 수 있습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-100">7. 문의</h2>
          <p className="text-zinc-400">
            개인정보 관련 문의는 아래 이메일로 연락해주세요.{" "}
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
