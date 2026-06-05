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
    description: '시작할 때 숫자였던 칸은 릴을 돌려도 숫자가 된다.',
  },

  // ---- fruit ----
  {
    id: 'fruit-surge',
    name: 'FRUIT SURGE',
    type: 'weight',
    build: 'fruit',
    description: '과일이 나올 확률이 두 배가 된다.',
  },
  {
    id: 'diamond-to-lemon',
    name: 'DIAMOND CUT',
    type: 'transform',
    build: 'fruit',
    description: '모든 다이아몬드가 레몬으로 바뀐다.',
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
    description: '보석이 나올 확률이 두 배가 된다.',
  },
  {
    id: 'grape-to-sapphire',
    name: 'GRAPE FREEZE',
    type: 'transform',
    build: 'gem',
    description: '모든 포도가 사파이어로 바뀐다.',
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
    description: '모든 루비가 체리로 바뀐다.',
  },
  {
    id: 'blue-dye',
    name: 'BLUE DYE',
    type: 'transform',
    build: 'color',
    description: '모든 다이아몬드가 사파이어로 바뀐다.',
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
    description: '가장 왼쪽의 4 하나를 다시 굴린다.',
  },
  {
    id: 'safe-convert',
    name: 'SAFE CONVERT',
    type: 'transform',
    build: 'safe',
    description: '가장 왼쪽의 4가 루비로 바뀐다.',
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
    description: '보드에 4가 하나도 없으면 100점을 더 얻는다.',
  },
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
);
