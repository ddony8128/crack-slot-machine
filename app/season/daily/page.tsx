import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/server/playerAuth";
import { getDb } from "@/lib/db";
import { settleDueDailyChallenges } from "@/lib/server/dailySettlement";
import DailyClient from "@/components/DailyClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RULE SLOT | 데일리 챌린지",
};

export default async function DailyPage() {
  const player = await currentPlayer();
  if (!player) redirect("/login");

  // Settle any ended daily windows so yesterday's rank rewards are persisted.
  const season = await getDb().getActiveSeason();
  if (season) {
    await settleDueDailyChallenges(getDb(), season.id, new Date().toISOString());
  }

  return <DailyClient />;
}
