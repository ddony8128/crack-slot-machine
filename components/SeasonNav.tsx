import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPlayer, clearPlayerCookie } from "@/lib/server/playerAuth";

/** Header shown on every Season 1 page: brand, nav links, and login state. */
export default async function SeasonNav() {
  const player = await currentPlayer();

  // Logout via a server action: clears the session cookie, then redirects so
  // the freshly-rendered tree reflects the logged-out state.
  async function logout() {
    "use server";
    await clearPlayerCookie();
    redirect("/season");
  }

  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/season" className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-lg font-black tracking-tight">
            <span className="text-emerald-400">RULE</span>{" "}
            <span className="text-amber-300">SLOT</span>
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-xs font-semibold text-zinc-300">
            Season 1
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-semibold text-zinc-300">
          <Link
            href="/season"
            className="rounded-lg px-2.5 py-1.5 transition hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            홈
          </Link>
          <Link
            href="/season/leaderboard"
            className="rounded-lg px-2.5 py-1.5 transition hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            시즌 랭킹
          </Link>
          <Link
            href="/me"
            className="rounded-lg px-2.5 py-1.5 transition hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            내 기록
          </Link>
          {player && (
            <Link
              href="/me/settings"
              className="rounded-lg px-2.5 py-1.5 transition hover:bg-zinc-800/60 hover:text-zinc-100"
            >
              계정 설정
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          {player ? (
            <>
              <span className="max-w-[10rem] truncate font-semibold text-emerald-300">
                {player.nickname}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 font-semibold text-zinc-300 transition hover:bg-zinc-800/60 hover:text-zinc-100"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-zinc-950 transition hover:bg-emerald-400"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
