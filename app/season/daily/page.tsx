import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import DailyClient from "@/components/DailyClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RULE SLOT | 데일리 챌린지",
};

export default async function DailyPage() {
  const player = await currentPlayer();
  if (!player) redirect("/login");

  return <DailyClient />;
}
