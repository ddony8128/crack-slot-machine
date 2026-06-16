import { redirect } from "next/navigation";
import Link from "next/link";
import { currentPlayer } from "@/lib/server/playerAuth";

// First screen (spec §1.1): guests see the 3-button onboarding; logged-in
// players skip straight to the season hub. Reads the cookie → render per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (await currentPlayer()) redirect("/season");

  return (
    <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <header>
        <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
          <span className="text-emerald-400">RULE</span>{" "}
          <span className="text-amber-300">SLOT</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          규칙을 골라 배치하는 슬롯 게임 · 프리 시즌 1
        </p>
      </header>

      <div className="flex w-full flex-col gap-3">
        <Link
          href="/quick"
          className="w-full rounded-xl bg-emerald-500 px-6 py-3.5 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          게스트로 게임 시작
        </Link>
        <Link
          href="/login"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-3.5 text-base font-semibold text-zinc-100 transition hover:bg-zinc-800/60"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-3.5 text-base font-semibold text-zinc-100 transition hover:bg-zinc-800/60"
        >
          회원가입
        </Link>
      </div>

      <p className="text-xs text-zinc-500">
        게스트는 빠른 게임만 가능하며, 기록은 빠른 게임 랭킹에만 반영됩니다.
        <br />
        시즌 랭킹(일일·퍼즐·첨탑)은 로그인 후 참여할 수 있습니다.
      </p>

      <Link href="/season" className="text-sm text-zinc-400 underline underline-offset-2">
        시즌 랭킹 둘러보기 →
      </Link>
    </main>
  );
}
