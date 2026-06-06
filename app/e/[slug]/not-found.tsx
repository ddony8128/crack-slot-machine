import Link from "next/link";

export default function EventNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-black tracking-tight text-amber-300">
        존재하지 않는 이벤트입니다
      </h1>
      <p className="text-sm text-zinc-400">
        주소를 다시 확인해 주세요. 등록된 이벤트만 플레이할 수 있습니다.
      </p>
      <Link
        href="/e/total"
        className="rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400"
      >
        전체 랭킹 보드로 가기
      </Link>
    </main>
  );
}
