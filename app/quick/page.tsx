import type { Metadata } from "next";
import Link from "next/link";
import QuickClient from "@/components/QuickClient";

export const metadata: Metadata = { title: "RULE SLOT | 빠른 게임" };

// Quick play needs no login and no DB read — it is a fully local run.
export default function QuickPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <Link
          href="/season"
          className="text-sm font-semibold text-zinc-400 transition hover:text-zinc-200"
        >
          ← 시즌으로
        </Link>
      </div>
      <QuickClient />
    </>
  );
}
