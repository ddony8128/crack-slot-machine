/** Season 1 첨탑 오르기 (Spire) definitions (scaffolding). Stage targets + reward
 *  and artifact catalogs are code-driven; run/reward resolution is a follow-up. */

export const SPIRE_STAGE_COUNT = 10;
export const SPIRE_SPINS_PER_STAGE = 5;

export type SpireStage = { index: number; targetScore: number };

export const SPIRE_STAGES: SpireStage[] = [
  { index: 1, targetScore: 300 },
  { index: 2, targetScore: 600 },
  { index: 3, targetScore: 900 },
  { index: 4, targetScore: 1300 },
  { index: 5, targetScore: 1800 },
  { index: 6, targetScore: 2400 },
  { index: 7, targetScore: 3100 },
  { index: 8, targetScore: 4000 },
  { index: 9, targetScore: 5200 },
  { index: 10, targetScore: 6500 },
];

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

/** Default starting symbol bag (counts) for a spire run. */
export const SPIRE_START_BAG: Record<string, number> = {
  zero: 6,
  four: 4,
  seven: 3,
  // groupA ×2 each, groupB ×2 each → filled in by the run setup (legacy fruit/gem for now).
};
