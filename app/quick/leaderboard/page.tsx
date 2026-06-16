import type { Metadata } from "next";
import QuickLeaderboard from "@/components/QuickLeaderboard";

export const metadata: Metadata = { title: "RULE SLOT | 빠른 게임 랭킹" };

// Fast-game ranking view. Renders a client component that fetches
// GET /api/quick/leaderboard (no auth — guests can view too).
export default function QuickLeaderboardPage() {
  return <QuickLeaderboard />;
}
