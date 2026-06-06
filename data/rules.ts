import type { Rule } from '@/types';

export const RULES: Rule[] = [
  // ---- 7 / jackpot ----
  {
    id: 'seven-fever',
    name: 'SEVEN FEVER',
    type: 'weight',
    build: '7',
    description: '7이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'seven-double',
    name: 'SEVEN DOUBLE',
    type: 'score',
    build: '7',
    description: '이번 스핀에서 7로 얻는 점수가 두 배가 된다.',
  },
  {
    id: 'zero-to-seven',
    name: 'ZERO ASCEND',
    type: 'transform',
    build: '7',
    description: '모든 0이 7로 바뀐다.',
  },
  {
    id: 'number-spin',
    name: 'NUMBER SPIN',
    type: 'weight',
    build: '7',
    description:
      '직전 결과가 숫자(7·0·4)였던 칸은 첫 굴림에서 다시 숫자가 나온다.',
  },

  // ---- fruit ----
  {
    id: 'fruit-surge',
    name: 'FRUIT SURGE',
    type: 'weight',
    build: 'fruit',
    description: '과일이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'diamond-cut',
    name: 'DIAMOND CUT',
    type: 'weight',
    build: 'fruit',
    description: '다이아몬드와 사파이어가 나오지 않는다.',
  },
  {
    id: 'fruit-fish',
    name: 'FRUIT FISH',
    type: 'reroll',
    build: 'fruit',
    description: '가장 왼쪽의 과일이 아닌 칸을 과일이 나올 때까지 다시 굴린다.',
  },

  // ---- gem ----
  {
    id: 'gem-surge',
    name: 'GEM SURGE',
    type: 'weight',
    build: 'gem',
    description: '보석이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'fruit-freeze',
    name: 'FRUIT FREEZE',
    type: 'lock',
    build: 'order',
    description: '이전 결과에서 가장 왼쪽 과일 두 개가 유지된다.',
  },
  {
    id: 'gem-fish',
    name: 'GEM FISH',
    type: 'reroll',
    build: 'gem',
    description: '가장 왼쪽의 보석이 아닌 칸을 보석이 나올 때까지 다시 굴린다.',
  },

  // ---- color ----
  {
    id: 'first-cherry',
    name: 'FIRST CHERRY',
    type: 'transform',
    build: 'color',
    description: '첫 번째 칸이 체리가 된다.',
  },
  {
    id: 'red-dye',
    name: 'RED DYE',
    type: 'transform',
    build: 'color',
    description: '레몬과 다이아몬드가 체리로 바뀐다.',
  },
  {
    id: 'blue-dye',
    name: 'BLUE DYE',
    type: 'transform',
    build: 'color',
    description: '레몬과 다이아몬드가 사파이어로 바뀐다.',
  },

  // ---- order ----
  {
    id: 'center-lock',
    name: 'CENTER LOCK',
    type: 'lock',
    build: 'order',
    description: '세 번째 칸이 이전 스핀의 값으로 고정되어 돌지 않는다.',
  },
  {
    id: 'last-lock',
    name: 'LAST LOCK',
    type: 'lock',
    build: 'order',
    description: '마지막 칸이 이전 스핀의 값으로 고정되어 돌지 않는다.',
  },
  {
    id: 'left-pair',
    name: 'LEFT PAIR',
    type: 'transform',
    build: 'order',
    description: '두 번째 칸이 첫 번째 칸과 같아진다.',
  },
  {
    id: 'center-echo',
    name: 'CENTER ECHO',
    type: 'transform',
    build: 'order',
    description: '네 번째 칸이 두 번째 칸과 같아진다.',
  },
  {
    id: 'third-mirror',
    name: 'THIRD MIRROR',
    type: 'transform',
    build: 'order',
    description: '세 번째 칸이 다섯 번째 칸과 같아진다.',
  },
  {
    id: 'copy-above',
    name: 'COPY ABOVE',
    type: 'meta',
    build: 'order',
    description: '바로 위 칸의 규칙을 한 번 더 적용한다.',
  },
  {
    id: 'select-copy',
    name: 'SELECT COPY',
    type: 'select',
    build: 'order',
    description: '직접 고른 칸이 바로 왼쪽 칸과 같아진다.',
  },
  {
    id: 'select-swap',
    name: 'SELECT SWAP',
    type: 'select',
    build: 'order',
    description: '직접 고른 두 칸이 서로 교체된다.',
  },
  {
    id: 'select-reroll',
    name: 'SELECT REROLL',
    type: 'select',
    build: 'order',
    description: '직접 고른 한 칸을 다시 굴린다.',
  },

  // ---- safe ----
  {
    id: 'no-zero',
    name: 'NO ZERO',
    type: 'weight',
    build: 'safe',
    description: '0이 절대 나오지 않는다.',
  },
  {
    id: 'four-shield',
    name: 'FOUR SHIELD',
    type: 'reroll',
    build: 'safe',
    description: '나온 4를 모두 다시 굴리고, 이번 스핀에는 0이 나올 확률이 두 배가 된다.',
  },
  {
    id: 'four-parry',
    name: 'FOUR PARRY',
    type: 'reroll',
    build: 'safe',
    description: '가장 왼쪽의 4를 4가 아닌 것이 나올 때까지 다시 굴린다.',
  },
  {
    id: 'safe-convert',
    name: 'SAFE CONVERT',
    type: 'transform',
    build: 'safe',
    description: '모든 0과 4가 루비로 바뀐다.',
  },
  {
    id: 'gem-shuffle',
    name: 'GEM SHUFFLE',
    type: 'reroll',
    build: 'safe',
    description: '가장 왼쪽의 보석을 보석이 아닌 것이 나올 때까지 다시 굴린다.',
  },

  // ---- score ----
  {
    id: 'bonus-77',
    name: 'LUCKY SEVEN-SEVEN',
    type: 'score',
    build: 'score',
    description: '점수를 77점 더 얻는다.',
  },
  {
    id: 'clean-bonus',
    name: 'CLEAN SWEEP',
    type: 'score',
    build: 'score',
    description: '보드에 4가 하나도 없으면 120점을 더 얻는다.',
  },
  {
    id: 'four-fortune',
    name: 'FOUR FORTUNE',
    type: 'score',
    build: 'score',
    description: '4가 나올 확률이 네 배가 되고, 4 하나당 +20점이 된다.',
  },
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
);
