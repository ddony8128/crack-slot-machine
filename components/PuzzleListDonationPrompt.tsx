"use client";

import DonationModal from "@/components/DonationModal";
import { useDonationPrompt } from "@/components/useDonationPrompt";

/**
 * Fires the 후원 안내 once when the player has cleared every puzzle. Rendered by
 * the (server) puzzle list page, which computes the cleared count per request.
 * Supporter status is passed in so the prompt is skipped for supporters.
 */
export default function PuzzleListDonationPrompt({
  clearedCount,
  total,
  isSupporter,
}: {
  clearedCount: number;
  total: number;
  isSupporter: boolean;
}) {
  const donation = useDonationPrompt({
    when: total > 0 && clearedCount >= total,
    storageKey: "all-puzzles-cleared",
    isSupporter,
  });
  return <DonationModal open={donation.open} onClose={donation.close} />;
}
