import type { Rule, RulePhase } from '@/types';
import { PAIR_RULES } from '@/lib/pairRules';

// Player-facing labels for each trigger-timing phase (the "발동 시점" badge).
export const RULE_PHASE_LABELS: Record<RulePhase, string> = {
  'pre-spin': '스핀 이전',
  sequential: '순서 적용',
  scoring: '점수 계산',
  'next-spin': '다음 스핀',
};

export const RULES: Rule[] = [
  // ---- 7 / jackpot ----
  {
    id: 'seven-fever',
    name: 'SEVEN FEVER',
    type: 'weight',
    phase: 'pre-spin',
    build: '7',
    description: '7이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'seven-double',
    name: 'SEVEN DOUBLE',
    type: 'score',
    phase: 'scoring',
    build: '7',
    description: '이번 스핀에서 7로 얻는 점수가 두 배가 된다.',
  },
  {
    id: 'zero-to-seven',
    name: 'ZERO ASCEND',
    type: 'transform',
    phase: 'sequential',
    build: '7',
    description: '모든 0이 7로 바뀐다.',
  },
  {
    id: 'number-spin',
    name: 'NUMBER SPIN',
    type: 'weight',
    phase: 'pre-spin',
    build: '7',
    description: '직전 결과가 숫자였던 칸은 첫 굴림에서 다시 숫자가 나온다.',
  },

  // ---- fruit ----
  {
    id: 'fruit-surge',
    name: 'FRUIT SURGE',
    type: 'weight',
    phase: 'pre-spin',
    build: 'fruit',
    description: '과일이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'diamond-cut',
    name: 'DIAMOND CUT',
    type: 'weight',
    phase: 'pre-spin',
    build: 'fruit',
    description: '다이아몬드와 사파이어가 나오지 않는다.',
  },
  {
    id: 'fruit-fish',
    name: 'FRUIT FISH',
    type: 'reroll',
    phase: 'sequential',
    build: 'fruit',
    description: '가장 왼쪽의 과일이 아닌 칸을 과일이 나올 때까지 다시 굴린다.',
  },

  // ---- gem ----
  {
    id: 'gem-surge',
    name: 'GEM SURGE',
    type: 'weight',
    phase: 'pre-spin',
    build: 'gem',
    description: '보석이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'fruit-freeze',
    name: 'FRUIT FREEZE',
    type: 'lock',
    phase: 'pre-spin',
    build: 'order',
    description: '이전 결과에서 가장 왼쪽 과일 두 개가 유지된다. (첫 굴림에서만 — 이후 규칙으로 바뀔 수 있다)',
  },
  {
    id: 'gem-fish',
    name: 'GEM FISH',
    type: 'reroll',
    phase: 'sequential',
    build: 'gem',
    description: '가장 왼쪽의 보석이 아닌 칸을 보석이 나올 때까지 다시 굴린다.',
  },

  // ---- color ----
  {
    id: 'first-cherry',
    name: 'FIRST CHERRY',
    type: 'transform',
    phase: 'sequential',
    build: 'color',
    description: '첫 번째 칸이 체리가 된다.',
  },
  {
    id: 'red-dye',
    name: 'RED DYE',
    type: 'transform',
    phase: 'sequential',
    build: 'color',
    description: '레몬과 다이아몬드가 체리로 바뀐다.',
  },
  {
    id: 'blue-dye',
    name: 'BLUE DYE',
    type: 'transform',
    phase: 'sequential',
    build: 'color',
    description: '레몬과 다이아몬드가 사파이어로 바뀐다.',
  },

  // ---- order ----
  {
    id: 'center-lock',
    name: 'CENTER LOCK',
    type: 'lock',
    phase: 'pre-spin',
    build: 'order',
    description: '세 번째 칸이 이전 스핀의 값을 유지한다. (첫 굴림에서만 — 이후 규칙으로 바뀔 수 있다)',
  },
  {
    id: 'last-lock',
    name: 'LAST LOCK',
    type: 'lock',
    phase: 'pre-spin',
    build: 'order',
    description: '마지막 칸이 이전 스핀의 값을 유지한다. (첫 굴림에서만 — 이후 규칙으로 바뀔 수 있다)',
  },
  {
    id: 'left-pair',
    name: 'LEFT PAIR',
    type: 'transform',
    phase: 'sequential',
    build: 'order',
    description: '두 번째 칸이 첫 번째 칸과 같아진다.',
  },
  {
    id: 'center-echo',
    name: 'CENTER ECHO',
    type: 'transform',
    phase: 'sequential',
    build: 'order',
    description: '네 번째 칸이 두 번째 칸과 같아진다.',
  },
  {
    id: 'third-mirror',
    name: 'THIRD MIRROR',
    type: 'transform',
    phase: 'sequential',
    build: 'order',
    description: '세 번째 칸이 다섯 번째 칸과 같아진다.',
  },
  {
    id: 'copy-above',
    name: 'COPY ABOVE',
    type: 'meta',
    phase: 'sequential',
    build: 'order',
    description: '바로 위 칸의 규칙을 한 번 더 적용한다.',
  },
  {
    id: 'select-copy',
    name: 'SELECT COPY',
    type: 'select',
    phase: 'sequential',
    build: 'order',
    description: '직접 고른 칸이 바로 왼쪽 칸과 같아진다.',
  },
  {
    id: 'select-swap',
    name: 'SELECT SWAP',
    type: 'select',
    phase: 'sequential',
    build: 'order',
    description: '직접 고른 두 칸이 서로 교체된다.',
  },
  {
    id: 'select-reroll',
    name: 'SELECT REROLL',
    type: 'select',
    phase: 'sequential',
    build: 'order',
    description: '직접 고른 한 칸을 다시 굴린다.',
  },

  // ---- cat ----
  {
    id: 'cat-hold',
    name: '식빵 굽기',
    type: 'lock',
    phase: 'pre-spin',
    build: 'cat',
    description: '이전 결과가 고양이였던 칸은 첫 굴림에서 유지된다. (이후 규칙으로 바뀔 수 있다)',
  },
  {
    id: 'cat-zoomies',
    name: '우다다다',
    type: 'transform',
    phase: 'sequential',
    build: 'cat',
    description: '가장 오른쪽의 고양이가 1번 칸으로 이동하고, 그 사이의 심볼들은 오른쪽으로 한 칸씩 밀린다.',
  },
  {
    id: 'cat-jump',
    name: '점프의 달인',
    type: 'transform',
    phase: 'sequential',
    build: 'cat',
    description: '가장 왼쪽의 고양이가 두 칸 오른쪽 또는 두 칸 왼쪽 칸과 자리를 바꾼다. (가능한 방향 중 무작위)',
  },

  // ---- vehicle ----
  {
    id: 'vehicle-parking',
    name: '유료 주차',
    type: 'transform',
    phase: 'next-spin',
    build: 'vehicle',
    description: '교통수단 칸마다 30점을 잃고, 그 칸들은 다음 스핀 첫 굴림에서 유지된다. (유지된 칸은 이후 규칙으로 바뀔 수 있다)',
  },
  {
    id: 'vehicle-surge',
    name: '러시아워',
    type: 'weight',
    phase: 'pre-spin',
    build: 'vehicle',
    description: '교통수단이 나올 확률이 (장착한 규칙 수 + 1)배가 된다.',
  },
  {
    id: 'vehicle-logistics',
    name: '물류 사업',
    type: 'transform',
    phase: 'sequential',
    build: 'vehicle',
    description: '비행기 수만큼 무작위로 두 칸을 교체한다.',
  },
  {
    id: 'vehicle-bigboat',
    name: '배 크다',
    type: 'transform',
    phase: 'sequential',
    build: 'vehicle',
    description: '가장 왼쪽 배의 양옆 칸이 그 배 심볼을 복사한다.',
  },

  // ---- monster ----
  {
    id: 'monster-haunt',
    name: '유령 들림',
    type: 'transform',
    phase: 'sequential',
    build: 'monster',
    description: '가장 왼쪽 괴물 칸이 유령 들린다. (이번 스핀의 족보 계산에서 유령 1개로 추가 계산)',
  },
  {
    id: 'monster-family',
    name: '가족 만들기',
    type: 'transform',
    phase: 'sequential',
    build: 'monster',
    description: '가장 왼쪽 드라큘라를 가장 왼쪽의 드라큘라가 아닌 칸에 복사한다.',
  },

  // ---- safe ----
  {
    id: 'no-zero',
    name: 'NO ZERO',
    type: 'weight',
    phase: 'pre-spin',
    build: 'safe',
    description: '0이 절대 나오지 않는다.',
  },
  {
    id: 'four-shield',
    name: 'FOUR SHIELD',
    type: 'reroll',
    phase: 'sequential',
    build: 'safe',
    description: '나온 4를 모두 다시 굴리고, 이번 스핀에는 0이 나올 확률이 두 배가 된다.',
  },
  {
    id: 'four-parry',
    name: 'FOUR PARRY',
    type: 'reroll',
    phase: 'sequential',
    build: 'safe',
    description: '가장 왼쪽의 4를 4가 아닌 것이 나올 때까지 다시 굴린다.',
  },
  {
    id: 'safe-convert',
    name: 'SAFE CONVERT',
    type: 'transform',
    phase: 'sequential',
    build: 'safe',
    description: '모든 0과 4가 루비로 바뀐다.',
  },
  {
    id: 'gem-shuffle',
    name: 'GEM SHUFFLE',
    type: 'reroll',
    phase: 'sequential',
    build: 'safe',
    description: '가장 왼쪽의 보석을 보석이 아닌 것이 나올 때까지 다시 굴린다.',
  },

  // ---- score ----
  {
    id: 'bonus-77',
    name: 'LUCKY SEVEN-SEVEN',
    type: 'score',
    phase: 'scoring',
    build: 'score',
    description: '점수를 77점 더 얻는다.',
  },
  {
    id: 'clean-bonus',
    name: 'CLEAN SWEEP',
    type: 'score',
    phase: 'sequential',
    build: 'score',
    description: '이 규칙이 적용되는 시점의 보드에 4가 하나도 없으면 120점을 더 얻는다. (이후 규칙으로 4가 생겨도 보너스 유지)',
  },
  {
    id: 'four-fortune',
    name: 'FOUR FORTUNE',
    type: 'score',
    phase: 'scoring',
    build: 'score',
    description: '4가 나올 확률이 네 배가 되고, 이번 스핀에서 4는 감점 대신 개당 +20점이 된다.',
  },

  // ---- pair (A–B conditional bonus; DATA in lib/pairRules.ts) ----
  ...PAIR_RULES.map((p) => ({
    id: p.id,
    name: p.name,
    type: 'score' as const,
    phase: 'scoring' as const,
    build: 'pair',
    description: p.description,
  })),
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
);
