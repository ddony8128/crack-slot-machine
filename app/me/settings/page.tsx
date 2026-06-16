import Link from "next/link";
import { redirect } from "next/navigation";
import SeasonNav from "@/components/SeasonNav";
import { currentPlayer } from "@/lib/server/playerAuth";
import AccountSettings from "./AccountSettings";

export default async function SettingsPage() {
  const player = await currentPlayer();
  if (!player) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <SeasonNav />

      <main className="fade-rise mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            설정
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">계정 관리</h1>
        </header>

        <AccountSettings
          nickname={player.nickname}
          contactType={player.contactType}
          contactValue={player.contactValue}
        />

        <Link
          href="/me"
          className="text-center text-sm text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
        >
          내 기록으로 돌아가기
        </Link>
      </main>
    </div>
  );
}
