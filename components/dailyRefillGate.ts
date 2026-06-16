import type { DailyCurrent } from "@/lib/client/dailyApi";

/**
 * §8 ad-refill CTA gating. The "광고를 보고 5회 추가 충전" prompt should surface
 * only AFTER the 5 base attempts are spent — while base plays remain, the refill
 * must not compete with the start button. Until the one-time refill is used,
 * `allowed` is the base 5, so `attemptsLeft <= 0` here means the base attempts
 * are exhausted.
 */
export type RefillGate = {
  /** Show the prominent "충전" button (refill available AND base exhausted). */
  showRefillCta: boolean;
  /** Refill exists but is held back because base attempts still remain. */
  refillAvailableButHeld: boolean;
};

export function dailyRefillGate(current: DailyCurrent | null): RefillGate {
  if (!current || !current.loggedIn || current.canRefill !== true) {
    return { showRefillCta: false, refillAvailableButHeld: false };
  }
  const baseExhausted = current.attemptsLeft <= 0;
  return {
    showRefillCta: baseExhausted,
    refillAvailableButHeld: !baseExhausted,
  };
}
