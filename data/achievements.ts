import type { AchievementKey } from "@/types";

/**
 * Static display metadata for each achievement (BLACKHAVEN event).
 * Conditions are detected server-side per finished run; this is reference text
 * for the start-screen achievements list and the result-screen unlock callout.
 */
export const ACHIEVEMENT_META: Record<
  AchievementKey,
  { title: string; condition: string; image: string }
> = {
  frankenstein: {
    title: "프랑켄슈타인의 재림",
    condition: "신체 3종 보너스를 달성하세요.",
    image: "/achievements/frankenstein.webp",
  },
  hyakki: {
    title: "백귀야행",
    condition: "괴물 3종 보너스를 달성하세요.",
    image: "/achievements/hyakki.webp",
  },
  midas: {
    title: "대가는 무엇인가",
    condition: "77777을 달성하세요.",
    image: "/achievements/midas.webp",
  },
  familiar_death: {
    title: "친숙한 죽음",
    condition: "44444를 달성하세요.",
    image: "/achievements/graveyard.webp",
  },
};
