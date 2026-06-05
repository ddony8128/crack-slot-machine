import type { Rule } from '@/types';

export const RULES: Rule[] = [
  // ---- 7 / jackpot ----
  {
    id: 'seven-fever',
    name: 'SEVEN FEVER',
    type: 'weight',
    build: '7',
    description: '7 확률 ×3 — 7을 더 자주 띄운다',
  },
  {
    id: 'seven-double',
    name: 'SEVEN DOUBLE',
    type: 'score',
    build: '7',
    description: '이번 스핀 7 점수 ×2',
  },
  {
    id: 'zero-to-seven',
    name: 'ZERO ASCEND',
    type: 'transform',
    build: '7',
    description: '0 → 7 (모든 0이 7로 바뀐다)',
  },
  {
    id: 'number-spin',
    name: 'NUMBER SPIN',
    type: 'transform',
    build: '7',
    description: '숫자였던 칸(7/0/4)은 다시 숫자로 정해진다 (7/0/4 중)',
  },

  // ---- fruit ----
  {
    id: 'fruit-surge',
    name: 'FRUIT SURGE',
    type: 'weight',
    build: 'fruit',
    description: '과일 확률 ×2',
  },
  {
    id: 'diamond-to-lemon',
    name: 'DIAMOND CUT',
    type: 'transform',
    build: 'fruit',
    description: '💎 → 🍋 (모든 다이아몬드가 레몬으로 바뀐다)',
  },
  {
    id: 'fruit-fish',
    name: 'FRUIT FISH',
    type: 'reroll',
    build: 'fruit',
    description: '가장 왼쪽의 숫자 또는 보석 1칸을 다시 굴린다',
  },

  // ---- gem ----
  {
    id: 'gem-surge',
    name: 'GEM SURGE',
    type: 'weight',
    build: 'gem',
    description: '보석 확률 ×2',
  },
  {
    id: 'grape-to-sapphire',
    name: 'GRAPE FREEZE',
    type: 'transform',
    build: 'gem',
    description: '🍇 → 🔵 (모든 포도가 사파이어로 바뀐다)',
  },
  {
    id: 'gem-fish',
    name: 'GEM FISH',
    type: 'reroll',
    build: 'gem',
    description: '가장 왼쪽의 숫자 또는 과일 1칸을 다시 굴린다',
  },

  // ---- color ----
  {
    id: 'first-cherry',
    name: 'FIRST CHERRY',
    type: 'transform',
    build: 'color',
    description: '1번 칸 → 🍒 (1번 칸이 체리가 된다)',
  },
  {
    id: 'red-dye',
    name: 'RED DYE',
    type: 'transform',
    build: 'color',
    description: '🔴 → 🍒 (모든 루비가 체리로 바뀐다)',
  },
  {
    id: 'blue-dye',
    name: 'BLUE DYE',
    type: 'transform',
    build: 'color',
    description: '💎 → 🔵 (모든 다이아몬드가 사파이어로 바뀐다)',
  },

  // ---- order ----
  {
    id: 'center-lock',
    name: 'CENTER LOCK',
    type: 'lock',
    build: 'order',
    description: '3번 칸은 이전 스핀 값을 유지',
  },
  {
    id: 'last-lock',
    name: 'LAST LOCK',
    type: 'lock',
    build: 'order',
    description: '5번 칸은 이전 스핀 값을 유지',
  },
  {
    id: 'left-pair',
    name: 'LEFT PAIR',
    type: 'transform',
    build: 'order',
    description: '2번 칸 ← 1번 칸 (2번 칸이 1번 칸과 같아진다)',
  },
  {
    id: 'center-echo',
    name: 'CENTER ECHO',
    type: 'transform',
    build: 'order',
    description: '4번 칸 ← 2번 칸 (4번 칸이 2번 칸과 같아진다)',
  },
  {
    id: 'third-mirror',
    name: 'THIRD MIRROR',
    type: 'transform',
    build: 'order',
    description: '3번 칸 ← 5번 칸 (3번 칸이 5번 칸과 같아진다)',
  },
  {
    id: 'copy-above',
    name: 'COPY ABOVE',
    type: 'meta',
    build: 'order',
    description: '바로 위 칸의 규칙을 한 번 더 적용',
  },
  {
    id: 'unique-second',
    name: 'UNIQUE SECOND',
    type: 'reroll',
    build: 'order',
    description: '2번 칸이 다른 칸과 겹치지 않을 때까지 다시 굴린다',
  },

  // ---- safe ----
  {
    id: 'no-zero',
    name: 'NO ZERO',
    type: 'weight',
    build: 'safe',
    description: '0 확률 0 — 0이 절대 나오지 않는다',
  },
  {
    id: 'four-shield',
    name: 'FOUR SHIELD',
    type: 'reroll',
    build: 'safe',
    description: '나온 4를 전부 다시 굴리고, 이번 스핀 0 확률 ×2',
  },
  {
    id: 'four-parry',
    name: 'FOUR PARRY',
    type: 'reroll',
    build: 'safe',
    description: '가장 왼쪽 4 하나를 다시 굴린다',
  },
  {
    id: 'safe-convert',
    name: 'SAFE CONVERT',
    type: 'transform',
    build: 'safe',
    description: '가장 왼쪽 4 → 🔴 (4가 루비로 바뀐다)',
  },
  {
    id: 'gem-shuffle',
    name: 'GEM SHUFFLE',
    type: 'reroll',
    build: 'safe',
    description: '가장 왼쪽 보석 1칸을 다시 굴린다 (보석 제거용)',
  },

  // ---- score ----
  {
    id: 'bonus-77',
    name: 'LUCKY SEVEN-SEVEN',
    type: 'score',
    build: 'score',
    description: '+77 점',
  },
  {
    id: 'clean-bonus',
    name: 'CLEAN SWEEP',
    type: 'score',
    build: 'score',
    description: '보드에 4가 하나도 없으면 +100점',
  },
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
);
