import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import SpireClient from "@/components/SpireClient";

export const metadata: Metadata = { title: "RULE SLOT | 첨탑 오르기" };
export const dynamic = "force-dynamic";

export default async function SpirePage() {
  if (!(await currentPlayer())) redirect("/login");
  return <SpireClient />;
}
