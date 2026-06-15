/** Season 1 첨탑 오르기 (Spire) definitions (scaffolding). Stage targets + reward
 *  and artifact catalogs are code-driven; run/reward resolution is a follow-up. */

export const SPIRE_STAGE_COUNT = 10;
/** v0: each stage runs at most this many spins; reaching the target clears early. */
export const SPIRE_SPINS_PER_STAGE = 7;

export type SpireStage = { index: number; targetScore: number };

export const SPIRE_STAGES: SpireStage[] = [
  { index: 1, targetScore: 500 },
  { index: 2, targetScore: 1000 },
  { index: 3, targetScore: 2000 },
  { index: 4, targetScore: 4000 },
  { index: 5, targetScore: 6000 },
  { index: 6, targetScore: 8000 },
  { index: 7, targetScore: 10000 },
  { index: 8, targetScore: 12000 },
  { index: 9, targetScore: 15000 },
  { index: 10, targetScore: 20000 },
];

// ---- v0 economy (docs/SPIRE_V0_PLAN.md) ----

export const SPIRE_START_MONEY = 0;
export const SPIRE_MAX_FAILURES = 3;       // 3rd failure ends the run
export const SPIRE_BAG_TOTAL = 20;         // symbol bag is ALWAYS this total
export const SPIRE_RULE_POOL_MAX = 10;     // rule pool cap (remove-on-overflow)

export const SPIRE_SPIN_BONUS_PER = 2;     // +money per UNUSED spin on clear
export const SPIRE_INTEREST_DIVISOR = 5;   // interest = floor(balance / this)
export const SPIRE_FAIL_SUPPORT = 5;       // money granted on a non-final failure

// Stage clear payout: st1–3 = 4, st4–6 = 6, st7–9 = 8, st10 = 0 (final, no shop).
export const SPIRE_CLEAR_PAYOUT: Record<number, number> = {
  1: 4, 2: 4, 3: 4,
  4: 6, 5: 6, 6: 6,
  7: 8, 8: 8, 9: 8,
  10: 0,
};

// Stages whose clear triggers an artifact choice.
export const SPIRE_ARTIFACT_STAGES = [3, 6, 9];

// The 8 base rules every spire run starts with (before the chosen-set's 2 rules).
export const SPIRE_BASE_RULE_IDS: string[] = [
  'center-lock',
  'last-lock',
  'seven-fever',
  'four-shield',
  'seven-double',
  'select-swap',
  'select-reroll',
  'select-copy',
];

// ---- shop prices ----
export const SPIRE_ARTIFACT_PRICES = [6, 5, 4] as const; // slots 1..3
export const SPIRE_SET_PRICE = 3;
export const SPIRE_RULE_PRICE = 1;
export const SPIRE_HAND_FLAT_PRICE = 1;
export const SPIRE_HAND_FLAT_BONUS = 50;  // +this per flat upgrade
export const SPIRE_HAND_DOUBLE_PRICE = 3; // ×2 per double upgrade
export const SPIRE_REROLL_PRICE = 1;

/** Stage clear payout (0 if out of range / final stage). */
export function spireClearPayout(stage: number): number {
  return SPIRE_CLEAR_PAYOUT[stage] ?? 0;
}

/** Interest granted on clear, computed from the PRE-payout balance. */
export function spireInterest(balance: number): number {
  return Math.floor(Math.max(0, balance) / SPIRE_INTEREST_DIVISOR);
}

/** Remaining-spin bonus on clear (+SPIRE_SPIN_BONUS_PER per unused spin). */
export function spireSpinBonus(remainingSpins: number): number {
  return Math.max(0, remainingSpins) * SPIRE_SPIN_BONUS_PER;
}

/** Price to add +1 of a symbol = its CURRENT count in the bag (escalating). */
export function spireBuySymbolPrice(currentCount: number): number {
  return Math.max(0, currentCount);
}

export type SpireRewardType = 'add-rule' | 'remove-rule' | 'adjust-bag' | 'artifact';

export const SPIRE_REWARD_TYPES: { type: SpireRewardType; label: string; description: string }[] = [
  { type: 'add-rule', label: '규칙 추가', description: '사용 가능한 규칙 풀에 새 규칙 1개를 추가합니다.' },
  { type: 'remove-rule', label: '규칙 제거', description: '규칙 풀에서 원하지 않는 규칙 1개를 제거합니다.' },
  { type: 'adjust-bag', label: '심볼 주머니 조정', description: '특정 심볼 확률 +2, 다른 심볼 확률 -2.' },
  { type: 'artifact', label: '아티팩트 획득', description: '런 전체에 적용되는 패시브 효과를 얻습니다.' },
];

export type SpireArtifact = { id: string; name: string; effect: string };

export const SPIRE_ARTIFACTS: SpireArtifact[] = [
  { id: 'lucky_start', name: '행운의 시작', effect: '각 스테이지 첫 스핀에서 7 확률 +50%' },
  { id: 'four_insurance', name: '4 보험', effect: '각 스테이지 첫 번째 4 페널티 무시' },
  { id: 'zero_coupon', name: '0 쿠폰', effect: '0이 3개 이상 나올 때 얻는 추가 규칙 선택 +1' },
  { id: 'final_push', name: '마지막 레버', effect: '각 스테이지 마지막 스핀 점수 1.5배' },
  { id: 'stable_hand', name: '안정된 손', effect: '스테이지 시작 시 랜덤 규칙 슬롯 1개 유지' },
];

/**
 * Spec base starting symbol bag (counts) for a spire run: NUMBER set only.
 * Season 1 §16 — 0×12, 4×5, 7×3 (total 20). The pre-stage-1 set choice removes
 * 3 zeros (→ 0×9) and adds the chosen set's 3 symbols ×1 (see lib/spire/run.ts).
 */
export const SPIRE_START_BAG: Record<string, number> = {
  zero: 12,
  four: 5,
  seven: 3,
};
