import type { AchievementKey, CreditReason } from "@/types";

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

/** Human-readable Korean labels for each credit award reason. */
export const CREDIT_LABELS: Record<CreditReason, string> = {
  first_play: "첫 플레이 완료",
  score_2000: "2000점 최초 돌파",
  score_5000: "5000점 최초 돌파",
  score_10000: "10000점 최초 돌파",
  all_achievements: "모든 업적 달성",
};
